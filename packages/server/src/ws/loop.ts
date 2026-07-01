import {
  ServerToClientOp,
  type Damage,
  type Death,
  type Direction,
  type EntityId,
  type EntityUpdate,
  type Respawn,
  type Vector2,
} from "@ao/shared";
import { isAdjacent, RESPAWN_DELAY_MS } from "../world/combat.js";
import { getMap, isWalkable } from "../world/maps.js";
import { npcs, rollNpcDamage, type NpcInstance } from "../world/npcs.js";
import { broadcastToMap } from "./broadcast.js";
import { sessions, type Session } from "./sessions.js";

const TICK_MS = 100;

const DELTAS: Record<Direction, Vector2> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

export interface GameLoop {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  ticks: () => number;
}

// Reapariciones de jugadores (T-042): todo personaje muerto cuyo deadUntil
// venció revive en el spawn del mapa con HP al máximo.
function processPlayerRespawns(now: number): void {
  for (const s of sessions.all()) {
    if (s.deadUntil === 0 || now < s.deadUntil) continue;

    const map = getMap(s.mapId);
    const spawn = map ? map.spawn : s.position;
    s.position = { x: spawn.x, y: spawn.y };
    s.hp = s.maxHp;
    s.deadUntil = 0;
    s.lastMoveAt = now;

    const respawn: Respawn = {
      op: ServerToClientOp.Respawn,
      id: s.characterId as EntityId,
      position: { x: s.position.x, y: s.position.y },
      hp: s.hp,
      maxHp: s.maxHp,
    };
    broadcastToMap(s.mapId, respawn);
  }
}

function chebyshev(a: Vector2, b: Vector2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// Direcciones candidatas para acercarse a `to`, en orden de preferencia
// (primero el eje con mayor diferencia).
function stepDirsToward(from: Vector2, to: Vector2): Direction[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horiz: Direction | null = dx > 0 ? "east" : dx < 0 ? "west" : null;
  const vert: Direction | null = dy > 0 ? "south" : dy < 0 ? "north" : null;
  const dirs: Direction[] = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (horiz) dirs.push(horiz);
    if (vert) dirs.push(vert);
  } else {
    if (vert) dirs.push(vert);
    if (horiz) dirs.push(horiz);
  }
  return dirs;
}

// True si el tile es caminable y no está ocupado por un jugador o NPC vivo.
function isTileFree(mapId: number, pos: Vector2, excludeNpcId: number): boolean {
  const map = getMap(mapId);
  if (!map || !isWalkable(map, pos.x, pos.y)) return false;
  for (const s of sessions.inMap(mapId)) {
    if (s.deadUntil === 0 && s.position.x === pos.x && s.position.y === pos.y) return false;
  }
  for (const n of npcs.inMap(mapId)) {
    if (n.id !== excludeNpcId && n.deadUntil === 0 &&
        n.position.x === pos.x && n.position.y === pos.y) {
      return false;
    }
  }
  return true;
}

// Jugador vivo más cercano al NPC dentro de su radio de aggro.
function nearestTarget(npc: NpcInstance): Session | null {
  let best: Session | null = null;
  let bestDist = Infinity;
  for (const s of sessions.inMap(npc.mapId)) {
    if (s.deadUntil !== 0) continue;
    const d = chebyshev(npc.position, s.position);
    if (d <= npc.type.aggroRadius && d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

function npcAttack(npc: NpcInstance, target: Session, now: number): void {
  npc.lastAttackAt = now;
  const dirs = stepDirsToward(npc.position, target.position);
  if (dirs[0]) npc.direction = dirs[0];

  const amount = rollNpcDamage(npc.type);
  target.hp = Math.max(0, target.hp - amount);

  const damage: Damage = {
    op: ServerToClientOp.Damage,
    attackerId: npc.id as EntityId,
    targetId: target.characterId as EntityId,
    amount,
    hp: target.hp,
    maxHp: target.maxHp,
  };
  broadcastToMap(npc.mapId, damage);

  if (target.hp === 0) {
    target.deadUntil = now + RESPAWN_DELAY_MS;
    const death: Death = {
      op: ServerToClientOp.Death,
      id: target.characterId as EntityId,
    };
    broadcastToMap(npc.mapId, death);
  }
}

function npcMoveToward(npc: NpcInstance, target: Session, now: number): void {
  for (const dir of stepDirsToward(npc.position, target.position)) {
    const next: Vector2 = {
      x: npc.position.x + DELTAS[dir].x,
      y: npc.position.y + DELTAS[dir].y,
    };
    if (isTileFree(npc.mapId, next, npc.id)) {
      npc.position = next;
      npc.direction = dir;
      npc.lastMoveAt = now;
      const update: EntityUpdate = {
        op: ServerToClientOp.EntityUpdate,
        id: npc.id as EntityId,
        position: { x: next.x, y: next.y },
        direction: dir,
      };
      broadcastToMap(npc.mapId, update);
      return;
    }
  }
}

// IA + reaparición de NPCs (T-052, T-053).
function processNpcs(now: number): void {
  for (const npc of npcs.all()) {
    // Reaparición.
    if (npc.deadUntil !== 0) {
      if (now < npc.deadUntil) continue;
      npc.hp = npc.type.maxHp;
      npc.position = { x: npc.spawn.x, y: npc.spawn.y };
      npc.deadUntil = 0;
      npc.targetCharacterId = null;
      const respawn: Respawn = {
        op: ServerToClientOp.Respawn,
        id: npc.id as EntityId,
        position: { x: npc.position.x, y: npc.position.y },
        hp: npc.hp,
        maxHp: npc.type.maxHp,
      };
      broadcastToMap(npc.mapId, respawn);
      continue;
    }

    // IA hostil: perseguir y atacar al jugador más cercano en rango.
    const target = nearestTarget(npc);
    npc.targetCharacterId = target ? target.characterId : null;
    if (!target) continue;

    if (isAdjacent(npc.position, target.position)) {
      if (now - npc.lastAttackAt >= npc.type.attackCooldownMs) {
        npcAttack(npc, target, now);
      }
    } else if (now - npc.lastMoveAt >= npc.type.moveCooldownMs) {
      npcMoveToward(npc, target, now);
    }
  }
}

export function createGameLoop(logger: { info: (msg: string) => void }): GameLoop {
  let timer: NodeJS.Timeout | null = null;
  let tickCount = 0;
  let lastReport = 0;

  function tick(): void {
    tickCount += 1;
    const now = Date.now();

    processPlayerRespawns(now);
    processNpcs(now);

    if (now - lastReport > 10_000) {
      logger.info(`[loop] tick ${tickCount} | sesiones activas: ${sessions.size()}`);
      lastReport = now;
    }
  }

  return {
    start: () => {
      if (timer) return;
      lastReport = Date.now();
      timer = setInterval(tick, TICK_MS);
      logger.info(`[loop] arrancado a tick fijo ${TICK_MS}ms (10 Hz)`);
    },
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    isRunning: () => timer !== null,
    ticks: () => tickCount,
  };
}
