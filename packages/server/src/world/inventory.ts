import { getItem, type InventorySlot } from "@ao/shared";

export function countItem(slots: readonly InventorySlot[], item: number): number {
  return slots.find((s) => s.item === item)?.qty ?? 0;
}

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

export function weaponBonusFor(equippedWeapon: number | null): number {
  if (equippedWeapon === null) return 0;
  const def = getItem(equippedWeapon);
  return def?.type === "weapon" ? (def.damageBonus ?? 0) : 0;
}

export function armorDefenseFor(equippedArmor: number | null): number {
  if (equippedArmor === null) return 0;
  const def = getItem(equippedArmor);
  return def?.type === "armor" ? (def.defense ?? 0) : 0;
}

export function helmetDefenseFor(equippedHelmet: number | null): number {
  if (equippedHelmet === null) return 0;
  const def = getItem(equippedHelmet);
  return def?.type === "helmet" ? (def.defense ?? 0) : 0;
}

export function shieldDefenseFor(equippedShield: number | null): number {
  if (equippedShield === null) return 0;
  const def = getItem(equippedShield);
  return def?.type === "shield" ? (def.defense ?? 0) : 0;
}

export function totalArmorDefense(
  armor: number | null,
  helmet: number | null,
  shield: number | null,
): number {
  return armorDefenseFor(armor) + helmetDefenseFor(helmet) + shieldDefenseFor(shield);
}
