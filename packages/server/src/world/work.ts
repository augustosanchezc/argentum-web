// Trabajos del AO (Trabajo.bas): talar, minar, pescar, fundir, herrería,
// carpintería. IDs canónicos de herramientas y productos del Declares.bas.

import { getItem } from "@ao/shared";

// Herramientas (Declares.bas)
export const TOOLS = {
  hachas: [127, 561, 1005],
  piquetes: [187, 562],
  canas: [138, 563],
  redes: [543],
  martillos: [389, 565],
  serruchos: [198, 564],
} as const;

// Productos
export const PRODUCTS = {
  lena: 58,
  lenaElfica: 1006,
  pescado: 139,
  lingoteHierro: 386,
  lingotePlata: 387,
  lingoteOro: 388,
  hierroCrudo: 192,
  plataCruda: 193,
  oroCrudo: 194,
  fogataApagada: 136,
  fogata: 63,
} as const;

// WAVs de trabajo (Declares.bas): talar 13, pescar 14, minar 15.
export const WORK_WAV = { talar: 13, pescar: 14, minar: 15 } as const;

export const WORK_INTERVAL_MS = 850; // IntervaloTrabajo del Server.ini

export type WorkKind = "talar" | "minar" | "pescar";

export function toolKind(item: number): WorkKind | null {
  if ((TOOLS.hachas as readonly number[]).includes(item)) return "talar";
  if ((TOOLS.piquetes as readonly number[]).includes(item)) return "minar";
  if ((TOOLS.canas as readonly number[]).includes(item)) return "pescar";
  if ((TOOLS.redes as readonly number[]).includes(item)) return "pescar";
  return null;
}

// Fórmula de éxito de extracción (DoTalar/DoMineria/DoPescar):
//   Suerte = trunc(-0.00125·skill² − 0.3·skill + 49)
//   éxito si RandomNumber(1, Suerte) <= 6
// (a skill 0: ~12% · a skill 100: 100%)
export function rollWorkSuccess(skill: number, rng: () => number = Math.random): boolean {
  const suerte = Math.max(6, Math.trunc(-0.00125 * skill * skill - 0.3 * skill + 49));
  const roll = 1 + Math.floor(rng() * suerte);
  return roll <= 6;
}

export { isWaterGraphic } from "@ao/shared";

// Fundición: 5 minerales crudos → 1 lingote (junto a una fragua).
export const MINERALS_PER_INGOT = 5;
export const SMELT_MAP: Record<number, number> = {
  [PRODUCTS.lingoteHierro]: PRODUCTS.hierroCrudo,
  [PRODUCTS.lingotePlata]: PRODUCTS.plataCruda,
  [PRODUCTS.lingoteOro]: PRODUCTS.oroCrudo,
};

// ObjType de los objetos del mapa relevantes.
export const OBJTYPE = {
  arbol: 4,
  fogata: 15,
  yacimiento: 22,
  yunque: 27,
  fragua: 28,
  arbolElfico: 36,
} as const;

// ¿Hay un objeto de tipo objType a distancia <= dist de (x,y)?
export function objTypeNear(
  objects: ReadonlyMap<number, { readonly item: number; readonly amount: number }>,
  width: number,
  x: number,
  y: number,
  objType: number,
  dist: number,
): boolean {
  for (let dy = -dist; dy <= dist; dy += 1) {
    for (let dx = -dist; dx <= dist; dx += 1) {
      const obj = objects.get((y + dy) * width + (x + dx));
      if (!obj) continue;
      if (getItem(obj.item)?.objType === objType) return true;
    }
  }
  return false;
}
