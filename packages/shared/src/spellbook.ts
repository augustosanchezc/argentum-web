// Libro de hechizos por clase: qué hechizos de Hechizos.dat conoce cada
// clase y desde qué nivel. En el AO original se aprenden con pergaminos;
// hasta implementar el drop/compra de pergaminos, el libro se desbloquea
// por nivel con la progresión típica de cada clase.
import { getAoSpell } from "./spells.generated.js";
import { skillsForLevel } from "./skills-uso.js";

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
  // Paladín: guerrero sagrado. Poca magia de soporte: cura + buffs + anti-control.
  7: [
    { spellId: 3, minLevel: 1 },   // Curar Heridas Leves
    { spellId: 20, minLevel: 8 },  // Fuerza (bendición)
    { spellId: 10, minLevel: 14 }, // Devolver Movilidad
    { spellId: 5, minLevel: 20 },  // Curar Heridas Graves
  ],
};

export function knownSpellsFor(classId: number, level: number): number[] {
  const book = CLASS_SPELLBOOK[classId] ?? [];
  return book.filter((e) => level >= e.minLevel).map((e) => e.spellId);
}

// La entrada del libro (hechizo + nivel mínimo) de un hechizo para una clase, o
// undefined si esa clase no puede aprenderlo. Con el sistema de pergaminos esta
// tabla define QUÉ hechizos puede aprender cada clase y a partir de qué nivel.
export function spellRequirement(classId: number, spellId: number): SpellbookEntry | undefined {
  return (CLASS_SPELLBOOK[classId] ?? []).find((e) => e.spellId === spellId);
}

// Nivel mínimo del hechizo para la clase (para mostrarlo en el nombre del libro:
// "Flecha Mágica - Lv. XX"). undefined si la clase no lo aprende.
export function spellMinLevel(classId: number, spellId: number): number | undefined {
  return spellRequirement(classId, spellId)?.minLevel;
}

// Si la clase puede usar magia (tiene hechizos aprendibles). Guerrero/Arquero no;
// Mago/Clérigo/Druida/Paladín/Asesino sí.
export function classUsesMagic(classId: number): boolean {
  return (CLASS_SPELLBOOK[classId] ?? []).length > 0;
}

// Nivel al que un hechizo se puede APRENDER (y castear): el primer nivel cuya
// skill de Magia alcanza el minSkill del hechizo. En AO el casteo se gatea por
// Magia (y acá la skill sale del nivel: L1→35 … L34→100), así que aprender un
// pergamino tiene el mismo umbral. Es IGUAL para todas las clases mágicas (fiel
// a AO Libre: la restricción real es ClaseProhibida del pergamino, no la clase).
// undefined = minSkill inalcanzable (>100): hechizos especiales de NPC/GM.
export function spellLearnLevel(spellId: number): number | undefined {
  const spell = getAoSpell(spellId);
  if (!spell) return undefined;
  for (let lvl = 1; lvl <= 34; lvl++) {
    if (skillsForLevel(lvl).magia >= spell.minSkill) return lvl;
  }
  return undefined;
}
