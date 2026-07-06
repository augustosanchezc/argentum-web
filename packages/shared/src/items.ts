// Catálogo de items del MVP (E-3.3). Compartido para que server (aplica
// efectos) y cliente (renderiza inventario y tienda) coincidan.

export type ItemType = "weapon" | "armor" | "potion";

export interface ItemDef {
  readonly id: number;
  readonly name: string;
  readonly type: ItemType;
  // Precio de compra en la tienda (la venta suele ser una fracción).
  readonly value: number;
  readonly graphic: number; // sprite AO (placeholder por ahora)
  readonly damageBonus?: number; // arma
  readonly defense?: number; // armadura (reduce daño recibido)
  readonly heal?: number; // poción (cura HP al usar)
}

// 5 items base del MVP. Los `graphic` son los GrhIndex del AO clásico
// (obj.dat del server ao-libre) para reusar el mismo tileset del mapa.
export const ITEMS: Record<number, ItemDef> = {
  1: { id: 1, name: "Poción menor", type: "potion", value: 10, graphic: 542, heal: 15 },
  2: { id: 2, name: "Daga", type: "weapon", value: 25, graphic: 510, damageBonus: 3 },
  3: { id: 3, name: "Espada larga", type: "weapon", value: 80, graphic: 504, damageBonus: 7 },
  4: { id: 4, name: "Armadura de cuero", type: "armor", value: 40, graphic: 526, defense: 2 },
  5: { id: 5, name: "Casco de hierro", type: "armor", value: 20, graphic: 559, defense: 1 },
};

export function getItem(id: number): ItemDef | undefined {
  return ITEMS[id];
}

// Una posición de inventario: un item y su cantidad (para apilables como pociones).
export interface InventorySlot {
  readonly item: number;
  readonly qty: number;
}
