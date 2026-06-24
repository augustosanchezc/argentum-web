import type { Direction, Vector2 } from "@ao/shared";
import { isWalkable, type MapState } from "./maps.js";

// Cooldown minimo entre movimientos exitosos. 200ms = 5 tiles/s.
// El AO original era ~6 tiles/s, pero 5 deja margen para latencia
// sin que el server rechace por cooldown.
export const MOVE_COOLDOWN_MS = 200;

const DELTAS: Record<Direction, Vector2> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

export interface MoveAttemptInput {
  readonly position: Vector2;
  readonly lastMoveAt: number;
  readonly direction: Direction;
  readonly now: number;
  readonly map: MapState;
  readonly isOccupied: (pos: Vector2) => boolean;
}

export type MoveAttemptResult =
  | { ok: true; newPosition: Vector2; direction: Direction }
  | { ok: false; reason: "COOLDOWN" | "BLOCKED" | "OCCUPIED" };

export function attemptMove(input: MoveAttemptInput): MoveAttemptResult {
  if (input.now - input.lastMoveAt < MOVE_COOLDOWN_MS) {
    return { ok: false, reason: "COOLDOWN" };
  }

  const delta = DELTAS[input.direction];
  const target: Vector2 = {
    x: input.position.x + delta.x,
    y: input.position.y + delta.y,
  };

  if (!isWalkable(input.map, target.x, target.y)) {
    return { ok: false, reason: "BLOCKED" };
  }

  if (input.isOccupied(target)) {
    return { ok: false, reason: "OCCUPIED" };
  }

  return { ok: true, newPosition: target, direction: input.direction };
}
