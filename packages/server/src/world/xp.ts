import { calcMaxHp, calcMaxMp, getClass } from "@ao/shared";

export { calcMaxHp, calcMaxMp };

export const MAX_LEVEL = 50;

// Curva de experiencia REAL de AO Libre (Modulo_UsUaRiOs.CheckUserLevel L713-727):
// no es una fórmula cerrada — parte de un ELU inicial y lo multiplica por rangos
// de nivel en cada subida, dando un crecimiento EXPONENCIAL.
//   ELV<15 ×1.4 · <21 ×1.35 · <26 ×1.3 · <35 ×1.2 · <40 ×1.3 · resto ×1.375
// El seed inicial (exp de nivel 1→2) se setea en ConnectNewUser, que no está en
// la porción de fuente que tenemos; usamos 300, el valor estándar de AO Libre.
const ELU_INICIAL = 300;

function xpMultiplier(level: number): number {
  if (level < 15) return 1.4;
  if (level < 21) return 1.35;
  if (level < 26) return 1.3;
  if (level < 35) return 1.2;
  if (level < 40) return 1.3;
  return 1.375;
}

// Exp necesaria para pasar de `level` a `level+1` (el AO multiplica usando el
// nivel YA incrementado, por eso mult(l) usa el nivel destino).
function xpForLevel(level: number): number {
  let elu = ELU_INICIAL; // need(1→2)
  for (let l = 2; l <= level; l += 1) elu = Math.round(elu * xpMultiplier(l));
  return elu;
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
  // Clamp: un nivel fijado por GM (sin ajustar xp) dejaría xpIntoLevel negativo.
  return { level, xpIntoLevel: Math.max(0, totalXp - base), xpForNextLevel: next - base };
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
