import { addItem, countItem, removeItem } from "./inventory.js";
import type { Session } from "../ws/sessions.js";

// Operaciones de banco (E-4.2). Todas son síncronas — Node.js es single-threaded,
// por lo que la secuencia validate→mutate es atómica dentro de un handler de mensaje.
// Ver ADR-007 para el análisis de atomicidad.

export function bankDepositItem(s: Session, item: number, qty: number): boolean {
  if (qty <= 0) return false;
  if (countItem(s.inventory, item) < qty) return false;
  const next = removeItem(s.inventory, item, qty);
  if (!next) return false;
  s.inventory = next;
  s.bankInventory = addItem(s.bankInventory, item, qty);
  return true;
}

export function bankWithdrawItem(s: Session, item: number, qty: number): boolean {
  if (qty <= 0) return false;
  if (countItem(s.bankInventory, item) < qty) return false;
  const next = removeItem(s.bankInventory, item, qty);
  if (!next) return false;
  s.bankInventory = next;
  s.inventory = addItem(s.inventory, item, qty);
  return true;
}

export function bankDepositGold(s: Session, amount: number): boolean {
  if (amount <= 0 || s.gold < amount) return false;
  s.gold -= amount;
  s.bankGold += amount;
  return true;
}

export function bankWithdrawGold(s: Session, amount: number): boolean {
  if (amount <= 0 || s.bankGold < amount) return false;
  s.bankGold -= amount;
  s.gold += amount;
  return true;
}
