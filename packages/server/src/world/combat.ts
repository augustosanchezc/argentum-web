import type { Vector2 } from "@ao/shared";

// Cooldown mínimo entre ataques exitosos (E-2.2, T-041).
export const ATTACK_COOLDOWN_MS = 800;

// Tiempo que un personaje queda muerto antes de reaparecer (T-042).
export const RESPAWN_DELAY_MS = 3_000;

// Daño base por golpe a nivel 1. La variación escala con el nivel.
const BASE_DAMAGE = 5;

// Melee clásico de AO: solo se golpea el tile ortogonalmente adyacente
// (no diagonal). Distancia Manhattan == 1.
export function isAdjacent(a: Vector2, b: Vector2): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

// Daño de un golpe. Nivel 1 → 5..7; escala +2 de rango por nivel.
// Inyectable para tests deterministas.
export function rollDamage(
  attackerLevel: number,
  rng: () => number = Math.random,
): number {
  const variance = Math.floor(rng() * (attackerLevel * 2 + 1));
  return BASE_DAMAGE + variance;
}
