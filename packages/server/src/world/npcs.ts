import type { Direction, Vector2 } from "@ao/shared";
import { getMap, isWalkable } from "./maps.js";

// IDs de NPC viven en un espacio separado del de personajes (serial de la DB)
// para que nunca colisionen. Los personajes no llegan a 1.000.000 en el MVP.
export const NPC_ID_BASE = 1_000_000;

export function isNpcId(id: number): boolean {
  return id >= NPC_ID_BASE;
}

// Definición de un tipo de NPC (plantilla compartida por todas sus instancias).
export interface NpcType {
  readonly key: string;
  readonly name: string;
  readonly graphic: number; // sprite AO (placeholder por ahora; el cliente usa marcador)
  readonly maxHp: number;
  readonly damageMin: number;
  readonly damageMax: number;
  readonly attackCooldownMs: number;
  readonly aggroRadius: number; // en tiles
  readonly moveCooldownMs: number;
  readonly xpReward: number;
  readonly respawnMs: number;
}

const NPC_TYPES: Record<string, NpcType> = {
  rata: {
    key: "rata",
    name: "Rata gigante",
    graphic: 0,
    maxHp: 12,
    damageMin: 1,
    damageMax: 3,
    attackCooldownMs: 1200,
    aggroRadius: 5,
    moveCooldownMs: 500,
    xpReward: 8,
    respawnMs: 8_000,
  },
  lobo: {
    key: "lobo",
    name: "Lobo",
    graphic: 0,
    maxHp: 26,
    damageMin: 2,
    damageMax: 5,
    attackCooldownMs: 1000,
    aggroRadius: 6,
    moveCooldownMs: 420,
    xpReward: 20,
    respawnMs: 12_000,
  },
};

// Instancia viva de un NPC en el mundo.
export interface NpcInstance {
  readonly id: number;
  readonly type: NpcType;
  readonly mapId: number;
  readonly spawn: Vector2; // punto de respawn fijo
  position: Vector2;
  direction: Direction;
  hp: number;
  deadUntil: number; // 0 = vivo; si > 0, epoch ms del respawn
  lastMoveAt: number;
  lastAttackAt: number;
  targetCharacterId: number | null;
}

// Dónde aparecen los NPCs de cada mapa: tipo + posición deseada. Si la
// posición cae en un tile bloqueado, se busca el caminable más cercano.
interface NpcSpawnDef {
  typeKey: string;
  at: Vector2;
}

const SPAWN_DEFS: Record<number, NpcSpawnDef[]> = {
  // Ullathorpe (mapa 1): unas ratas y lobos alrededor de la plaza (spawn ~25,25).
  1: [
    { typeKey: "rata", at: { x: 28, y: 24 } },
    { typeKey: "rata", at: { x: 22, y: 27 } },
    { typeKey: "rata", at: { x: 30, y: 30 } },
    { typeKey: "lobo", at: { x: 20, y: 22 } },
    { typeKey: "lobo", at: { x: 32, y: 26 } },
  ],
};

function findWalkableNear(mapId: number, origin: Vector2): Vector2 {
  const map = getMap(mapId);
  if (!map) return origin;
  if (isWalkable(map, origin.x, origin.y)) return origin;
  for (let r = 1; r < 12; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (isWalkable(map, x, y)) return { x, y };
      }
    }
  }
  return origin;
}

class NpcRegistry {
  private readonly byId = new Map<number, NpcInstance>();
  private nextId = NPC_ID_BASE + 1;

  // Crea las instancias iniciales a partir de SPAWN_DEFS. Idempotente.
  init(): void {
    if (this.byId.size > 0) return;
    for (const [mapIdStr, defs] of Object.entries(SPAWN_DEFS)) {
      const mapId = Number(mapIdStr);
      for (const def of defs) {
        const type = NPC_TYPES[def.typeKey];
        if (!type) continue;
        const pos = findWalkableNear(mapId, def.at);
        const id = this.nextId++;
        this.byId.set(id, {
          id,
          type,
          mapId,
          spawn: { x: pos.x, y: pos.y },
          position: { x: pos.x, y: pos.y },
          direction: "south",
          hp: type.maxHp,
          deadUntil: 0,
          lastMoveAt: 0,
          lastAttackAt: 0,
          targetCharacterId: null,
        });
      }
    }
  }

  get(id: number): NpcInstance | undefined {
    return this.byId.get(id);
  }

  all(): IterableIterator<NpcInstance> {
    return this.byId.values();
  }

  inMap(mapId: number): NpcInstance[] {
    const out: NpcInstance[] = [];
    for (const n of this.byId.values()) {
      if (n.mapId === mapId) out.push(n);
    }
    return out;
  }
}

export const npcs = new NpcRegistry();

// Daño de un golpe de NPC, en su rango [damageMin, damageMax].
export function rollNpcDamage(type: NpcType, rng: () => number = Math.random): number {
  const span = type.damageMax - type.damageMin + 1;
  return type.damageMin + Math.floor(rng() * span);
}
