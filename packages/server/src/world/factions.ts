// Facciones del AO (ModFacciones.bas): Armada Real vs Legión Oscura.
// Criterios de ingreso y rangos reales del original (los umbrales de nivel
// se mantienen; nobleza/reenlistadas quedan para cuando exista reputación).

import type { Session } from "../ws/sessions.js";
import { isCriminal } from "./criminal.js";

export const FACTION_NONE = 0;
export const FACTION_ARMADA = 1;
export const FACTION_CAOS = 2;

// NPCs enlistadores (NpcType=5 en NPCs.dat): Tancredo (72) → Armada,
// Demonio Legionario (98) → Legión Oscura.
export const ENLISTER_FACTION: Record<number, number> = {
  72: FACTION_ARMADA,
  98: FACTION_CAOS,
};

export const FACTION_NAMES: Record<number, string> = {
  [FACTION_ARMADA]: "Armada Real",
  [FACTION_CAOS]: "Legión Oscura",
};

// Rangos por kills de la facción (TituloReal/TituloCaos — 15 títulos; acá
// los primeros umbrales reales de recompensa: 70/130/210/320/460/640...).
const ARMADA_RANKS: Array<[number, string]> = [
  [0, "Aprendiz"],
  [70, "Escudero"],
  [130, "Soldado"],
  [210, "Teniente"],
  [320, "Capitán"],
  [460, "Comandante"],
  [640, "General"],
  [870, "Mariscal"],
  [1160, "Condestable"],
  [2000, "Campeón de la Luz"],
];
const CAOS_RANKS: Array<[number, string]> = [
  [0, "Acólito"],
  [160, "Alma Corrupta"],
  [280, "Caballero Oscuro"],
  [400, "Señor del Miedo"],
  [600, "Heraldo del Caos"],
  [900, "Devastador"],
  [1300, "Ejecutor Imperial"],
];

// ── Recompensas por rango ──────────────────────────────────────────────────
// Armaduras faccionarias: NO se caen al morir (junto con los items newbie).
export const FACTION_ARMOR_IDS: ReadonlySet<number> = new Set([
  195, 243, 390, 391, 392, 393, // Placas Completa / +1 / +2 (+variantes E/G)
  369, 379, 677, 678,           // Legionarias
]);

// Premios acumulativos por kills de facción: oro + armadura especial.
// `factionRewards` de la sesión guarda cuántos ya cobró (índice).
export const FACTION_REWARDS: Record<number, ReadonlyArray<{ kills: number; gold: number; armor?: number }>> = {
  [FACTION_ARMADA]: [
    { kills: 0, gold: 5_000, armor: 195 },    // al enlistarse: Placas Completa
    { kills: 130, gold: 10_000 },             // Soldado
    { kills: 320, gold: 25_000, armor: 390 }, // Capitán: Placas +1
    { kills: 640, gold: 50_000, armor: 391 }, // General: Placas +2
  ],
  [FACTION_CAOS]: [
    { kills: 0, gold: 5_000, armor: 677 },    // al enlistarse: Vestimenta Legionaria
    { kills: 160, gold: 10_000, armor: 369 }, // Alma Corrupta: Armadura Legionaria
    { kills: 400, gold: 25_000, armor: 390 },
    { kills: 900, gold: 50_000, armor: 391 },
  ],
};

export function factionRank(faction: number, kills: number): string {
  const ranks = faction === FACTION_ARMADA ? ARMADA_RANKS : CAOS_RANKS;
  let title = ranks[0]![1];
  for (const [need, name] of ranks) {
    if (kills >= need) title = name;
  }
  return title;
}

export function factionKills(s: Session): number {
  return s.faction === FACTION_ARMADA ? s.criminalsKilled : s.citizensKilled;
}

// EnlistarArmadaReal (L217): no criminal, ≥30 criminales matados, nivel ≥25,
// 0 ciudadanos matados.
export function canEnlistArmada(s: Session): string | null {
  if (s.faction !== FACTION_NONE) return "Ya perteneces a una facción.";
  if (isCriminal(s)) return "¡¡Sal de aquí, criminal!!";
  if (s.citizensKilled > 0) return "Has matado ciudadanos inocentes — la Armada no te acepta.";
  if (s.criminalsKilled < 30) return `Necesitás 30 criminales matados (llevás ${s.criminalsKilled.toString()}).`;
  if (s.level < 25) return "Necesitás ser nivel 25 para enlistarte.";
  return null;
}

// EnlistarCaos (L642): criminal, ≥70 ciudadanos matados, nivel ≥25,
// nunca haber sido de la Armada (simplificado: facción 0).
export function canEnlistCaos(s: Session): string | null {
  if (s.faction !== FACTION_NONE) return "Ya perteneces a una facción.";
  if (!isCriminal(s)) return "La Legión solo acepta criminales.";
  if (s.citizensKilled < 70) return `Necesitás 70 ciudadanos matados (llevás ${s.citizensKilled.toString()}).`;
  if (s.level < 25) return "Necesitás ser nivel 25 para enlistarte.";
  return null;
}
