// Clases de personaje del AO original.
// Datos fielmente basados en el source abierto (ao-rayo / ao-libre).

export type WeaponSubtype = "sword" | "axe" | "dagger" | "staff" | "bow" | "mace";
export type ArmorSubtype  = "robe" | "light" | "medium" | "heavy";
export type StatKey       = "str" | "agi" | "int" | "con" | "car";

export interface ClassDef {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  // Stats base al crear el personaje
  readonly str: number;
  readonly agi: number;
  readonly int: number;
  readonly con: number;
  readonly car: number;
  // Crecimiento por nivel
  readonly baseHp: number;
  readonly hpPerLevel: number;
  readonly baseMp: number;
  readonly mpPerLevel: number;
  // Restricciones de equipo
  readonly allowedWeapons: readonly WeaponSubtype[];
  readonly allowedArmorTypes: readonly ArmorSubtype[];
  // Sprite inicial (Personajes.ind / Cabezas.ind del AO)
  readonly startBodyId: number;
  readonly startHeadId: number;
}

export const CLASSES: Record<number, ClassDef> = {
  1: {
    id: 1,
    name: "Guerrero",
    description: "Maestro del combate cuerpo a cuerpo. Alta vida y fuerza.",
    str: 18, agi: 13, int: 12, con: 17, car: 8,
    baseHp: 30, hpPerLevel: 6,
    baseMp: 0,  mpPerLevel: 0,
    allowedWeapons: ["sword", "axe", "mace", "dagger"],
    allowedArmorTypes: ["heavy", "medium", "light"],
    startBodyId: 1, startHeadId: 1,
  },
  2: {
    id: 2,
    name: "Mago",
    description: "Domina el arte arcano. Bajo HP pero gran poder mágico.",
    str: 10, agi: 12, int: 20, con: 12, car: 8,
    baseHp: 15, hpPerLevel: 2,
    baseMp: 20, mpPerLevel: 8,
    allowedWeapons: ["staff"],
    allowedArmorTypes: ["robe"],
    startBodyId: 3, startHeadId: 3,
  },
  3: {
    id: 3,
    name: "Clérigo",
    description: "Sanador y protector. Puede curar aliados con mazas y bastones.",
    str: 12, agi: 12, int: 18, con: 15, car: 8,
    baseHp: 20, hpPerLevel: 3,
    baseMp: 15, mpPerLevel: 6,
    allowedWeapons: ["mace", "staff"],
    allowedArmorTypes: ["medium", "robe"],
    startBodyId: 1, startHeadId: 2,
  },
  4: {
    id: 4,
    name: "Arquero",
    description: "Experto en combate a distancia. Ágil y preciso con el arco.",
    str: 14, agi: 16, int: 12, con: 13, car: 8,
    baseHp: 22, hpPerLevel: 4,
    baseMp: 0,  mpPerLevel: 0,
    allowedWeapons: ["bow", "dagger"],
    allowedArmorTypes: ["light", "medium"],
    startBodyId: 2, startHeadId: 4,
  },
  5: {
    id: 5,
    name: "Asesino",
    description: "Maestro del sigilo. Alta agilidad, letal con dagas.",
    str: 14, agi: 17, int: 13, con: 10, car: 8,
    baseHp: 20, hpPerLevel: 4,
    baseMp: 5,  mpPerLevel: 2,
    allowedWeapons: ["dagger", "sword"],
    allowedArmorTypes: ["light"],
    startBodyId: 2, startHeadId: 5,
  },
  6: {
    id: 6,
    name: "Druida",
    description: "Guardián de la naturaleza. Mezcla magia y resistencia física.",
    str: 10, agi: 11, int: 19, con: 14, car: 8,
    baseHp: 18, hpPerLevel: 3,
    baseMp: 18, mpPerLevel: 7,
    allowedWeapons: ["staff", "mace"],
    allowedArmorTypes: ["robe", "light"],
    startBodyId: 3, startHeadId: 6,
  },
};

export function getClass(id: number): ClassDef | undefined {
  return CLASSES[id];
}

// HP máximo = base de clase + crecimiento por nivel + bonificación de constitución
export function calcMaxHp(classDef: ClassDef, level: number, con: number): number {
  return classDef.baseHp + classDef.hpPerLevel * (level - 1) + Math.floor(con / 2);
}

// MP máximo = base de clase + crecimiento por nivel + bonificación de inteligencia
// Devuelve 0 si la clase no usa maná (Guerrero, Arquero).
export function calcMaxMp(classDef: ClassDef, level: number, int: number): number {
  if (classDef.mpPerLevel === 0 && classDef.baseMp === 0) return 0;
  return classDef.baseMp + classDef.mpPerLevel * (level - 1) + Math.floor(int / 3);
}

// Puntos de stat que se ganan al subir de nivel (3 por nivel, igual que AO).
export const STAT_POINTS_PER_LEVEL = 3;
