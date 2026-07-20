import type { Direction, Vector2 } from "@ao/shared";
import { isWalkable, type MapState } from "./maps.js";

// Cooldown mínimo entre movimientos exitosos en el SERVER. El cliente predice y
// manda pasos cada ~200ms (5 tiles/s); el server usa un umbral MÁS BAJO (150ms)
// como MARGEN para el jitter de red: así un paso legítimo del cliente nunca se
// rechaza por cooldown (lo que provocaba una corrección y un tirón/snap-back
// cada pocos pasos). 150 da 50ms de margen — clave contra el rubber-banding en
// conexiones con jitter (Argentina→São Paulo). El anti-speedhack se hace por
// otras vías, no achicando este margen (subirlo a 180 causaba lag de movimiento).
export const MOVE_COOLDOWN_MS = 150;

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
  // Navegando: solo se mueve por agua (a pie, solo por tierra).
  readonly navigating?: boolean;
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

  if (!isWalkable(input.map, target.x, target.y, input.navigating ?? false)) {
    return { ok: false, reason: "BLOCKED" };
  }

  if (input.isOccupied(target)) {
    return { ok: false, reason: "OCCUPIED" };
  }

  return { ok: true, newPosition: target, direction: input.direction };
}
