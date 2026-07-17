// Libro de hechizos por clase: qué hechizos de Hechizos.dat conoce cada
// clase y desde qué nivel. En el AO original se aprenden con pergaminos;
// hasta implementar el drop/compra de pergaminos, el libro se desbloquea
// por nivel con la progresión típica de cada clase.

export interface SpellbookEntry {
  readonly spellId: number; // ID en Hechizos.dat (AO_SPELLS)
  readonly minLevel: number;
}

export const CLASS_SPELLBOOK: Record<number, ReadonlyArray<SpellbookEntry>> = {
  // Guerrero (1), Arquero (4), Asesino (5): sin magia, como el AO clásico.
  1: [],
  4: [],
  5: [],
  // Mago: la línea de daño arcano completa + control (inmovilizar/paralizar).
  2: [
    { spellId: 2, minLevel: 1 },   // Dardo Mágico
    { spellId: 6, minLevel: 3 },   // Flecha Mágica
    { spellId: 7, minLevel: 7 },   // Flecha Eléctrica
    { spellId: 8, minLevel: 12 },  // Proyectil Mágico
    { spellId: 24, minLevel: 16 }, // Inmovilizar
    { spellId: 15, minLevel: 20 }, // Tormenta de Fuego
    { spellId: 9, minLevel: 27 },  // Paralizar
    { spellId: 23, minLevel: 30 }, // Descarga Eléctrica
    { spellId: 25, minLevel: 40 }, // Apocalipsis
  ],
  // Clérigo: sanación + soporte + contra-control.
  3: [
    { spellId: 3, minLevel: 1 },   // Curar Heridas Leves
    { spellId: 2, minLevel: 2 },   // Dardo Mágico
    { spellId: 1, minLevel: 4 },   // Antídoto Mágico
    { spellId: 5, minLevel: 10 },  // Curar Heridas Graves
    { spellId: 10, minLevel: 13 }, // Devolver Movilidad
    { spellId: 20, minLevel: 15 }, // Fuerza
    { spellId: 14, minLevel: 22 }, // Invisibilidad
    { spellId: 11, minLevel: 35 }, // Resucitar
  ],
  // Druida: veneno + naturaleza + buffs + control.
  6: [
    { spellId: 4, minLevel: 1 },   // Toxina
    { spellId: 3, minLevel: 3 },   // Curar Heridas Leves
    { spellId: 18, minLevel: 8 },  // Celeridad
    { spellId: 20, minLevel: 12 }, // Fuerza
    { spellId: 5, minLevel: 15 },  // Curar Heridas Graves
    { spellId: 10, minLevel: 18 }, // Devolver Movilidad
    { spellId: 24, minLevel: 24 }, // Inmovilizar
  ],
};

export function knownSpellsFor(classId: number, level: number): number[] {
  const book = CLASS_SPELLBOOK[classId] ?? [];
  return book.filter((e) => level >= e.minLevel).map((e) => e.spellId);
}
