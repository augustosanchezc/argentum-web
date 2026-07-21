import {
  ServerToClientOp,
  type Damage,
  type Direction,
  type EntityDespawn,
  type EntityId,
  type EntitySpawn,
  type EntityUpdate,
  type Vector2,
} from "@ao/shared";
import {
  INTERVALS,
  isAdjacent,
  playerPoderEvasion,
  playerPoderEvasionEscudo,
  rollHit,
  rollShieldBlock,
} from "../world/combat.js";
import { trainSkill } from "../world/skill-training.js";
import { isCriminal } from "../world/criminal.js";
import { getMap, isWalkable } from "../world/maps.js";
import { npcAttackSound, npcs, rollNpcDamage, type NpcInstance } from "../world/npcs.js";
import { rerollCreatureType } from "../world/map-spawns.js";
import { rollArmorDefenseFor } from "../world/inventory.js";
import { broadcastToMap, killPlayer, stopMeditating } from "./broadcast.js";
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

// Los jugadores muertos NO auto-reviven (fantasma del AO): caminan hasta un
// sacerdote o usan «volver al hogar». Ver checkPriestRevive / handleGoHome.

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
// Excluye también los tiles de portal: una criatura parada encima bloqueaba
// el cruce a los jugadores.
function isTileFree(mapId: number, pos: Vector2, excludeNpcId: number): boolean {
  const map = getMap(mapId);
  if (!map || !isWalkable(map, pos.x, pos.y)) return false;
  if (map.portals.some((p) => p.x === pos.x && p.y === pos.y)) return false;
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

// Elige un tile caminable y libre al azar del mapa, evitando `avoid` (para el
// respawn aleatorio de criaturas: nunca reaparecen en el mismo lugar). Si en
// varios intentos no encuentra, devuelve null y el caller cae al spawn fijo.
function randomFreeTile(mapId: number, excludeNpcId: number, avoid: Vector2): Vector2 | null {
  const map = getMap(mapId);
  if (!map) return null;
  for (let i = 0; i < 50; i += 1) {
    const x = Math.floor(Math.random() * map.width);
    const y = Math.floor(Math.random() * map.height);
    if (x === avoid.x && y === avoid.y) continue;
    const pos: Vector2 = { x, y };
    if (isTileFree(mapId, pos, excludeNpcId)) return pos;
  }
  return null;
}

// Jugador vivo más cercano al NPC dentro de su radio de aggro.
function nearestTarget(npc: NpcInstance): Session | null {
  let best: Session | null = null;
  let bestDist = Infinity;
  const now = Date.now();
  for (const s of sessions.inMap(npc.mapId)) {
    if (s.deadUntil !== 0) continue;
    // Los invisibles no son detectados por las criaturas.
    if (s.invisibleUntil > now) continue;
    if (npc.type.isGuard && !isCriminal(s)) continue;
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
  stopMeditating(target);
  // Sonido de la criatura al golpear (rugido/Snd de NPCs.dat), 0 = sin sonido.
  const snd = npcAttackSound(npc.type); // Snd1 = ataque (canon MODULO_NPCs.bas)

  // Impacto del AO (NpcImpacto): PoderAtaque del NPC contra la evasión del
  // jugador (+escudo). Si falla y hay escudo, puede rechazar el golpe.
  const hasShield = target.equippedShield !== null;
  const evasion =
    playerPoderEvasion(target) + (hasShield ? playerPoderEvasionEscudo(target) : 0);
  if (!rollHit(npc.type.poderAtaque, evasion)) {
    const blocked =
      hasShield && rollShieldBlock(target.skills.defensa, target.skills.tacticas);
    // El defensor entrena Tácticas al evadir / Defensa al bloquear.
    trainSkill(target, blocked ? "defensa" : "tacticas", true);
    const missPkt: Damage = {
      op: ServerToClientOp.Damage,
      attackerId: npc.id as EntityId,
      targetId: target.characterId as EntityId,
      amount: 0,
      hp: target.hp,
      maxHp: target.maxHp,
      ...(blocked ? { blocked: true } : { miss: true }),
      ...(snd > 0 ? { wav: snd } : {}),
    };
    broadcastToMap(npc.mapId, missPkt);
    return;
  }

  // La armadura equipada del objetivo reduce el daño (mínimo 1). AO tira
  // RandomNumber(MinDef,MaxDef) de la armadura en cada golpe.
  const amount = Math.max(1, rollNpcDamage(npc.type) - rollArmorDefenseFor(target.equippedArmor));
  target.hp = Math.max(0, target.hp - amount);
  if (playerDamagedFn) playerDamagedFn(target); // recibir daño cancela la salida

  const damage: Damage = {
    op: ServerToClientOp.Damage,
    attackerId: npc.id as EntityId,
    targetId: target.characterId as EntityId,
    amount,
    hp: target.hp,
    maxHp: target.maxHp,
    ...(snd > 0 ? { wav: snd } : {}),
  };
  broadcastToMap(npc.mapId, damage);

  if (target.hp === 0) {
    // Misma resolución que PvP/veneno (drop de items, cancelar trade).
    if (playerDeathFn) playerDeathFn(target, null);
    else killPlayer(target);
  }
}

function npcMoveToward(npc: NpcInstance, target: { position: Vector2 }, now: number): void {
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

// Combate de mascota contra NPC: el golpe lo resuelve index.ts (ahí vive
// damageNpc con XP/drops para el amo). El hook se registra por conexión.
type PetAttackFn = (owner: Session, target: NpcInstance, petId: number, now: number) => void;
let petAttackFn: PetAttackFn | null = null;
export function setPetAttackHandler(fn: PetAttackFn): void {
  petAttackFn = fn;
}

// Resolución de muerte de jugador (resolvePlayerDeath de ws/index): inyectada
// para que morir a manos de un NPC tenga las MISMAS consecuencias (drop de
// items, cancelar trade) que morir en PvP/veneno. killer = null (fue un NPC).
type PlayerDeathFn = (victim: Session, killer: Session | null) => void;
let playerDeathFn: PlayerDeathFn | null = null;
export function setPlayerDeathHandler(fn: PlayerDeathFn): void {
  playerDeathFn = fn;
}

// Un jugador recibió daño de un NPC → cancela su cuenta regresiva de salida.
type PlayerDamagedFn = (victim: Session) => void;
let playerDamagedFn: PlayerDamagedFn | null = null;
export function setPlayerDamagedHandler(fn: PlayerDamagedFn): void {
  playerDamagedFn = fn;
}

// IA de mascota (FollowAmo del AO): asiste al objetivo del amo o lo sigue.
// Si el amo se desconecta, muere o cambia de mapa, vuelve a ser salvaje.
function processPet(npc: NpcInstance, now: number): void {
  const owner = npc.ownerCharacterId !== null
    ? sessions.getByCharacterId(npc.ownerCharacterId)
    : undefined;
  if (!owner || owner.deadUntil !== 0 || owner.mapId !== npc.mapId) {
    npc.ownerCharacterId = null;
    npc.petTargetNpcId = null;
    return;
  }
  const target = npc.petTargetNpcId !== null ? npcs.get(npc.petTargetNpcId) : undefined;
  if (target && target.deadUntil === 0 && target.mapId === npc.mapId) {
    if (isAdjacent(npc.position, target.position)) {
      if (now - npc.lastAttackAt >= INTERVALS.npcAttack && petAttackFn) {
        npc.lastAttackAt = now;
        petAttackFn(owner, target, npc.id, now);
      }
    } else if (npc.type.canMove && now - npc.lastMoveAt >= npc.type.moveCooldownMs) {
      npcMoveToward(npc, target, now);
    }
    return;
  }
  npc.petTargetNpcId = null;
  if (
    npc.type.canMove &&
    chebyshev(npc.position, owner.position) > 3 &&
    now - npc.lastMoveAt >= npc.type.moveCooldownMs
  ) {
    npcMoveToward(npc, owner, now);
  }
}

// IA + reaparición de NPCs (T-052, T-053).
function processNpcs(now: number): void {
  for (const npc of npcs.all()) {
    // Reaparición.
    if (npc.deadUntil !== 0) {
      if (now < npc.deadUntil) continue;

      // Respawn aleatorio por mapa: si es una criatura de caza y el admin
      // habilitó el pool de este mapa, reaparece como una del pool (al azar).
      // Puede cambiar el tipo (apariencia/nombre); igual SIEMPRE recreamos la
      // entidad con despawn+spawn más abajo.
      rerollCreatureType(npc);

      npc.hp = npc.type.maxHp;
      // Respawn en posición ALEATORIA del mapa (nunca en el mismo lugar donde
      // murió). Si no hay tile libre, cae al spawn original.
      const respawnPos = randomFreeTile(npc.mapId, npc.id, npc.position);
      npc.position = respawnPos ?? { x: npc.spawn.x, y: npc.spawn.y };
      npc.direction = "south";
      npc.deadUntil = 0;
      npc.targetCharacterId = null;
      // Si era mascota, reaparece salvaje.
      npc.ownerCharacterId = null;
      npc.petTargetNpcId = null;

      // SIEMPRE recreamos la entidad con despawn+spawn (antes: solo si cambiaba
      // el tipo; si no, un `Respawn` liviano de pos/hp que ASUMÍA que el cliente
      // ya tenía la entidad). Eso fallaba para NPCs que estaban muertos cuando el
      // jugador cargó el mapa — MAP_DATA solo manda vivos, así que el cliente
      // nunca los tuvo: el `Respawn` no los creaba y el siguiente EntityUpdate de
      // la IA los dibujaba como placeholder "?<id> / Lv.1 Guerrero". El despawn
      // limpia cualquier entidad previa (viva/oculta o inexistente) y el spawn la
      // recrea con kind "npc", nombre y body correctos.
      const despawn: EntityDespawn = { op: ServerToClientOp.EntityDespawn, id: npc.id as EntityId };
      broadcastToMap(npc.mapId, despawn);
      const spawn: EntitySpawn = {
        op: ServerToClientOp.EntitySpawn,
        id: npc.id as EntityId,
        position: { x: npc.position.x, y: npc.position.y },
        direction: npc.direction,
        name: npc.type.name,
        hp: npc.hp,
        maxHp: npc.type.maxHp,
        kind: "npc",
        bodyId: npc.type.bodyId,
        headId: npc.type.headId,
        graphic: 0,
      };
      broadcastToMap(npc.mapId, spawn);
      continue;
    }

    // Paralizado/inmovilizado por hechizo: sin IA hasta que expire.
    if (npc.paralyzedUntil > now) continue;

    // Mascotas: siguen a su amo y asisten en su combate.
    if (npc.ownerCharacterId !== null) {
      processPet(npc, now);
      continue;
    }

    // Los NPCs no hostiles (comerciantes) no persiguen ni atacan.
    if (!npc.type.hostile) continue;

    // IA hostil: perseguir y atacar al jugador más cercano en rango.
    const target = nearestTarget(npc);
    npc.targetCharacterId = target ? target.characterId : null;
    if (!target) continue;

    if (isAdjacent(npc.position, target.position)) {
      if (now - npc.lastAttackAt >= INTERVALS.npcAttack) {
        npcAttack(npc, target, now);
      }
    } else if (npc.type.canMove && now - npc.lastMoveAt >= npc.type.moveCooldownMs) {
      // Movement=1 en NPCs.dat = estático (comerciantes, guardias de puesto).
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
