// Facciones (Armada Real vs Legión Oscura) — sistema de PUNTOS DE FACCIÓN.
// El progreso se mide en puntos (no en kills crudas): cada kill válida da 10
// puntos. Con puntos + nivel te enlistás (/enlistar) y ascendés de rango
// manualmente (/recompensa), que entrega la armadura faccionaria del rango.

import type { Session } from "../ws/sessions.js";
import { FACTION_RANK_ARMOR } from "@ao/shared";
import { isCriminal } from "./criminal.js";

export const FACTION_NONE = 0;
export const FACTION_ARMADA = 1;
export const FACTION_CAOS = 2;

// NPCs enlistadores (NpcType=5): Tancredo de Hauteville (72, Mapa 60) → Armada;
// Demonio Legionario (98, Mapa 151) → Legión Oscura.
export const ENLISTER_FACTION: Record<number, number> = {
  72: FACTION_ARMADA,
  98: FACTION_CAOS,
};

export const FACTION_NAMES: Record<number, string> = {
  [FACTION_ARMADA]: "Armada Real",
  [FACTION_CAOS]: "Legión Oscura",
};

// ── Puntos ──────────────────────────────────────────────────────────────────
export const POINTS_PER_KILL = 10;
export const ENLIST_MIN_LEVEL = 25;
// Umbral de puntos para enlistarse (coincide con el 1er rango de cada facción).
export const ENLIST_POINTS: Record<number, number> = {
  [FACTION_ARMADA]: 100,
  [FACTION_CAOS]: 350,
};
// Anti-farmeo: no cuenta re-kill del mismo par (atacante→víctima) en 5 minutos.
export const REKILL_COOLDOWN_MS = 5 * 60 * 1000;

// ── Rangos (nivel + puntos requeridos) ──────────────────────────────────────
export interface FactionRank {
  readonly name: string;
  readonly level: number;
  readonly points: number;
  // Recompensa en oro al reclamar el rango.
  readonly gold: number;
}

export const ARMADA_RANKS: readonly FactionRank[] = [
  { name: "Soldado", level: 25, points: 100, gold: 5_000 },
  { name: "Caballero", level: 30, points: 500, gold: 15_000 },
  { name: "Capitán", level: 35, points: 1_000, gold: 40_000 },
  { name: "Protector del Reino", level: 40, points: 2_500, gold: 80_000 },
  { name: "Campeón de la Luz", level: 43, points: 5_000, gold: 150_000 },
];
export const CAOS_RANKS: readonly FactionRank[] = [
  { name: "Acólito", level: 25, points: 350, gold: 5_000 },
  { name: "Emisario del Caos", level: 30, points: 1_000, gold: 15_000 },
  { name: "Sanguinario", level: 35, points: 2_500, gold: 40_000 },
  { name: "Caballero de la Oscuridad", level: 40, points: 5_000, gold: 80_000 },
  { name: "Devorador de Almas", level: 43, points: 10_000, gold: 150_000 },
];
export function factionRanks(faction: number): readonly FactionRank[] {
  return faction === FACTION_ARMADA ? ARMADA_RANKS : CAOS_RANKS;
}
// Nombre del rango actual (rankIdx = cuántos rangos reclamó: 0 = enlistado sin
// rango; 1..5 = rangos con /recompensa).
export function factionRankName(faction: number, rankIdx: number): string {
  if (rankIdx <= 0) return "Aspirante";
  return factionRanks(faction)[Math.min(rankIdx, 5) - 1]?.name ?? "Aspirante";
}
// El próximo rango reclamable (rango rankIdx+1), o null si ya está al máximo.
export function nextRank(faction: number, rankIdx: number): FactionRank | null {
  return factionRanks(faction)[rankIdx] ?? null;
}

// ── Recompensa de armadura por (facción, rango, clase, raza) ────────────────
// Variante de raza: Enano(5)/Gnomo(4) usan el cuerpo "E/G"; el resto el "alto".
export function raceVariant(race: number): "alto" | "eg" {
  return race === 4 || race === 5 ? "eg" : "alto";
}
// Item de armadura para (facción, rango 1..5, clase, raza). Sale del catálogo
// custom generado (items.custom.ts): clona el sprite de la 2ª Jerarquía con
// defensa escalada por rango; requiere ese rango para equiparse.
export function factionRankArmor(faction: number, rankIdx1: number, classId: number, race: number): number | undefined {
  return FACTION_RANK_ARMOR[faction]?.[classId]?.[raceVariant(race)]?.[rankIdx1 - 1];
}

// Armaduras faccionarias CLÁSICAS que NO se caen al morir (las de recompensa
// custom se detectan por su campo `factionReq`, ver dropAllItemsOnDeath).
export const FACTION_ARMOR_IDS: ReadonlySet<number> = new Set([
  195, 243, 390, 391, 392, 393, 369, 379, 677, 678,
]);

// ── Enlistamiento ───────────────────────────────────────────────────────────
export function canEnlistArmada(s: Session): string | null {
  if (s.faction !== FACTION_NONE) return "Ya perteneces a una facción.";
  if (isCriminal(s)) return "¡Fuera de aquí, criminal! La Armada Real no te acepta.";
  if (s.level < ENLIST_MIN_LEVEL) return `Necesitás ser nivel ${ENLIST_MIN_LEVEL.toString()} para enlistarte.`;
  const need = ENLIST_POINTS[FACTION_ARMADA]!;
  if (s.factionPoints < need) return `Necesitás ${need.toString()} puntos de facción (tenés ${s.factionPoints.toString()}).`;
  return null;
}
export function canEnlistCaos(s: Session): string | null {
  if (s.faction !== FACTION_NONE) return "Ya perteneces a una facción.";
  if (!isCriminal(s)) return "La Legión Oscura solo acepta criminales.";
  if (s.level < ENLIST_MIN_LEVEL) return `Necesitás ser nivel ${ENLIST_MIN_LEVEL.toString()} para enlistarte.`;
  const need = ENLIST_POINTS[FACTION_CAOS]!;
  if (s.factionPoints < need) return `Necesitás ${need.toString()} puntos de facción (tenés ${s.factionPoints.toString()}).`;
  return null;
}

// ── Puntos por kill ─────────────────────────────────────────────────────────
// ¿La kill de `killer` sobre `victim` otorga puntos según la alineación?
//   · Ciudadano/Armada: solo suma matando criminales o miembros del Caos.
//   · Criminal/Caos: suma matando a cualquiera (ciudadanos, Armada, criminales, Caos).
export function killGivesFactionPoints(killer: Session, victim: Session): boolean {
  if (isCriminal(killer)) return true;
  return isCriminal(victim) || victim.faction === FACTION_CAOS;
}
// Regla de nivel de la kill válida: la víctima no es newbie Y (la diferencia de
// niveles no supera 10, o la víctima es nivel 25+).
export function killLevelValid(killerLevel: number, victimLevel: number, victimIsNewbie: boolean): boolean {
  if (victimIsNewbie) return false;
  return Math.abs(killerLevel - victimLevel) <= 10 || victimLevel >= ENLIST_MIN_LEVEL;
}
