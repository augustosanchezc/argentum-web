import type { Vector2 } from "@ao/shared";
import { getClassMods } from "./balance.js";

// Fórmulas de combate portadas de SistemaCombate.bas del AO Libre original,
// con los modificadores de clase reales de Balance.dat (balance.json).
// Intervalos reales del Server.ini del AO Libre.

export type IntervalKey =
  | "melee" | "spell" | "arrow" | "use" | "potion" | "golpeUsar" | "magiaGolpe" | "golpeMagia" | "npcAttack";

// Valores por defecto = Server.ini real de AO Libre. Inmutables (para "restaurar").
export const DEFAULT_INTERVALS: Readonly<Record<IntervalKey, number>> = {
  melee: 1_500,      // IntervaloUserPuedeAtacar
  spell: 1_400,      // IntervaloLanzaHechizo
  arrow: 1_400,      // IntervaloFlechasCazadores
  use: 125,          // IntervaloUserPuedeUsar (entre usos de cualquier item)
  potion: 125,       // Cooldown entre pociones (rojas spameables como el AO)
  golpeUsar: 0,      // IntervaloGolpeUsar: 0 = poteo fluido (potear mientras peleás,
                     //                    como el AO). Tuneable en el panel admin.
  magiaGolpe: 1_000, // IntervaloMagiaGolpe (golpear después de castear)
  golpeMagia: 1_000, // IntervaloGolpeMagia (castear después de golpear)
  npcAttack: 1_600,  // IntervaloNpcPuedeAtacar
};

// Valores EN VIVO. Mutable: el panel admin puede sobreescribirlos (world/game-config).
export const INTERVALS: Record<IntervalKey, number> = { ...DEFAULT_INTERVALS };

export const RESPAWN_DELAY_MS = 3_000; // NPCs (jugadores ya no auto-reviven)
export const RANGED_RANGE = 10;        // mismo alcance que los hechizos (SPELL_RANGE)

// (El interim skillFromLevel fue reemplazado por skills POR USO reales —
// ver world/skill-training.ts y Session.skills.)

// Golpe del usuario por nivel (tabla "user hit" del AO: crece ~2/nivel).

function rand(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// PoderAtaqueArma / PoderAtaqueProyectil (SistemaCombate.bas L90/L118):
// escalonado por skill, + 2.5 por nivel sobre 12.
export function poderAtaque(
  skill: number,
  agilidad: number,
  modClaseAtaque: number,
  level: number,
): number {
  let temp: number;
  if (skill < 31) temp = skill * modClaseAtaque;
  else if (skill < 61) temp = (skill + agilidad) * modClaseAtaque;
  else if (skill < 91) temp = (skill + 2 * agilidad) * modClaseAtaque;
  else temp = (skill + 3 * agilidad) * modClaseAtaque;
  return Math.trunc(temp + 2.5 * Math.max(level - 12, 0));
}

// PoderEvasion (L72)
export function poderEvasion(
  tacticas: number,
  agilidad: number,
  modEvasion: number,
  level: number,
): number {
  const temp = (tacticas + (tacticas / 33) * agilidad) * modEvasion;
  return temp + 2.5 * Math.max(level - 12, 0);
}

// PoderEvasionEscudo (L61)
export function poderEvasionEscudo(defensaSkill: number, modEscudo: number): number {
  return (defensaSkill * modEscudo) / 2;
}

// Probabilidad de impacto (L240): 50 + dif*0.4, clamp 10..90.
export function hitChance(poderAtacante: number, poderDefensor: number): number {
  return clamp(50 + (poderAtacante - poderDefensor) * 0.4, 10, 90);
}

export function rollHit(
  poderAtacante: number,
  poderDefensor: number,
  rng: () => number = Math.random,
): boolean {
  return rand(1, 100, rng) <= hitChance(poderAtacante, poderDefensor);
}

// Rechazo con escudo (L294-318): solo cuando el golpe FALLÓ y hay escudo.
export function rollShieldBlock(
  defensaSkill: number,
  tacticasSkill: number,
  rng: () => number = Math.random,
): boolean {
  const prob = defensaSkill + tacticasSkill > 0
    ? clamp((100 * defensaSkill) / (defensaSkill + tacticasSkill), 10, 90)
    : 10;
  return rand(1, 100, rng) <= prob;
}

// CalcularDano (L322-461):
//   (3*danoArma + (maxArma/5)*max(0, fuerza-15) + danoUsuario) * modClaseDano
// danoUsuario = RandomNumber(Stats.MinHIT, Stats.MaxHIT) — el golpe propio del
// personaje, que sube con el nivel (ver golpeUsuario en @ao/shared).
export function calcularDano(opts: {
  weaponMin: number;   // MinHIT del arma (0 = wrestling: 4-9)
  weaponMax: number;
  extraAmmoMin?: number; // flecha (solo proyectiles)
  extraAmmoMax?: number;
  userHitMin: number;  // Stats.MinHIT del personaje (golpe por nivel)
  userHitMax: number;  // Stats.MaxHIT del personaje
  fuerza: number;
  modClaseDano: number;
  rng?: () => number;
}): number {
  const rng = opts.rng ?? Math.random;
  const wMin = opts.weaponMin > 0 ? opts.weaponMin : 4;
  const wMax = opts.weaponMax > 0 ? opts.weaponMax : 9;
  let danoArma = rand(wMin, wMax, rng);
  if (opts.extraAmmoMin !== undefined && opts.extraAmmoMax !== undefined) {
    danoArma += rand(opts.extraAmmoMin, Math.max(opts.extraAmmoMin, opts.extraAmmoMax), rng);
  }
  const danoUsuario = rand(opts.userHitMin, opts.userHitMax, rng);
  const dano =
    (3 * danoArma + (wMax / 5) * Math.max(0, opts.fuerza - 15) + danoUsuario) *
    opts.modClaseDano;
  return Math.trunc(dano);
}

// DoApunalar (Trabajo.bas L2388-2463): probabilidad por skill/clase; el daño
// extra es dano*2 contra NPCs, dano*1.4 (asesino) / dano*1.5 contra jugadores.
export function stabChance(classId: number, skill: number): number {
  if (classId === 5) {
    // Asesino
    return Math.trunc(((0.00003 * skill - 0.002) * skill + 0.098) * skill + 4.25);
  }
  if (classId === 3) {
    // Clérigo (mismo polinomio que Cleric/Paladin/Pirat)
    return Math.trunc(((0.000003 * skill + 0.0006) * skill + 0.0107) * skill + 4.93);
  }
  return Math.trunc(0.0361 * skill + 4.39);
}

export function rollStab(
  classId: number,
  skill: number,
  rng: () => number = Math.random,
): boolean {
  return rand(0, 100, rng) < stabChance(classId, skill);
}

// Poderes de un jugador según clase/stats/skills (balance.json + skills por uso).
// La agilidad efectiva incluye la droga de Celeridad (agiBonus).
export interface PlayerCombat {
  classId: number;
  level: number;
  agi: number;
  agiBonus: number;
  skills: {
    armas: number;
    proyectiles: number;
    tacticas: number;
    defensa: number;
  };
}

export function playerPoderAtaqueArma(p: PlayerCombat): number {
  const mods = getClassMods(p.classId);
  return poderAtaque(p.skills.armas, p.agi + p.agiBonus, mods.ataqueArmas, p.level);
}

export function playerPoderAtaqueProyectil(p: PlayerCombat): number {
  const mods = getClassMods(p.classId);
  return poderAtaque(p.skills.proyectiles, p.agi + p.agiBonus, mods.ataqueProyectiles, p.level);
}

export function playerPoderEvasion(p: PlayerCombat): number {
  const mods = getClassMods(p.classId);
  return poderEvasion(p.skills.tacticas, p.agi + p.agiBonus, mods.evasion, p.level);
}

export function playerPoderEvasionEscudo(p: PlayerCombat): number {
  const mods = getClassMods(p.classId);
  return poderEvasionEscudo(p.skills.defensa, mods.escudo);
}

export function isAdjacent(a: Vector2, b: Vector2): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function chebyshevDist(a: Vector2, b: Vector2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// Compat: la fórmula simple previa sigue usándose en las skills legacy.
export function rollDamage(
  attackerLevel: number,
  weaponBonus = 0,
  attackerStr = 18,
  defenseBonus = 0,
  rng: () => number = Math.random,
): number {
  const variance = Math.floor(rng() * (attackerLevel * 2 + 1));
  const raw = 3 + weaponBonus + Math.floor(attackerStr / 4) - defenseBonus + variance;
  return Math.max(1, raw);
}
