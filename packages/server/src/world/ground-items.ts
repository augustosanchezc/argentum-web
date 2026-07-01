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

class GroundItemRegistry {
  private readonly byId = new Map<number, GroundItem>();
  private nextId = GROUND_ID_BASE + 1;

  spawn(mapId: number, position: Vector2, item: number, qty: number): GroundItem {
    const id = this.nextId++;
    const g: GroundItem = { id, mapId, position: { x: position.x, y: position.y }, item, qty };
    this.byId.set(id, g);
    return g;
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
