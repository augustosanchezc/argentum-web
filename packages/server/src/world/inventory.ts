import { getItem, type InventorySlot } from "@ao/shared";

// Helpers puros sobre el arreglo de inventario. Devuelven un arreglo nuevo
// (no mutan el original) para que sea fácil razonar sobre los cambios.

export function countItem(slots: readonly InventorySlot[], item: number): number {
  return slots.find((s) => s.item === item)?.qty ?? 0;
}

// Suma qty de un item, apilando en la posición existente si la hay.
export function addItem(
  slots: readonly InventorySlot[],
  item: number,
  qty = 1,
): InventorySlot[] {
  const out = slots.map((s) => ({ ...s }));
  const existing = out.find((s) => s.item === item);
  if (existing) {
    existing.qty += qty;
  } else {
    out.push({ item, qty });
  }
  return out;
}

// Quita qty de un item. Devuelve null si no hay suficiente.
export function removeItem(
  slots: readonly InventorySlot[],
  item: number,
  qty = 1,
): InventorySlot[] | null {
  const current = countItem(slots, item);
  if (current < qty) return null;
  const out: InventorySlot[] = [];
  for (const s of slots) {
    if (s.item === item) {
      const left = s.qty - qty;
      if (left > 0) out.push({ item: s.item, qty: left });
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

// Quita qty desde un slot específico (por índice) y devuelve el nuevo
// inventario + el item / cantidad efectivamente retirados. Si el slot
// no existe o la cantidad es inválida, devuelve null.
export function removeFromSlot(
  slots: readonly InventorySlot[],
  slotIdx: number,
  qty: number,
): { slots: InventorySlot[]; item: number; qty: number } | null {
  if (slotIdx < 0 || slotIdx >= slots.length) return null;
  const src = slots[slotIdx];
  if (qty <= 0 || qty > src.qty) return null;
  const out: InventorySlot[] = [];
  for (let i = 0; i < slots.length; i += 1) {
    if (i === slotIdx) {
      const left = src.qty - qty;
      if (left > 0) out.push({ item: src.item, qty: left });
    } else {
      out.push({ ...slots[i] });
    }
  }
  return { slots: out, item: src.item, qty };
}

// Intercambia dos slots del inventario. Si algún índice está fuera de rango,
// devuelve null. Si from === to, es no-op (devuelve una copia). Los slots
// vacíos son válidos (índices que no existen aún en el array son inválidos).
export function reorderSlots(
  slots: readonly InventorySlot[],
  from: number,
  to: number,
): InventorySlot[] | null {
  if (from < 0 || to < 0 || from >= slots.length || to >= slots.length) return null;
  if (from === to) return slots.map((s) => ({ ...s }));
  const out = slots.map((s) => ({ ...s }));
  const tmp = out[from];
  out[from] = out[to];
  out[to] = tmp;
  return out;
}

// Bono de daño del arma equipada (0 si no hay o no es arma).
export function weaponBonusFor(equippedWeapon: number | null): number {
  if (equippedWeapon === null) return 0;
  const def = getItem(equippedWeapon);
  return def?.type === "weapon" ? (def.damageBonus ?? 0) : 0;
}

// Defensa de la armadura equipada (reduce daño recibido).
export function armorDefenseFor(equippedArmor: number | null): number {
  if (equippedArmor === null) return 0;
  const def = getItem(equippedArmor);
  return def?.type === "armor" ? (def.defense ?? 0) : 0;
}
