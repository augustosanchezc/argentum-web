// Clases de personaje del AO original.
// Sin tirada de dados (decisión de diseño): cada clase arranca con la MEJOR
// combinación fija posible — la tirada máxima del AO (20 en cada atributo,
// MaxDados=20 del Server.ini) más los modificadores reales de la raza meta
// de esa clase (MODRAZA del Balance.dat):
//   Humano +1F +1A +2Co · Elfo -1F +3A +2I +2C +1Co · Drow +2F +3A +2I -3C
//   Enano +3F -2I -2C +3Co · Gnomo -2F +3A +4I +1C

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
  // AO Libre (balance.json MODVIDA): vida promedio ganada por nivel, según clase.
  // La vida real por nivel = modVida − (21 − CON) × 0.5 (Modulo_UsUaRiOs.CheckUserLevel).
  readonly modVida: number;
  // AO Libre (CheckUserLevel AumentoHIT): suba de golpe Min/Max por nivel.
  // Algunas clases bajan el ritmo pasado el nivel 35.
  readonly hitPerLevel: number;
  readonly hitPerLevelOver35: number;
  // AO Libre (CheckUserLevel AumentoMANA): maná ganado por nivel = manaK × INT.
  // 0 = clase sin maná (Guerrero, Arquero). Mago 2.8 · Clérigo/Druida 2 · Asesino 1.
  readonly manaK: number;
  // AO Libre (Declares.bas AumentoSTA): energía ganada por nivel. Def 15 · Mago 14.
  readonly aumentoSta: number;
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
    description: "Enano. Maestro del combate cuerpo a cuerpo. Alta vida y fuerza.",
    str: 23, agi: 20, int: 18, con: 23, car: 18,
    baseHp: 30, hpPerLevel: 6,
    baseMp: 0,  mpPerLevel: 0,
    modVida: 10, hitPerLevel: 3, hitPerLevelOver35: 2, manaK: 0, aumentoSta: 15,
    allowedWeapons: ["sword", "axe", "mace", "dagger"],
    allowedArmorTypes: ["heavy", "medium", "light"],
    startBodyId: 1, startHeadId: 1,
  },
  2: {
    id: 2,
    name: "Mago",
    description: "Gnomo. Domina el arte arcano. Bajo HP pero el mayor poder mágico.",
    str: 18, agi: 23, int: 24, con: 20, car: 21,
    baseHp: 15, hpPerLevel: 2,
    baseMp: 20, mpPerLevel: 8,
    modVida: 7.5, hitPerLevel: 1, hitPerLevelOver35: 1, manaK: 2.8, aumentoSta: 14,
    allowedWeapons: ["staff"],
    allowedArmorTypes: ["robe"],
    startBodyId: 3, startHeadId: 3,
  },
  3: {
    id: 3,
    name: "Clérigo",
    description: "Humano. Sanador y protector. Cura aliados; pelea con mazas.",
    str: 21, agi: 21, int: 20, con: 22, car: 20,
    baseHp: 20, hpPerLevel: 3,
    baseMp: 15, mpPerLevel: 6,
    modVida: 8.5, hitPerLevel: 2, hitPerLevelOver35: 2, manaK: 2, aumentoSta: 15,
    allowedWeapons: ["mace", "staff"],
    allowedArmorTypes: ["medium", "robe"],
    startBodyId: 1, startHeadId: 2,
  },
  4: {
    id: 4,
    name: "Arquero",
    description: "Elfo. Experto en combate a distancia. Ágil y preciso con el arco.",
    str: 19, agi: 23, int: 22, con: 21, car: 22,
    baseHp: 22, hpPerLevel: 4,
    baseMp: 0,  mpPerLevel: 0,
    modVida: 9.5, hitPerLevel: 3, hitPerLevelOver35: 2, manaK: 0, aumentoSta: 15,
    allowedWeapons: ["bow", "dagger"],
    allowedArmorTypes: ["light", "medium"],
    startBodyId: 2, startHeadId: 4,
  },
  5: {
    id: 5,
    name: "Asesino",
    description: "Drow. Maestro del sigilo. Alta agilidad, letal con la apuñalada.",
    str: 22, agi: 23, int: 22, con: 20, car: 17,
    baseHp: 20, hpPerLevel: 4,
    baseMp: 5,  mpPerLevel: 2,
    modVida: 8.5, hitPerLevel: 3, hitPerLevelOver35: 1, manaK: 1, aumentoSta: 15,
    allowedWeapons: ["dagger", "sword"],
    allowedArmorTypes: ["light"],
    startBodyId: 2, startHeadId: 5,
  },
  6: {
    id: 6,
    name: "Druida",
    description: "Elfo. Guardián de la naturaleza. Magia, veneno y carisma para domar.",
    str: 19, agi: 23, int: 22, con: 21, car: 22,
    baseHp: 18, hpPerLevel: 3,
    baseMp: 18, mpPerLevel: 7,
    modVida: 8.5, hitPerLevel: 2, hitPerLevelOver35: 2, manaK: 2, aumentoSta: 15,
    allowedWeapons: ["staff", "mace"],
    allowedArmorTypes: ["robe", "light"],
    startBodyId: 3, startHeadId: 6,
  },
  7: {
    id: 7,
    name: "Paladín",
    description: "Humano. Guerrero sagrado: tanque con escudo que también cura y bendice.",
    // Humano (+1F +1A +2Co). Tanque híbrido: alta CON/FUE + algo de INT para curar.
    str: 22, agi: 19, int: 20, con: 23, car: 20,
    baseHp: 26, hpPerLevel: 5,
    baseMp: 10, mpPerLevel: 4,
    modVida: 9.5, hitPerLevel: 2, hitPerLevelOver35: 2, manaK: 1.5, aumentoSta: 15,
    allowedWeapons: ["sword", "mace"],
    allowedArmorTypes: ["heavy", "medium", "light"],
    startBodyId: 1, startHeadId: 1,
  },
};

export function getClass(id: number): ClassDef | undefined {
  return CLASSES[id];
}

// Energía (stamina) máxima — AO Libre (CheckUserLevel): sube AumentoSTA por nivel
// (tope 999). El valor inicial exacto vive en ConnectNewUser (fuera de la fuente
// que tenemos); usamos 100 como base de nivel 1 para mantener jugable el arranque.
export function calcMaxSta(classDef: ClassDef, level: number): number {
  return Math.min(999, 100 + classDef.aumentoSta * Math.max(0, level - 1));
}

// Tope de vida/golpe del AO (Declares.bas).
export const STAT_MAXHP = 999;
export const STAT_MAXHIT_UNDER36 = 99;
export const STAT_MAXHIT_OVER36 = 999;

// HP máximo — fórmula real de AO Libre (Modulo_UsUaRiOs.CheckUserLevel):
// cada nivel suma un promedio = ModVida(clase) − (21 − CON) × 0.5. En el AO ese
// promedio se reparte con RNG alrededor de la media; acá usamos la media exacta
// (esperanza de la distribución) para que la vida sea determinística por nivel.
export function calcMaxHp(classDef: ClassDef, level: number, con: number): number {
  const promedio = classDef.modVida - (21 - con) * 0.5;
  const hp = Math.round(classDef.baseHp + promedio * Math.max(0, level - 1));
  return Math.max(classDef.baseHp, Math.min(STAT_MAXHP, hp));
}

// Golpe del personaje (Stats.MinHIT/MaxHIT) — AO Libre CheckUserLevel: arranca en
// 1/2 y cada nivel suma AumentoHIT (según clase, con ritmo distinto pasado el 35).
// Tope 99 por debajo del nivel 36; recién en 36+ puede escalar hasta 999. Ese
// salto en el nivel 36 es un hito de poder real del AO.
export function golpeUsuario(classId: number, level: number): { min: number; max: number } {
  const cls = CLASSES[classId];
  let minH = 1;
  let maxH = 2;
  if (!cls) return { min: minH, max: maxH };
  for (let l = 2; l <= level; l += 1) {
    const inc = l > 35 ? cls.hitPerLevelOver35 : cls.hitPerLevel;
    minH += inc;
    maxH += inc;
    const cap = l < 36 ? STAT_MAXHIT_UNDER36 : STAT_MAXHIT_OVER36;
    if (maxH > cap) maxH = cap;
    if (minH > cap) minH = cap;
  }
  return { min: minH, max: maxH };
}

// MP máximo — AO Libre (CheckUserLevel): cada nivel suma AumentoMANA = manaK × INT.
// Acumulado = manaK × INT × nivel (usamos el nivel 1 como el seed de una "suba",
// ya que el maná inicial exacto vive en ConnectNewUser, fuera de la fuente que
// tenemos). Devuelve 0 si la clase no usa maná (Guerrero, Arquero). Tope 9999.
export function calcMaxMp(classDef: ClassDef, level: number, int: number): number {
  if (classDef.manaK === 0) return 0;
  return Math.min(9999, Math.round(classDef.manaK * int * level));
}

// AO Libre: los ATRIBUTOS (Fuerza/Agilidad/etc.) son FIJOS desde la creación —
// nunca suben con el nivel. Lo que se gana por nivel son puntos de SKILL (10 al
// nivel 1, +5 por nivel), que suben las habilidades (topan en 100), no atributos.
// Por eso no se otorgan puntos de atributo: 0.
export const STAT_POINTS_PER_LEVEL = 0;
