// Modificadores de clase reales del Balance.dat del AO Libre (balance.json,
// generado por scripts/parse-ao-dat.mjs). Mapea nuestros classId a las
// claves del AO: 4 (Arquero) usa el balance del Cazador original.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

interface BalanceJson {
  MODEVASION: Record<string, number>;
  MODATAQUEARMAS: Record<string, number>;
  MODATAQUEPROYECTILES: Record<string, number>;
  MODDANOARMAS: Record<string, number>;
  MODDANOPROYECTILES: Record<string, number>;
  MODESCUDO: Record<string, number>;
}

const balance = JSON.parse(
  readFileSync(resolve(HERE, "..", "..", "data", "dat", "balance.json"), "utf8"),
) as BalanceJson;

const CLASS_KEY: Record<number, string> = {
  1: "guerrero",
  2: "mago",
  3: "clerigo",
  4: "cazador", // Arquero
  5: "asesino",
  6: "druida",
  7: "paladin",
};

export interface ClassMods {
  readonly evasion: number;
  readonly ataqueArmas: number;
  readonly ataqueProyectiles: number;
  readonly danoArmas: number;
  readonly danoProyectiles: number;
  readonly escudo: number;
}

const cache = new Map<number, ClassMods>();

export function getClassMods(classId: number): ClassMods {
  const cached = cache.get(classId);
  if (cached) return cached;
  const key = CLASS_KEY[classId] ?? "guerrero";
  const pick = (section: Record<string, number>, fallback: number): number => {
    // Las claves del balance.json están en lowercase (el parser INI normaliza).
    const v = section[key];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const mods: ClassMods = {
    evasion: pick(balance.MODEVASION, 1),
    ataqueArmas: pick(balance.MODATAQUEARMAS, 1),
    ataqueProyectiles: pick(balance.MODATAQUEPROYECTILES, 1),
    danoArmas: pick(balance.MODDANOARMAS, 1),
    danoProyectiles: pick(balance.MODDANOPROYECTILES, 1),
    escudo: pick(balance.MODESCUDO, 1),
  };
  cache.set(classId, mods);
  return mods;
}
