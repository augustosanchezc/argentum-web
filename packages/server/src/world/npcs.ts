import type { Direction, Vector2 } from "@ao/shared";
import { getMap, isWalkable } from "./maps.js";

// IDs de NPC viven en un espacio separado del de personajes (serial de la DB)
// para que nunca colisionen. Los personajes no llegan a 1.000.000 en el MVP.
export const NPC_ID_BASE = 1_000_000;

export function isNpcId(id: number): boolean {
  return id >= NPC_ID_BASE;
}

// Un drop posible al morir el NPC: item del catálogo + probabilidad [0..1].
export interface NpcDrop {
  readonly item: number;
  readonly chance: number;
}

// Definición de un tipo de NPC (plantilla compartida por todas sus instancias).
export interface NpcType {
  readonly key: string;
  readonly name: string;
  // Sprite legacy del AO (Graficos.ind) — se usa cuando el NPC no tiene
  // body/head (típico de monstruos: rata, lobo, dragón, un sprite único).
  readonly graphic: number;
  // Sprite del sistema de personajes (Personajes.ind / Cabezas.ind), típico
  // de NPCs humanoides como el mercader o los guardias. Si están definidos,
  // el cliente los prefiere sobre `graphic`.
  readonly bodyId?: number;
  readonly headId?: number;
  readonly maxHp: number;
  readonly damageMin: number;
  readonly damageMax: number;
  readonly attackCooldownMs: number;
  readonly aggroRadius: number; // en tiles
  readonly moveCooldownMs: number;
  readonly xpReward: number;
  readonly respawnMs: number;
  readonly hostile: boolean;
  readonly merchant: boolean;
  readonly banker: boolean;
  readonly goldMin: number;
  readonly goldMax: number;
  readonly drops: readonly NpcDrop[];
  // Items que ofrece si es comerciante (ids del catálogo).
  readonly shopOffers: readonly number[];
}

const NPC_TYPES: Record<string, NpcType> = {
  rata: {
    key: "rata",
    name: "Rata gigante",
    graphic: 0,
    // Personajes.ini body 71 (rata clásica del AO).
    bodyId: 71,
    headId: 0,
    maxHp: 12,
    damageMin: 1,
    damageMax: 3,
    attackCooldownMs: 1200,
    aggroRadius: 5,
    moveCooldownMs: 500,
    xpReward: 8,
    respawnMs: 8_000,
    hostile: true,
    merchant: false,
    banker: false,
    goldMin: 2,
    goldMax: 6,
    drops: [{ item: 1, chance: 0.5 }], // poción menor
    shopOffers: [],
  },
  lobo: {
    key: "lobo",
    name: "Lobo",
    graphic: 0,
    // Personajes.ini body 10 (lobo clásico del AO).
    bodyId: 10,
    headId: 0,
    maxHp: 26,
    damageMin: 2,
    damageMax: 5,
    attackCooldownMs: 1000,
    aggroRadius: 6,
    moveCooldownMs: 420,
    xpReward: 20,
    respawnMs: 12_000,
    hostile: true,
    merchant: false,
    banker: false,
    goldMin: 5,
    goldMax: 12,
    drops: [
      { item: 1, chance: 0.4 }, // poción
      { item: 2, chance: 0.25 }, // daga
    ],
    shopOffers: [],
  },
  mercader: {
    key: "mercader",
    name: "Mercader",
    graphic: 0,
    // Humanoide: reutiliza el mismo body/head del jugador por ahora. Cuando
    // saquemos sprites customizados para NPCs los cambiamos aca.
    bodyId: 1,
    headId: 1,
    maxHp: 50,
    damageMin: 0,
    damageMax: 0,
    attackCooldownMs: 0,
    aggroRadius: 0,
    moveCooldownMs: 0,
    xpReward: 0,
    respawnMs: 0,
    hostile: false,
    merchant: true,
    banker: false,
    goldMin: 0,
    goldMax: 0,
    drops: [],
    shopOffers: [1, 2, 3, 4, 5],
  },
  banquero: {
    key: "banquero",
    name: "Banquero",
    graphic: 0,
    bodyId: 1,
    headId: 1,
    maxHp: 999,
    damageMin: 0,
    damageMax: 0,
    attackCooldownMs: 0,
    aggroRadius: 0,
    moveCooldownMs: 0,
    xpReward: 0,
    respawnMs: 0,
    hostile: false,
    merchant: false,
    banker: true,
    goldMin: 0,
    goldMax: 0,
    drops: [],
    shopOffers: [],
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
  // Ullathorpe (mapa 1): ratas y lobos alrededor de la plaza (spawn ~25,25).
  1: [
    { typeKey: "rata", at: { x: 28, y: 24 } },
    { typeKey: "rata", at: { x: 22, y: 27 } },
    { typeKey: "rata", at: { x: 30, y: 30 } },
    { typeKey: "lobo", at: { x: 20, y: 22 } },
    { typeKey: "lobo", at: { x: 32, y: 26 } },
    { typeKey: "mercader", at: { x: 26, y: 25 } },
    { typeKey: "banquero", at: { x: 24, y: 25 } },
  ],
  // Sur de Ullathorpe (mapa 2): campo abierto con ratas y lobos.
  2: [
    { typeKey: "rata", at: { x: 30, y: 30 } },
    { typeKey: "rata", at: { x: 40, y: 25 } },
    { typeKey: "rata", at: { x: 25, y: 45 } },
    { typeKey: "lobo", at: { x: 50, y: 30 } },
    { typeKey: "lobo", at: { x: 35, y: 50 } },
  ],
  // Norte de Ullathorpe (mapa 5): bosque con lobos predominantes.
  5: [
    { typeKey: "lobo", at: { x: 30, y: 20 } },
    { typeKey: "lobo", at: { x: 45, y: 35 } },
    { typeKey: "lobo", at: { x: 25, y: 50 } },
    { typeKey: "rata", at: { x: 55, y: 40 } },
    { typeKey: "rata", at: { x: 20, y: 35 } },
  ],
  // Camino del Oeste (mapa 8): mezcla equilibrada.
  8: [
    { typeKey: "rata", at: { x: 20, y: 30 } },
    { typeKey: "rata", at: { x: 35, y: 20 } },
    { typeKey: "lobo", at: { x: 45, y: 40 } },
    { typeKey: "lobo", at: { x: 25, y: 55 } },
  ],
  // Camino del Este (mapa 11): mezcla equilibrada.
  11: [
    { typeKey: "rata", at: { x: 30, y: 25 } },
    { typeKey: "rata", at: { x: 50, y: 35 } },
    { typeKey: "lobo", at: { x: 40, y: 45 } },
    { typeKey: "lobo", at: { x: 20, y: 40 } },
  ],
  // Sótanos de Ullathorpe (mapa 40): dungeon — más lobos, sin mercaderes.
  40: [
    { typeKey: "lobo", at: { x: 25, y: 25 } },
    { typeKey: "lobo", at: { x: 35, y: 30 } },
    { typeKey: "lobo", at: { x: 20, y: 40 } },
    { typeKey: "rata", at: { x: 40, y: 20 } },
    { typeKey: "rata", at: { x: 30, y: 45 } },
    { typeKey: "rata", at: { x: 45, y: 35 } },
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

// Oro que suelta un NPC al morir, en su rango [goldMin, goldMax].
export function rollNpcGold(type: NpcType, rng: () => number = Math.random): number {
  if (type.goldMax <= 0) return 0;
  const span = type.goldMax - type.goldMin + 1;
  return type.goldMin + Math.floor(rng() * span);
}
