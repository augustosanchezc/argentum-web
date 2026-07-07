import { calcMaxHp, calcMaxMp, getClass } from "@ao/shared";

export { calcMaxHp, calcMaxMp };

export const MAX_LEVEL = 36;

// Fórmula AO original: NecesitaExp(n) = n*(n-1)/2*100 + 100
function xpForLevel(level: number): number {
  return Math.floor(level * (level - 1) / 2) * 100 + 100;
}

// XP total acumulada para ALCANZAR un nivel (nivel 1 = 0).
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l += 1) total += xpForLevel(l);
  return total;
}

// Backward-compat: retorna HP para nivel dado, usando clase Guerrero (id=1) y CON=17.
// Preferir calcMaxHp(getClass(classId), level, con) en código nuevo.
export function maxHpForLevel(level: number): number {
  const def = getClass(1);
  if (!def) return 30 + (level - 1) * 6;
  return calcMaxHp(def, level, def.con);
}

export interface LevelProgress {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
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

export function applyXpGain(level: number, totalXp: number, reward: number): GainResult {
  const newXp = totalXp + reward;
  let newLevel = level;
  while (newLevel < MAX_LEVEL && newXp >= cumulativeXpForLevel(newLevel + 1)) {
    newLevel += 1;
  }
  return { level: newLevel, totalXp: newXp, leveledUp: newLevel > level };
}
