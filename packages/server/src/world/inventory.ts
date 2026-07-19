import { getItem, type InventorySlot } from "@ao/shared";

// Tope de apilado por slot (como el cliente asume) y de oro por request.
export const MAX_STACK = 10_000;
// Tope de slots del inventario (la grilla del cliente muestra 24).
export const MAX_SLOTS = 24;

// Cuántas unidades más de `item` entran en el inventario: si ya hay un stack,
// lo que falta hasta MAX_STACK; si no, MAX_STACK solo si queda slot libre.
export function carryCapacity(slots: readonly InventorySlot[], item: number): number {
  const existing = slots.find((s) => s.item === item);
  if (existing) return Math.max(0, MAX_STACK - existing.qty);
  return slots.length < MAX_SLOTS ? MAX_STACK : 0;
}

// Sanitiza una cantidad venida DEL CLIENTE: entero positivo finito (clamp a
// max) o 0 si es inválida (NaN, Infinity, negativa, decimal, no-número).
// NaN evade los chequeos `<= 0` (NaN <= 0 es false) y corrompía oro/stacks.
export function sanQty(v: unknown, max: number = MAX_STACK): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  const n = Math.floor(v);
  return n > 0 ? Math.min(n, max) : 0;
}

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
  // Clamp defensivo al tope de stack (los callers validan con carryCapacity;
  // esto evita stacks absurdos por cualquier vía que se escape).
  if (existing) {
    existing.qty = Math.min(MAX_STACK, existing.qty + qty);
  } else {
    out.push({ item, qty: Math.min(qty, MAX_STACK) });
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
  if (from < 0 || from >= slots.length || to < 0) return null;
  const out = slots.map((s) => ({ ...s }));
  // El inventario es "empacado" (sin huecos): soltar en una celda vacía (to
  // fuera de rango) mueve el item al final = primer espacio disponible. Se
  // MUEVE (splice) en vez de swap, para poder reubicarlo en cualquier posición.
  const dest = Math.min(to, out.length - 1);
  if (from === dest) return out;
  const [moved] = out.splice(from, 1);
  out.splice(dest, 0, moved);
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

// AO Libre: la defensa de cada pieza se tira RandomNumber(MinDef, MaxDef) en
// CADA golpe (SistemaCombate.bas), no es un valor fijo. Estas versiones tiran.
function rollDefOf(id: number | null, type: string): number {
  if (id === null) return 0;
  const def = getItem(id);
  if (def?.type !== type) return 0;
  const lo = def.defenseMin ?? def.defense ?? 0;
  const hi = def.defenseMax ?? def.defense ?? 0;
  return hi <= lo ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));
}

export function rollArmorDefenseFor(equippedArmor: number | null): number {
  return rollDefOf(equippedArmor, "armor");
}

export function rollTotalArmorDefense(
  armor: number | null,
  helmet: number | null,
  shield: number | null,
): number {
  return rollDefOf(armor, "armor") + rollDefOf(helmet, "helmet") + rollDefOf(shield, "shield");
}
