// Experiencia y niveles (E-3.5, T-055). Lógica pura y testeable.

export const MAX_LEVEL = 10;
const BASE_MAX_HP = 30;
const HP_PER_LEVEL = 8;

// HP máximo derivado del nivel. Lo derivamos siempre del nivel (no confiamos
// solo en la columna) para evitar drift si cambia la fórmula.
export function maxHpForLevel(level: number): number {
  return BASE_MAX_HP + (Math.max(1, level) - 1) * HP_PER_LEVEL;
}

// XP necesaria para pasar de `level` a `level + 1`.
function xpForLevel(level: number): number {
  return 40 + (level - 1) * 30;
}

// XP total acumulada para ALCANZAR un nivel (nivel 1 = 0).
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l += 1) total += xpForLevel(l);
  return total;
}

export interface LevelProgress {
  readonly level: number;
  // XP dentro del nivel actual y XP total que requiere completar el nivel.
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number; // 0 si está al máximo
}

export function levelProgress(level: number, totalXp: number): LevelProgress {
  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, xpIntoLevel: 0, xpForNextLevel: 0 };
  }
  const base = cumulativeXpForLevel(level);
  const next = cumulativeXpForLevel(level + 1);
  return { level, xpIntoLevel: totalXp - base, xpForNextLevel: next - base };
}

export interface GainResult {
  readonly level: number;
  readonly totalXp: number;
  readonly leveledUp: boolean;
}

// Suma XP y sube de nivel tantas veces como corresponda (hasta MAX_LEVEL).
export function applyXpGain(level: number, totalXp: number, reward: number): GainResult {
  const newXp = totalXp + reward;
  let newLevel = level;
  while (newLevel < MAX_LEVEL && newXp >= cumulativeXpForLevel(newLevel + 1)) {
    newLevel += 1;
  }
  return { level: newLevel, totalXp: newXp, leveledUp: newLevel > level };
}
