// Catálogo de items del AO web. Expandido fielmente desde el AO original.
// Los `graphic` son GrhIndex del AO clásico (obj.dat / Graficos.ind).

import type { WeaponSubtype, ArmorSubtype } from "./classes.js";
export type { WeaponSubtype, ArmorSubtype };

export type ItemType = "weapon" | "armor" | "helmet" | "shield" | "potion";

export interface ItemDef {
  readonly id: number;
  readonly name: string;
  readonly type: ItemType;
  readonly value: number;
  readonly graphic: number;
  // Arma: daño base que suma a la fórmula de combate
  readonly damageBonus?: number;
  readonly weaponSubtype?: WeaponSubtype;
  // Armadura / casco / escudo: defensa que reduce daño recibido
  readonly defense?: number;
  readonly armorSubtype?: ArmorSubtype;
  // Poción: cantidad de HP / MP que restaura
  readonly heal?: number;
  readonly manaHeal?: number;
  // Nivel mínimo para equipar
  readonly minLevel?: number;
}

export const ITEMS: Record<number, ItemDef> = {
  // ── POCIONES ──────────────────────────────────────────────────────────────
  1:  { id: 1,  name: "Poción menor",   type: "potion",  value: 10,  graphic: 542, heal: 15 },
  21: { id: 21, name: "Poción mayor",   type: "potion",  value: 30,  graphic: 543, heal: 45 },
  22: { id: 22, name: "Poción de maná", type: "potion",  value: 25,  graphic: 544, manaHeal: 25 },

  // ── ARMAS ─────────────────────────────────────────────────────────────────
  2:  { id: 2,  name: "Daga",           type: "weapon",  value: 25,  graphic: 510, damageBonus: 3,  weaponSubtype: "dagger" },
  6:  { id: 6,  name: "Espada corta",   type: "weapon",  value: 55,  graphic: 503, damageBonus: 5,  weaponSubtype: "sword" },
  3:  { id: 3,  name: "Espada larga",   type: "weapon",  value: 80,  graphic: 504, damageBonus: 7,  weaponSubtype: "sword" },
  7:  { id: 7,  name: "Hacha de batalla", type: "weapon", value: 150, graphic: 511, damageBonus: 10, weaponSubtype: "axe",   minLevel: 3 },
  8:  { id: 8,  name: "Bastón de mago", type: "weapon",  value: 70,  graphic: 516, damageBonus: 4,  weaponSubtype: "staff" },
  9:  { id: 9,  name: "Arco de caza",   type: "weapon",  value: 100, graphic: 520, damageBonus: 6,  weaponSubtype: "bow" },
  10: { id: 10, name: "Maza de hierro", type: "weapon",  value: 80,  graphic: 515, damageBonus: 5,  weaponSubtype: "mace" },
  11: { id: 11, name: "Espada real",    type: "weapon",  value: 250, graphic: 506, damageBonus: 13, weaponSubtype: "sword", minLevel: 5 },

  // ── ARMADURAS (cuerpo) ────────────────────────────────────────────────────
  12: { id: 12, name: "Túnica",             type: "armor", value: 15,  graphic: 525, defense: 0, armorSubtype: "robe" },
  4:  { id: 4,  name: "Armadura de cuero",  type: "armor", value: 40,  graphic: 526, defense: 2, armorSubtype: "light" },
  13: { id: 13, name: "Cuero tachado",      type: "armor", value: 60,  graphic: 527, defense: 3, armorSubtype: "light" },
  14: { id: 14, name: "Cota de malla",      type: "armor", value: 130, graphic: 528, defense: 5, armorSubtype: "medium", minLevel: 3 },
  15: { id: 15, name: "Armadura de placas", type: "armor", value: 320, graphic: 529, defense: 8, armorSubtype: "heavy",  minLevel: 6 },

  // ── CASCOS ────────────────────────────────────────────────────────────────
  16: { id: 16, name: "Capucha",         type: "helmet", value: 10,  graphic: 558, defense: 0, armorSubtype: "robe" },
  17: { id: 17, name: "Casco de cuero",  type: "helmet", value: 30,  graphic: 560, defense: 1, armorSubtype: "light" },
  5:  { id: 5,  name: "Casco de hierro", type: "helmet", value: 20,  graphic: 559, defense: 1, armorSubtype: "medium" },
  18: { id: 18, name: "Yelmo de acero",  type: "helmet", value: 220, graphic: 562, defense: 3, armorSubtype: "heavy",  minLevel: 5 },

  // ── ESCUDOS ───────────────────────────────────────────────────────────────
  19: { id: 19, name: "Escudo de madera",  type: "shield", value: 20,  graphic: 533, defense: 1, armorSubtype: "light" },
  20: { id: 20, name: "Escudo de hierro",  type: "shield", value: 110, graphic: 534, defense: 3, armorSubtype: "medium", minLevel: 3 },
};

export function getItem(id: number): ItemDef | undefined {
  return ITEMS[id];
}

// Una posición de inventario: un item y su cantidad (para apilables como pociones).
export interface InventorySlot {
  readonly item: number;
  readonly qty: number;
}
