import type { Direction, Vector2 } from "@ao/shared";
import { getMap, isWalkable } from "./maps.js";

export const NPC_ID_BASE = 1_000_000;

export function isNpcId(id: number): boolean {
  return id >= NPC_ID_BASE;
}

export interface NpcDrop {
  readonly item: number;
  readonly chance: number;
}

export interface NpcType {
  readonly key: string;
  readonly name: string;
  readonly graphic: number;
  readonly bodyId?: number;
  readonly headId?: number;
  readonly maxHp: number;
  readonly damageMin: number;
  readonly damageMax: number;
  readonly attackCooldownMs: number;
  readonly aggroRadius: number;
  readonly moveCooldownMs: number;
  readonly xpReward: number;
  readonly respawnMs: number;
  readonly hostile: boolean;
  readonly merchant: boolean;
  readonly banker: boolean;
  // Si true, solo ataca a jugadores criminales (guardias de ciudad)
  readonly isGuard?: boolean;
  readonly goldMin: number;
  readonly goldMax: number;
  readonly drops: readonly NpcDrop[];
  readonly shopOffers: readonly number[];
}

const NPC_TYPES: Record<string, NpcType> = {
  // ── Criaturas débiles ─────────────────────────────────────────────────────
  rata: {
    key: "rata", name: "Rata gigante", graphic: 0,
    bodyId: 71, headId: 0,
    maxHp: 12, damageMin: 1, damageMax: 3,
    attackCooldownMs: 1200, aggroRadius: 5, moveCooldownMs: 500,
    xpReward: 8, respawnMs: 8_000, hostile: true, merchant: false, banker: false,
    goldMin: 2, goldMax: 6,
    drops: [{ item: 1, chance: 0.5 }],
    shopOffers: [],
  },
  arana: {
    key: "arana", name: "Araña pequeña", graphic: 0,
    bodyId: 7, headId: 0,
    maxHp: 20, damageMin: 2, damageMax: 4,
    attackCooldownMs: 1400, aggroRadius: 4, moveCooldownMs: 600,
    xpReward: 14, respawnMs: 10_000, hostile: true, merchant: false, banker: false,
    goldMin: 3, goldMax: 8,
    drops: [{ item: 1, chance: 0.5 }],
    shopOffers: [],
  },
  vibora: {
    key: "vibora", name: "Víbora", graphic: 0,
    bodyId: 97, headId: 0,
    maxHp: 18, damageMin: 3, damageMax: 6,
    attackCooldownMs: 1300, aggroRadius: 5, moveCooldownMs: 550,
    xpReward: 18, respawnMs: 10_000, hostile: true, merchant: false, banker: false,
    goldMin: 4, goldMax: 10,
    drops: [{ item: 1, chance: 0.4 }],
    shopOffers: [],
  },
  // ── Criaturas medias ──────────────────────────────────────────────────────
  lobo: {
    key: "lobo", name: "Lobo", graphic: 0,
    bodyId: 10, headId: 0,
    maxHp: 26, damageMin: 2, damageMax: 5,
    attackCooldownMs: 1000, aggroRadius: 6, moveCooldownMs: 420,
    xpReward: 20, respawnMs: 12_000, hostile: true, merchant: false, banker: false,
    goldMin: 5, goldMax: 12,
    drops: [{ item: 1, chance: 0.4 }, { item: 2, chance: 0.25 }],
    shopOffers: [],
  },
  oso: {
    key: "oso", name: "Oso pardo", graphic: 0,
    bodyId: 8, headId: 0,
    maxHp: 60, damageMin: 5, damageMax: 9,
    attackCooldownMs: 1000, aggroRadius: 6, moveCooldownMs: 450,
    xpReward: 40, respawnMs: 20_000, hostile: true, merchant: false, banker: false,
    goldMin: 10, goldMax: 25,
    drops: [{ item: 4, chance: 0.3 }],
    shopOffers: [],
  },
  goblin: {
    key: "goblin", name: "Goblin", graphic: 0,
    bodyId: 33, headId: 0,
    maxHp: 45, damageMin: 4, damageMax: 8,
    attackCooldownMs: 1100, aggroRadius: 7, moveCooldownMs: 400,
    xpReward: 30, respawnMs: 15_000, hostile: true, merchant: false, banker: false,
    goldMin: 8, goldMax: 20,
    drops: [{ item: 2, chance: 0.4 }, { item: 1, chance: 0.3 }],
    shopOffers: [],
  },
  esqueleto: {
    key: "esqueleto", name: "Esqueleto", graphic: 0,
    bodyId: 15, headId: 0,
    maxHp: 70, damageMin: 6, damageMax: 10,
    attackCooldownMs: 1000, aggroRadius: 6, moveCooldownMs: 450,
    xpReward: 50, respawnMs: 20_000, hostile: true, merchant: false, banker: false,
    goldMin: 15, goldMax: 35,
    drops: [{ item: 5, chance: 0.3 }, { item: 1, chance: 0.5 }],
    shopOffers: [],
  },
  // ── Criaturas difíciles ───────────────────────────────────────────────────
  zombie: {
    key: "zombie", name: "Zombie", graphic: 0,
    bodyId: 24, headId: 0,
    maxHp: 90, damageMin: 8, damageMax: 14,
    attackCooldownMs: 1200, aggroRadius: 5, moveCooldownMs: 600,
    xpReward: 70, respawnMs: 25_000, hostile: true, merchant: false, banker: false,
    goldMin: 20, goldMax: 50,
    drops: [{ item: 13, chance: 0.2 }, { item: 1, chance: 0.6 }],
    shopOffers: [],
  },
  vampiro: {
    key: "vampiro", name: "Vampiro", graphic: 0,
    bodyId: 12, headId: 0,
    maxHp: 150, damageMin: 12, damageMax: 20,
    attackCooldownMs: 900, aggroRadius: 8, moveCooldownMs: 350,
    xpReward: 120, respawnMs: 60_000, hostile: true, merchant: false, banker: false,
    goldMin: 40, goldMax: 100,
    drops: [{ item: 3, chance: 0.3 }, { item: 21, chance: 0.5 }],
    shopOffers: [],
  },
  orco: {
    key: "orco", name: "Orco", graphic: 0,
    bodyId: 42, headId: 0,
    maxHp: 110, damageMin: 10, damageMax: 16,
    attackCooldownMs: 1000, aggroRadius: 6, moveCooldownMs: 420,
    xpReward: 85, respawnMs: 30_000, hostile: true, merchant: false, banker: false,
    goldMin: 30, goldMax: 70,
    drops: [{ item: 7, chance: 0.2 }, { item: 1, chance: 0.4 }],
    shopOffers: [],
  },
  trol: {
    key: "trol", name: "Trol", graphic: 0,
    bodyId: 25, headId: 0,
    maxHp: 180, damageMin: 14, damageMax: 22,
    attackCooldownMs: 1100, aggroRadius: 7, moveCooldownMs: 500,
    xpReward: 150, respawnMs: 60_000, hostile: true, merchant: false, banker: false,
    goldMin: 50, goldMax: 120,
    drops: [{ item: 14, chance: 0.2 }, { item: 20, chance: 0.15 }],
    shopOffers: [],
  },
  dragon_verde: {
    key: "dragon_verde", name: "Dragón verde", graphic: 0,
    bodyId: 5, headId: 0,
    maxHp: 500, damageMin: 20, damageMax: 35,
    attackCooldownMs: 800, aggroRadius: 10, moveCooldownMs: 400,
    xpReward: 400, respawnMs: 300_000, hostile: true, merchant: false, banker: false,
    goldMin: 200, goldMax: 500,
    drops: [{ item: 11, chance: 0.4 }, { item: 15, chance: 0.3 }, { item: 18, chance: 0.25 }],
    shopOffers: [],
  },
  // ── NPCs de servicio y guardias ──────────────────────────────────────────
  guardia: {
    key: "guardia", name: "Guardia Real", graphic: 0,
    bodyId: 1, headId: 2,
    maxHp: 500, damageMin: 30, damageMax: 50,
    attackCooldownMs: 800, aggroRadius: 15, moveCooldownMs: 300,
    xpReward: 0, respawnMs: 0, hostile: true, isGuard: true, merchant: false, banker: false,
    goldMin: 0, goldMax: 0,
    drops: [],
    shopOffers: [],
  },
  mercader: {
    key: "mercader", name: "Mercader", graphic: 0,
    bodyId: 1, headId: 1,
    maxHp: 50, damageMin: 0, damageMax: 0,
    attackCooldownMs: 0, aggroRadius: 0, moveCooldownMs: 0,
    xpReward: 0, respawnMs: 0, hostile: false, merchant: true, banker: false,
    goldMin: 0, goldMax: 0,
    drops: [],
    shopOffers: [1, 2, 6, 8, 12, 21, 22],
  },
  banquero: {
    key: "banquero", name: "Banquero", graphic: 0,
    bodyId: 1, headId: 1,
    maxHp: 999, damageMin: 0, damageMax: 0,
    attackCooldownMs: 0, aggroRadius: 0, moveCooldownMs: 0,
    xpReward: 0, respawnMs: 0, hostile: false, merchant: false, banker: true,
    goldMin: 0, goldMax: 0,
    drops: [],
    shopOffers: [],
  },
};

export interface NpcInstance {
  readonly id: number;
  readonly type: NpcType;
  readonly mapId: number;
  readonly spawn: Vector2;
  position: Vector2;
  direction: Direction;
  hp: number;
  deadUntil: number;
  lastMoveAt: number;
  lastAttackAt: number;
  targetCharacterId: number | null;
}

interface NpcSpawnDef {
  typeKey: string;
  at: Vector2;
}

const SPAWN_DEFS: Record<number, NpcSpawnDef[]> = {
  // Mapa 1 — Ullathorpe (ciudad): criaturas débiles + NPCs de servicio
  1: [
    { typeKey: "rata",     at: { x: 28, y: 24 } },
    { typeKey: "rata",     at: { x: 22, y: 27 } },
    { typeKey: "rata",     at: { x: 30, y: 30 } },
    { typeKey: "arana",    at: { x: 20, y: 30 } },
    { typeKey: "arana",    at: { x: 32, y: 22 } },
    { typeKey: "lobo",     at: { x: 20, y: 22 } },
    { typeKey: "lobo",     at: { x: 32, y: 26 } },
    { typeKey: "mercader", at: { x: 26, y: 25 } },
    { typeKey: "banquero", at: { x: 24, y: 25 } },
    { typeKey: "guardia",  at: { x: 23, y: 24 } },
    { typeKey: "guardia",  at: { x: 27, y: 24 } },
  ],
  // Mapa 2 — Sur de Ullathorpe: ratas, víboras, arañas
  2: [
    { typeKey: "rata",   at: { x: 30, y: 30 } },
    { typeKey: "rata",   at: { x: 40, y: 25 } },
    { typeKey: "rata",   at: { x: 25, y: 45 } },
    { typeKey: "vibora", at: { x: 45, y: 35 } },
    { typeKey: "vibora", at: { x: 35, y: 50 } },
    { typeKey: "vibora", at: { x: 20, y: 38 } },
    { typeKey: "arana",  at: { x: 50, y: 30 } },
    { typeKey: "arana",  at: { x: 28, y: 55 } },
  ],
  // Mapa 5 — Norte de Ullathorpe: bosque con lobos y osos
  5: [
    { typeKey: "lobo", at: { x: 30, y: 20 } },
    { typeKey: "lobo", at: { x: 45, y: 35 } },
    { typeKey: "lobo", at: { x: 25, y: 50 } },
    { typeKey: "lobo", at: { x: 55, y: 45 } },
    { typeKey: "oso",  at: { x: 40, y: 25 } },
    { typeKey: "oso",  at: { x: 20, y: 40 } },
  ],
  // Mapa 8 — Camino del Oeste: goblins y lobos
  8: [
    { typeKey: "goblin", at: { x: 20, y: 30 } },
    { typeKey: "goblin", at: { x: 35, y: 20 } },
    { typeKey: "goblin", at: { x: 45, y: 40 } },
    { typeKey: "goblin", at: { x: 25, y: 55 } },
    { typeKey: "lobo",   at: { x: 50, y: 25 } },
    { typeKey: "lobo",   at: { x: 30, y: 45 } },
  ],
  // Mapa 11 — Camino del Este: goblins y esqueletos
  11: [
    { typeKey: "goblin",    at: { x: 30, y: 25 } },
    { typeKey: "goblin",    at: { x: 50, y: 35 } },
    { typeKey: "goblin",    at: { x: 20, y: 45 } },
    { typeKey: "esqueleto", at: { x: 40, y: 45 } },
    { typeKey: "esqueleto", at: { x: 25, y: 30 } },
    { typeKey: "esqueleto", at: { x: 55, y: 50 } },
  ],
  // Mapa 40 — Sótanos de Ullathorpe: dungeon difícil
  40: [
    { typeKey: "zombie",      at: { x: 25, y: 25 } },
    { typeKey: "zombie",      at: { x: 35, y: 30 } },
    { typeKey: "zombie",      at: { x: 20, y: 40 } },
    { typeKey: "vampiro",     at: { x: 40, y: 20 } },
    { typeKey: "vampiro",     at: { x: 30, y: 45 } },
    { typeKey: "orco",        at: { x: 45, y: 35 } },
    { typeKey: "orco",        at: { x: 15, y: 30 } },
    { typeKey: "trol",        at: { x: 50, y: 50 } },
    { typeKey: "dragon_verde", at: { x: 55, y: 55 } },
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
          id, type, mapId,
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

  get(id: number): NpcInstance | undefined { return this.byId.get(id); }
  all(): IterableIterator<NpcInstance> { return this.byId.values(); }

  inMap(mapId: number): NpcInstance[] {
    const out: NpcInstance[] = [];
    for (const n of this.byId.values()) {
      if (n.mapId === mapId) out.push(n);
    }
    return out;
  }
}

export const npcs = new NpcRegistry();

export function rollNpcDamage(type: NpcType, rng: () => number = Math.random): number {
  const span = type.damageMax - type.damageMin + 1;
  return type.damageMin + Math.floor(rng() * span);
}

export function rollNpcGold(type: NpcType, rng: () => number = Math.random): number {
  if (type.goldMax <= 0) return 0;
  const span = type.goldMax - type.goldMin + 1;
  return type.goldMin + Math.floor(rng() * span);
}
