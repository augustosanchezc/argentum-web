import { addItem, carryCapacity, countItem, MAX_STACK, removeItem, sanQty } from "./inventory.js";
import type { Session } from "../ws/sessions.js";

// Operaciones de banco (E-4.2). Todas son síncronas — Node.js es single-threaded,
// por lo que la secuencia validate→mutate es atómica dentro de un handler de mensaje.
// Ver ADR-007 para el análisis de atomicidad.
// Las cantidades vienen del cliente: sanQty() las fuerza a entero positivo
// (NaN/decimales/negativos evadían los `<= 0` y corrompían oro/stacks).

const MAX_GOLD_OP = 1_000_000_000;

export function bankDepositItem(s: Session, item: number, rawQty: number): boolean {
  const qty = sanQty(rawQty);
  if (qty === 0) return false;
  if (countItem(s.inventory, item) < qty) return false;
  // Tope de stack en el banco (10k por slot, igual que el inventario).
  if (countItem(s.bankInventory, item) + qty > MAX_STACK) return false;
  const next = removeItem(s.inventory, item, qty);
  if (!next) return false;
  s.inventory = next;
  s.bankInventory = addItem(s.bankInventory, item, qty);
  return true;
}

export function bankWithdrawItem(s: Session, item: number, rawQty: number): boolean {
  const qty = sanQty(rawQty);
  if (qty === 0) return false;
  if (countItem(s.bankInventory, item) < qty) return false;
  // Debe entrar en el inventario (stack 10k + 24 slots).
  if (carryCapacity(s.inventory, item) < qty) return false;
  const next = removeItem(s.bankInventory, item, qty);
  if (!next) return false;
  s.bankInventory = next;
  s.inventory = addItem(s.inventory, item, qty);
  return true;
}

export function bankDepositGold(s: Session, rawAmount: number): boolean {
  const amount = sanQty(rawAmount, MAX_GOLD_OP);
  if (amount === 0 || s.gold < amount) return false;
  s.gold -= amount;
  s.bankGold += amount;
  return true;
}

export function bankWithdrawGold(s: Session, rawAmount: number): boolean {
  const amount = sanQty(rawAmount, MAX_GOLD_OP);
  if (amount === 0 || s.bankGold < amount) return false;
  s.bankGold -= amount;
  s.gold += amount;
  return true;
}
