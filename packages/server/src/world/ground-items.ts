import type { Vector2 } from "@ao/shared";

// Items tirados en el suelo. IDs en su propio espacio (>= 2.000.000) para no
// colisionar con personajes (serial) ni NPCs (>= 1.000.000).
export const GROUND_ID_BASE = 2_000_000;

export interface GroundItem {
  readonly id: number;
  readonly mapId: number;
  readonly position: Vector2;
  readonly item: number;
  readonly qty: number;
}

// Tope de items en el suelo por mapa (anti-DoS de memoria): al superarlo, el
// más viejo del mapa se elimina. El caller broadcastea su despawn (evicted).
const MAX_GROUND_ITEMS_PER_MAP = 500;

class GroundItemRegistry {
  private readonly byId = new Map<number, GroundItem>();
  private nextId = GROUND_ID_BASE + 1;

  spawn(
    mapId: number,
    position: Vector2,
    item: number,
    qty: number,
  ): GroundItem & { evictedId?: number } {
    let evictedId: number | undefined;
    // Map preserva orden de inserción → el primero del mapa es el más viejo.
    let count = 0;
    let oldest: number | undefined;
    for (const g of this.byId.values()) {
      if (g.mapId !== mapId) continue;
      count += 1;
      oldest ??= g.id;
    }
    if (count >= MAX_GROUND_ITEMS_PER_MAP && oldest !== undefined) {
      this.byId.delete(oldest);
      evictedId = oldest;
    }
    const id = this.nextId++;
    const g: GroundItem = { id, mapId, position: { x: position.x, y: position.y }, item, qty };
    this.byId.set(id, g);
    return evictedId !== undefined ? { ...g, evictedId } : g;
  }

  remove(id: number): void {
    this.byId.delete(id);
  }

  get(id: number): GroundItem | undefined {
    return this.byId.get(id);
  }

  inMap(mapId: number): GroundItem[] {
    const out: GroundItem[] = [];
    for (const g of this.byId.values()) {
      if (g.mapId === mapId) out.push(g);
    }
    return out;
  }

  // Primer item en el tile indicado (el que se recoge con PICKUP).
  atTile(mapId: number, pos: Vector2): GroundItem | undefined {
    for (const g of this.byId.values()) {
      if (g.mapId === mapId && g.position.x === pos.x && g.position.y === pos.y) return g;
    }
    return undefined;
  }
}

export const groundItems = new GroundItemRegistry();
