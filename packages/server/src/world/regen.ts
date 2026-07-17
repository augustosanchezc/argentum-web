import { ServerToClientOp, type CriminalUpdate, type EntityId } from "@ao/shared";
import { broadcastToMap } from "../ws/broadcast.js";
import type { Session } from "../ws/sessions.js";
import { sessions } from "../ws/sessions.js";
import { trainSkill } from "./skill-training.js";

// Modelo de regeneración del AO Libre (General.bas / Server.ini): cada efecto
// tiene su PROPIO intervalo y monto ALEATORIO, acumulando ms en un contador.
// Corremos el tick fino (200ms) y cada contador dispara al superar su intervalo.
export const REGEN_INTERVAL_MS = 200;

// Intervalos reales (Server.ini [INTERVALOS]).
const SANA_SIN_DESCANSAR = 1600;
const SANA_DESCANSAR = 100;
const STAMINA_SIN_DESCANSAR = 10;
const STAMINA_DESCANSAR = 5;
const INTERVALO_SED = 6000;
const INTERVALO_HAMBRE = 6500;
// Meditar: recupera un 6% del maná (balance.json porcentajerecuperomana=6) con
// frecuencia según la skill (tabla de "Suerte" de Trabajo.bas, ~40ms/tick del AO).
const PORCENTAJE_RECUPERO_MANA = 6;
const AO_TICK_MS = 40;

function randInt(lo: number, hi: number): number {
  const h = Math.max(lo, hi);
  return lo + Math.floor(Math.random() * (h - lo + 1));
}

// Porcentaje(valor, pct) del AO = parte entera.
function porcentaje(valor: number, pct: number): number {
  return Math.floor((valor * pct) / 100);
}

// Tabla de Suerte de Meditar (Trabajo.bas): a mayor skill, menor divisor → más
// frecuente. El intervalo efectivo = Suerte × tick(~40ms).
function suerteMeditar(skill: number): number {
  if (skill <= 10) return 35;
  if (skill <= 20) return 30;
  if (skill <= 30) return 28;
  if (skill <= 40) return 24;
  if (skill <= 50) return 22;
  if (skill <= 60) return 20;
  if (skill <= 70) return 18;
  if (skill <= 80) return 15;
  if (skill <= 90) return 10;
  if (skill < 100) return 7;
  return 5;
}

// Un tick de regeneración. `dt` = ms transcurridos desde el tick anterior.
// sendFn construye y envía el StatsUpdate al jugador cuando algo cambió.
export function tickRegen(sendFn: (s: Session) => void, dt: number = REGEN_INTERVAL_MS): void {
  const now = Date.now();

  for (const s of sessions.all()) {
    if (s.deadUntil !== 0) continue;
    const c = s.regenCounters;
    let changed = false;

    // ── Sed: −10 cada IntervaloSed (6000ms) ──
    c.agua += dt;
    if (c.agua >= INTERVALO_SED) {
      c.agua = 0;
      if (s.thirst > 0) { s.thirst = Math.max(0, s.thirst - 10); changed = true; }
    }
    // ── Hambre: −10 cada IntervaloHambre (6500ms) ──
    c.com += dt;
    if (c.com >= INTERVALO_HAMBRE) {
      c.com = 0;
      if (s.hunger > 0) { s.hunger = Math.max(0, s.hunger - 10); changed = true; }
    }

    // Expiración de drogas/hechizos (Fuerza/Celeridad, Poción Verde/Amarilla).
    if (s.buffUntil > 0 && now >= s.buffUntil) {
      s.strBonus = 0;
      s.agiBonus = 0;
      s.buffUntil = 0;
      changed = true;
    }

    // Expiración del estado criminal: el nombre vuelve a azul para todos.
    if (s.criminalUntil > 0 && now >= s.criminalUntil) {
      s.criminalUntil = 0;
      const pkt: CriminalUpdate = {
        op: ServerToClientOp.CriminalUpdate,
        id: s.characterId as EntityId,
        criminal: false,
        expiresAt: 0,
      };
      broadcastToMap(s.mapId, pkt);
    }

    // Con hambre o sed en 0 se corta la sanación y la energía (AO: flags Hambre/Sed).
    const starving = s.hunger <= 0 || s.thirst <= 0;

    // ── Sanación de HP: cada SanaIntervalo, +RandomNumber(2, 5%·MaxSta) ──
    if (!starving && s.hp < s.maxHp) {
      c.hp += dt;
      const interval = s.resting ? SANA_DESCANSAR : SANA_SIN_DESCANSAR;
      if (c.hp >= interval) {
        c.hp = 0;
        s.hp = Math.min(s.maxHp, s.hp + randInt(2, Math.max(2, porcentaje(s.maxSta, 5))));
        changed = true;
      }
    } else {
      c.hp = 0;
    }

    // ── Energía (stamina): cada StaminaIntervalo, +RandomNumber(1, 5%·MaxSta).
    //    Desnudo (sin armadura) no recupera energía (AO). ──
    if (!starving && s.sta < s.maxSta && s.equippedArmor !== null) {
      c.sta += dt;
      const interval = s.resting ? STAMINA_DESCANSAR : STAMINA_SIN_DESCANSAR;
      if (c.sta >= interval) {
        c.sta = 0;
        s.sta = Math.min(s.maxSta, s.sta + randInt(1, Math.max(1, porcentaje(s.maxSta, 5))));
        changed = true;
      }
    } else {
      c.sta = 0;
    }

    // ── Meditación: único modo de recuperar maná en el AO. 6% del máximo,
    //    con frecuencia según la skill Meditar (no hay regen pasivo de maná). ──
    if (s.meditating && s.maxMana > 0 && s.mana < s.maxMana) {
      c.med += dt;
      const interval = suerteMeditar(s.skills.meditar) * AO_TICK_MS;
      if (c.med >= interval) {
        c.med = 0;
        s.mana = Math.min(s.maxMana, s.mana + Math.max(1, porcentaje(s.maxMana, PORCENTAJE_RECUPERO_MANA)));
        trainSkill(s, "meditar", true);
        changed = true;
      }
    } else {
      c.med = 0;
    }

    if (changed) sendFn(s);
  }
}
