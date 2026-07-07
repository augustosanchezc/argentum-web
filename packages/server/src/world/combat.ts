import type { Vector2 } from "@ao/shared";
import { getItem } from "@ao/shared";

export const ATTACK_COOLDOWN_MS = 800;
export const RESPAWN_DELAY_MS = 3_000;

const BASE_DAMAGE = 3;

export function isAdjacent(a: Vector2, b: Vector2): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

// Daño de un golpe con stats completos (fórmula AO-like).
// Mínimo 1 de daño para que siempre haya impacto.
export function rollDamage(
  attackerLevel: number,
  weaponBonus = 0,
  attackerStr = 18,
  defenseBonus = 0,
  rng: () => number = Math.random,
): number {
  const variance = Math.floor(rng() * (attackerLevel * 2 + 1));
  const raw = BASE_DAMAGE + weaponBonus + Math.floor(attackerStr / 4) - defenseBonus + variance;
  return Math.max(1, raw);
}

// Defensa total del defensor: suma armadura + casco + escudo.
export function totalDefense(
  equippedArmor: number | null,
  equippedHelmet: number | null,
  equippedShield: number | null,
): number {
  let def = 0;
  if (equippedArmor !== null) {
    const d = getItem(equippedArmor);
    if (d) def += d.defense ?? 0;
  }
  if (equippedHelmet !== null) {
    const d = getItem(equippedHelmet);
    if (d) def += d.defense ?? 0;
  }
  if (equippedShield !== null) {
    const d = getItem(equippedShield);
    if (d) def += d.defense ?? 0;
  }
  return def;
}
