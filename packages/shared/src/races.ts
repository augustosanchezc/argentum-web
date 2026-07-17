// Razas del AO Libre (datos reales: balance.json MODRAZA + Declares.bas rangos
// de cabeza + General.bas DarCuerpoDesnudo). En el AO los ATRIBUTOS dependen de
// la RAZA (base 18 + modificador), no de la clase; la clase define habilidades,
// vida/maná y rol. Género: 1 = Hombre, 2 = Mujer.

export interface RaceDef {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  // Modificadores de atributo por raza (MODRAZA de balance.json).
  readonly mod: { readonly str: number; readonly agi: number; readonly int: number; readonly con: number; readonly car: number };
  // Rango de cabezas seleccionables [primera, última] por género.
  readonly heads: { readonly 1: readonly [number, number]; readonly 2: readonly [number, number] };
  // Cuerpo desnudo por género (la armadura equipada lo cambia por su ropaje).
  readonly body: { readonly 1: number; readonly 2: number };
}

// Atributo base del AO antes de los modificadores de raza.
export const BASE_ATTRIBUTE = 18;

export const RACES: Record<number, RaceDef> = {
  1: {
    id: 1, name: "Humano", description: "Equilibrados y versátiles. +Fuerza, +Agilidad, +Constitución.",
    mod: { str: 1, agi: 1, int: 0, con: 2, car: 0 },
    heads: { 1: [1, 40], 2: [70, 89] }, body: { 1: 21, 2: 39 },
  },
  2: {
    id: 2, name: "Elfo", description: "Ágiles y sabios del bosque. +Agilidad, +Inteligencia, +Carisma.",
    mod: { str: -1, agi: 3, int: 2, con: 1, car: 2 },
    heads: { 1: [101, 122], 2: [170, 188] }, body: { 1: 210, 2: 259 },
  },
  3: {
    id: 3, name: "Elfo Oscuro", description: "Drow: mortíferos y esquivos. +Fuerza, +Agilidad, +Inteligencia, -Carisma.",
    mod: { str: 2, agi: 3, int: 2, con: 0, car: -3 },
    heads: { 1: [201, 221], 2: [270, 288] }, body: { 1: 32, 2: 40 },
  },
  4: {
    id: 4, name: "Gnomo", description: "Pequeños genios de la magia. +Agilidad, +Inteligencia, -Fuerza.",
    mod: { str: -2, agi: 3, int: 4, con: 0, car: 1 },
    heads: { 1: [401, 416], 2: [470, 484] }, body: { 1: 222, 2: 260 },
  },
  5: {
    id: 5, name: "Enano", description: "Recios y tenaces. +Fuerza, +Constitución, -Inteligencia, -Carisma.",
    mod: { str: 3, agi: 0, int: -2, con: 3, car: -2 },
    heads: { 1: [301, 319], 2: [370, 384] }, body: { 1: 53, 2: 60 },
  },
};

export const GENDERS: Record<number, string> = { 1: "Hombre", 2: "Mujer" };

export function getRace(id: number): RaceDef | undefined {
  return RACES[id];
}

// Atributos finales del personaje según su raza (base 18 + modificador).
export function raceAttributes(raceId: number): { str: number; agi: number; int: number; con: number; car: number } {
  const r = RACES[raceId] ?? RACES[1]!;
  return {
    str: BASE_ATTRIBUTE + r.mod.str,
    agi: BASE_ATTRIBUTE + r.mod.agi,
    int: BASE_ATTRIBUTE + r.mod.int,
    con: BASE_ATTRIBUTE + r.mod.con,
    car: BASE_ATTRIBUTE + r.mod.car,
  };
}

// ¿La cabeza pertenece al rango válido de esa raza+género?
export function isValidHead(raceId: number, gender: number, head: number): boolean {
  const r = RACES[raceId];
  if (!r) return false;
  const range = gender === 2 ? r.heads[2] : r.heads[1];
  return head >= range[0] && head <= range[1];
}
