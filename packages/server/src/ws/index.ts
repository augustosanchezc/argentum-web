import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  ClientToServerOp,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AnyPacket,
  type AttackRequest,
  type ChatBroadcast,
  type ChatError,
  type ChatSend,
  type Damage,
  type Death,
  type Direction,
  type DropItemRequest,
  type EntityDespawn,
  type EntityId,
  type EntitySpawn,
  type EntityUpdate,
  type GroundItemDespawn,
  type GroundItemSpawn,
  type InteractRequest,
  type InventoryReorderRequest,
  type InventoryUpdate,
  type LoginRequest,
  type LoginResponse,
  type MapData,
  type MoveRequest,
  type ShopBuyRequest,
  type ShopOpen,
  type ShopSellRequest,
  type StatsUpdate,
  type UseItemRequest,
  type Vector2,
  getItem,
} from "@ao/shared";
import { eq, and } from "drizzle-orm";
import { isOnChatCooldown, validateChatText } from "../chat/index.js";
import { db } from "../db/index.js";
import { characters } from "../db/schema/characters.js";
import {
  ATTACK_COOLDOWN_MS,
  isAdjacent,
  RESPAWN_DELAY_MS,
  rollDamage,
} from "../world/combat.js";
import { groundItems } from "../world/ground-items.js";
import {
  addItem,
  armorDefenseFor,
  countItem,
  removeFromSlot,
  removeItem,
  reorderSlots,
  weaponBonusFor,
} from "../world/inventory.js";
import { getMap, isWalkable, type MapState } from "../world/maps.js";
import { attemptMove } from "../world/movement.js";
import { isNpcId, npcs, rollNpcGold } from "../world/npcs.js";
import { applyXpGain, levelProgress, maxHpForLevel } from "../world/xp.js";
import { broadcastToMap } from "./broadcast.js";
import { decode, encode } from "./codec.js";
import { sessions, type Session } from "./sessions.js";

const CLOSE_NORMAL = 1000;
const CLOSE_AUTH_FAILED = 4001;
const CLOSE_UNKNOWN_OPCODE = 4002;
const CLOSE_INVALID_PACKET = 4003;
const CLOSE_PROTOCOL_VERSION = 4005;
const HANDSHAKE_TIMEOUT_MS = 5_000;

const VALID_DIRECTIONS: ReadonlySet<Direction> = new Set([
  "north",
  "south",
  "east",
  "west",
]);

function parseDirection(raw: string | null | undefined): Direction {
  if (raw && VALID_DIRECTIONS.has(raw as Direction)) return raw as Direction;
  return "south";
}

// Resuelve donde aparece el personaje al conectarse:
// - Si la posicion persistida es valida (caminable) en el mapa correspondiente, ahi.
// - Caso contrario, en el spawn del mapa por defecto.
// No checkeamos colision con otros jugadores aqui — es raro y el cliente
// resolvera la situacion al primer movimiento.
function resolveSpawn(
  persistedMapId: number,
  persistedPos: Vector2,
): { map: MapState; position: Vector2 } {
  const persistedMap = getMap(persistedMapId);
  if (
    persistedMap &&
    isWalkable(persistedMap, persistedPos.x, persistedPos.y)
  ) {
    return { map: persistedMap, position: persistedPos };
  }
  const fallback = getMap(1);
  if (!fallback) throw new Error("Default map (id=1) is missing");
  return { map: fallback, position: fallback.spawn };
}

async function persistPosition(s: Session): Promise<void> {
  await db
    .update(characters)
    .set({
      mapId: s.mapId,
      posX: s.position.x,
      posY: s.position.y,
      direction: s.direction,
      level: s.level,
      xp: s.xp,
      hp: s.hp,
      maxHp: s.maxHp,
      gold: s.gold,
      inventory: s.inventory,
      equippedWeapon: s.equippedWeapon,
      equippedArmor: s.equippedArmor,
      updatedAt: new Date(),
    })
    .where(eq(characters.id, s.characterId));
}

interface JwtPayload {
  accountId: number;
  email: string;
}

function send(socket: Session["socket"], packet: AnyPacket): void {
  try {
    socket.send(encode(packet));
  } catch {
    // socket cerrado o roto — el cleanup lo maneja el evento close
  }
}

function sendLoginResponse(
  socket: Session["socket"],
  ok: boolean,
  reason?: string,
  character?: LoginResponse["character"],
): void {
  const resp: LoginResponse = {
    op: ServerToClientOp.LoginResponse,
    ok,
    ...(reason !== undefined && { reason }),
    ...(character !== undefined && { character }),
  };
  send(socket, resp);
}

// Envia al jugador su nivel, progreso de XP y HP actuales. Solo al dueño.
function sendStatsUpdate(s: Session): void {
  const prog = levelProgress(s.level, s.xp);
  const pkt: StatsUpdate = {
    op: ServerToClientOp.StatsUpdate,
    level: prog.level,
    xp: prog.xpIntoLevel,
    xpForNextLevel: prog.xpForNextLevel,
    hp: s.hp,
    maxHp: s.maxHp,
  };
  send(s.socket, pkt);
}

// Recalcula los bonos derivados del equipo. Si un item equipado ya no está
// en el inventario, lo des-equipa.
function recomputeEquipment(s: Session): void {
  if (s.equippedWeapon !== null && countItem(s.inventory, s.equippedWeapon) === 0) {
    s.equippedWeapon = null;
  }
  if (s.equippedArmor !== null && countItem(s.inventory, s.equippedArmor) === 0) {
    s.equippedArmor = null;
  }
  s.weaponBonus = weaponBonusFor(s.equippedWeapon);
  s.armorDefense = armorDefenseFor(s.equippedArmor);
}

function sendInventoryUpdate(s: Session): void {
  recomputeEquipment(s);
  const pkt: InventoryUpdate = {
    op: ServerToClientOp.InventoryUpdate,
    gold: s.gold,
    slots: s.inventory,
    equippedWeapon: s.equippedWeapon,
    equippedArmor: s.equippedArmor,
  };
  send(s.socket, pkt);
}

// eslint-disable-next-line @typescript-eslint/require-await
export const registerWsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/ws", { websocket: true }, (socket, req) => {
    let session: Session | null = null;

    // Timeout: si el cliente no manda LoginRequest en HANDSHAKE_TIMEOUT_MS,
    // cerramos la conexion. Evita conexiones colgadas.
    const handshakeTimer = setTimeout(() => {
      if (!session) {
        req.log.warn("[ws] handshake timeout");
        sendLoginResponse(socket, false, "HANDSHAKE_TIMEOUT");
        socket.close(CLOSE_AUTH_FAILED, "HANDSHAKE_TIMEOUT");
      }
    }, HANDSHAKE_TIMEOUT_MS);

    socket.on("message", (raw: Buffer) => {
      void handleMessage(raw);
    });

    socket.on("close", () => {
      clearTimeout(handshakeTimer);
      if (session) {
        const closingSession = session;
        const despawn: EntityDespawn = {
          op: ServerToClientOp.EntityDespawn,
          id: closingSession.characterId as EntityId,
        };
        // Avisamos a los vecinos del mapa que el personaje se fue, ANTES
        // de removerlo del registro (asi no se incluye a si mismo).
        broadcastToMap(closingSession.mapId, despawn, closingSession.id);
        sessions.remove(closingSession.id);
        session = null;

        // Persistimos la posicion + direccion en background. No bloqueamos
        // el cleanup del socket; si la DB falla, logueamos y seguimos.
        void persistPosition(closingSession)
          .then(() => {
            req.log.info(
              { sessionId: closingSession.id, characterId: closingSession.characterId },
              "[ws] sesion cerrada y posicion persistida",
            );
          })
          .catch((err: unknown) => {
            req.log.error(
              { err, characterId: closingSession.characterId },
              "[ws] error persistiendo posicion al cerrar",
            );
          });
      }
    });

    socket.on("error", (err: Error) => {
      req.log.error({ err }, "[ws] error en socket");
    });

    async function handleMessage(raw: Buffer): Promise<void> {
      let packet: AnyPacket;
      try {
        packet = decode<AnyPacket>(raw);
      } catch {
        socket.close(CLOSE_INVALID_PACKET, "DECODE_FAILED");
        return;
      }

      // Antes del handshake solo aceptamos LoginRequest.
      if (!session) {
        if (packet.op !== ClientToServerOp.LoginRequest) {
          sendLoginResponse(socket, false, "EXPECTED_LOGIN");
          socket.close(CLOSE_AUTH_FAILED, "EXPECTED_LOGIN");
          return;
        }
        await doHandshake(packet);
        return;
      }

      // Post-handshake: routing del opcode al modulo correspondiente.
      switch (packet.op) {
        case ClientToServerOp.Disconnect:
          socket.close(CLOSE_NORMAL, "CLIENT_DISCONNECT");
          break;
        case ClientToServerOp.Move:
          handleMove(session, packet);
          break;
        case ClientToServerOp.ChatSend:
          handleChat(session, packet);
          break;
        case ClientToServerOp.Attack:
          handleAttack(session, packet);
          break;
        case ClientToServerOp.Pickup:
          handlePickup(session);
          break;
        case ClientToServerOp.UseItem:
          handleUseItem(session, packet);
          break;
        case ClientToServerOp.Interact:
          handleInteract(session, packet);
          break;
        case ClientToServerOp.ShopBuy:
          handleShopBuy(session, packet);
          break;
        case ClientToServerOp.ShopSell:
          handleShopSell(session, packet);
          break;
        case ClientToServerOp.DropItem:
          handleDropItem(session, packet);
          break;
        case ClientToServerOp.InventoryReorder:
          handleReorder(session, packet);
          break;
        default:
          req.log.warn({ op: (packet as { op: number }).op }, "[ws] opcode desconocido");
          socket.close(CLOSE_UNKNOWN_OPCODE, "UNKNOWN_OPCODE");
      }
    }

    function handleMove(s: Session, move: MoveRequest): void {
      // Un personaje muerto no se mueve. Le reenviamos su posicion canonica
      // para que el cliente revierta cualquier prediccion.
      if (s.deadUntil !== 0) {
        const correction: EntityUpdate = {
          op: ServerToClientOp.EntityUpdate,
          id: s.characterId as EntityId,
          position: { x: s.position.x, y: s.position.y },
          direction: s.direction,
        };
        send(s.socket, correction);
        return;
      }

      const map = getMap(s.mapId);
      if (!map) return;

      const result = attemptMove({
        position: s.position,
        lastMoveAt: s.lastMoveAt,
        direction: move.direction,
        now: Date.now(),
        map,
        isOccupied: (pos) => {
          for (const other of sessions.inMap(s.mapId)) {
            if (other.id === s.id) continue;
            if (other.position.x === pos.x && other.position.y === pos.y) return true;
          }
          for (const n of npcs.inMap(s.mapId)) {
            if (n.deadUntil === 0 && n.position.x === pos.x && n.position.y === pos.y) {
              return true;
            }
          }
          return false;
        },
      });

      if (!result.ok) {
        // Rechazo: reenviamos al cliente su posicion canonica para que
        // reconcilie su prediccion local. Misma sesion, no broadcast.
        const correction: EntityUpdate = {
          op: ServerToClientOp.EntityUpdate,
          id: s.characterId as EntityId,
          position: { x: s.position.x, y: s.position.y },
          direction: s.direction,
        };
        send(s.socket, correction);
        return;
      }

      s.position = result.newPosition;
      s.direction = result.direction;
      s.lastMoveAt = Date.now();
      sessions.touch(s.id);

      const update: EntityUpdate = {
        op: ServerToClientOp.EntityUpdate,
        id: s.characterId as EntityId,
        position: { x: s.position.x, y: s.position.y },
        direction: s.direction,
      };
      // Broadcast a TODO el mapa, incluido el que se movio.
      // Asi el cliente puede usar el ACK del server como fuente
      // de verdad para reconciliar su prediccion optimista.
      broadcastToMap(s.mapId, update);
    }

    function handleAttack(s: Session, attack: AttackRequest): void {
      const now = Date.now();
      // Muerto o en cooldown: ignoramos en silencio (el cliente tambien
      // aplica el cooldown localmente, asi que esto solo frena trampas).
      if (s.deadUntil !== 0) return;
      if (now - s.lastAttackAt < ATTACK_COOLDOWN_MS) return;

      const targetId = attack.targetId as unknown as number;
      if (targetId === s.characterId) return; // no autodaño

      // Objetivo NPC vs objetivo jugador.
      if (isNpcId(targetId)) {
        attackNpc(s, targetId, now);
        return;
      }

      const target = sessions.getByCharacterId(targetId);
      if (!target || target.mapId !== s.mapId) return; // objetivo inexistente
      if (target.deadUntil !== 0) return; // ya esta muerto
      if (!isAdjacent(s.position, target.position)) return; // fuera de rango

      s.lastAttackAt = now;
      sessions.touch(s.id);

      // Arma del atacante suma daño; armadura del objetivo lo reduce (mín 1).
      const amount = Math.max(1, rollDamage(s.level) + s.weaponBonus - target.armorDefense);
      target.hp = Math.max(0, target.hp - amount);

      const damage: Damage = {
        op: ServerToClientOp.Damage,
        attackerId: s.characterId as EntityId,
        targetId: target.characterId as EntityId,
        amount,
        hp: target.hp,
        maxHp: target.maxHp,
      };
      // Broadcast al mapa: todos actualizan la barra de HP y ven el golpe.
      broadcastToMap(s.mapId, damage);
      req.log.debug(
        { attacker: s.characterId, target: target.characterId, amount, targetHp: target.hp },
        "[ws] golpe",
      );

      if (target.hp === 0) {
        target.deadUntil = now + RESPAWN_DELAY_MS;
        const death: Death = {
          op: ServerToClientOp.Death,
          id: target.characterId as EntityId,
        };
        broadcastToMap(target.mapId, death);
        req.log.info(
          { attacker: s.characterId, victim: target.characterId },
          "[ws] muerte en combate",
        );
      }
    }

    function attackNpc(s: Session, npcId: number, now: number): void {
      const npc = npcs.get(npcId);
      if (!npc || npc.mapId !== s.mapId || npc.deadUntil !== 0) return;
      if (npc.type.merchant) return; // a los comerciantes no se los ataca
      if (!isAdjacent(s.position, npc.position)) return; // fuera de rango

      s.lastAttackAt = now;
      sessions.touch(s.id);

      const amount = rollDamage(s.level) + s.weaponBonus;
      npc.hp = Math.max(0, npc.hp - amount);

      const damage: Damage = {
        op: ServerToClientOp.Damage,
        attackerId: s.characterId as EntityId,
        targetId: npc.id as EntityId,
        amount,
        hp: npc.hp,
        maxHp: npc.type.maxHp,
      };
      broadcastToMap(s.mapId, damage);

      if (npc.hp === 0) {
        npc.deadUntil = now + npc.type.respawnMs;
        npc.targetCharacterId = null;
        const death: Death = { op: ServerToClientOp.Death, id: npc.id as EntityId };
        broadcastToMap(npc.mapId, death);

        // Loot: oro directo al matador + items al suelo (según drop table).
        const gold = rollNpcGold(npc.type);
        if (gold > 0) s.gold += gold;
        for (const drop of npc.type.drops) {
          if (Math.random() < drop.chance) {
            const g = groundItems.spawn(npc.mapId, npc.position, drop.item, 1);
            const spawnPkt: GroundItemSpawn = {
              op: ServerToClientOp.GroundItemSpawn,
              id: g.id as EntityId,
              position: { x: g.position.x, y: g.position.y },
              item: g.item,
              qty: g.qty,
            };
            broadcastToMap(npc.mapId, spawnPkt);
          }
        }

        // XP al que dio el golpe final; sube de nivel si corresponde.
        const gain = applyXpGain(s.level, s.xp, npc.type.xpReward);
        s.xp = gain.totalXp;
        if (gain.leveledUp) {
          s.level = gain.level;
          s.maxHp = maxHpForLevel(s.level);
          s.hp = s.maxHp; // curación completa al subir de nivel
        }
        sendStatsUpdate(s);
        sendInventoryUpdate(s); // cambió el oro
        req.log.info(
          {
            attacker: s.characterId,
            npc: npc.id,
            xpReward: npc.type.xpReward,
            gold,
            leveledUp: gain.leveledUp,
            level: s.level,
          },
          "[ws] NPC eliminado",
        );
      }
    }

    function handlePickup(s: Session): void {
      if (s.deadUntil !== 0) return;
      const g = groundItems.atTile(s.mapId, s.position);
      if (!g) return;
      groundItems.remove(g.id);
      s.inventory = addItem(s.inventory, g.item, g.qty);
      const despawn: GroundItemDespawn = {
        op: ServerToClientOp.GroundItemDespawn,
        id: g.id as EntityId,
      };
      broadcastToMap(s.mapId, despawn);
      sendInventoryUpdate(s);
    }

    function handleDropItem(s: Session, pkt: DropItemRequest): void {
      if (s.deadUntil !== 0) return;
      const removed = removeFromSlot(s.inventory, pkt.slot, pkt.qty);
      if (!removed) return;
      // Al soltar un item equipado, dejamos de tenerlo puesto.
      if (s.equippedWeapon === removed.item && countItem(removed.slots, removed.item) === 0) {
        s.equippedWeapon = null;
      }
      if (s.equippedArmor === removed.item && countItem(removed.slots, removed.item) === 0) {
        s.equippedArmor = null;
      }
      s.inventory = removed.slots;
      const g = groundItems.spawn(s.mapId, s.position, removed.item, removed.qty);
      const spawn: GroundItemSpawn = {
        op: ServerToClientOp.GroundItemSpawn,
        id: g.id as EntityId,
        position: { x: g.position.x, y: g.position.y },
        item: g.item,
        qty: g.qty,
      };
      broadcastToMap(s.mapId, spawn);
      sendInventoryUpdate(s);
    }

    function handleReorder(s: Session, pkt: InventoryReorderRequest): void {
      const next = reorderSlots(s.inventory, pkt.from, pkt.to);
      if (!next) return;
      s.inventory = next;
      sendInventoryUpdate(s);
    }

    function handleUseItem(s: Session, pkt: UseItemRequest): void {
      const def = getItem(pkt.item);
      if (!def) return;
      if (countItem(s.inventory, pkt.item) === 0) return;

      if (def.type === "potion") {
        if (s.deadUntil !== 0) return;
        const healed = Math.min(s.maxHp, s.hp + (def.heal ?? 0));
        if (healed === s.hp) return; // ya está al máximo, no gastar la poción
        s.hp = healed;
        const removed = removeItem(s.inventory, pkt.item, 1);
        if (removed) s.inventory = removed;
        sendStatsUpdate(s); // actualiza HP en el HUD del dueño
        sendInventoryUpdate(s);
      } else if (def.type === "weapon") {
        s.equippedWeapon = pkt.item;
        sendInventoryUpdate(s); // recomputa el bono de arma
      } else if (def.type === "armor") {
        s.equippedArmor = pkt.item;
        sendInventoryUpdate(s);
      }
    }

    // True si hay un comerciante del mapa a <= 3 tiles del jugador.
    function nearMerchant(s: Session): boolean {
      for (const n of npcs.inMap(s.mapId)) {
        if (!n.type.merchant) continue;
        const dx = Math.abs(n.position.x - s.position.x);
        const dy = Math.abs(n.position.y - s.position.y);
        if (Math.max(dx, dy) <= 3) return true;
      }
      return false;
    }

    function handleInteract(s: Session, pkt: InteractRequest): void {
      const targetId = pkt.targetId as unknown as number;
      if (!isNpcId(targetId)) return;
      const npc = npcs.get(targetId);
      if (!npc || npc.mapId !== s.mapId || !npc.type.merchant) return;
      const dx = Math.abs(npc.position.x - s.position.x);
      const dy = Math.abs(npc.position.y - s.position.y);
      if (Math.max(dx, dy) > 3) return;

      const offers = npc.type.shopOffers.map((it) => {
        const def = getItem(it);
        return { item: it, price: def ? def.value : 0 };
      });
      const shop: ShopOpen = {
        op: ServerToClientOp.ShopOpen,
        merchantId: npc.id as EntityId,
        offers,
      };
      send(s.socket, shop);
    }

    function handleShopBuy(s: Session, pkt: ShopBuyRequest): void {
      const def = getItem(pkt.item);
      if (!def || !nearMerchant(s)) return;
      if (s.gold < def.value) return;
      s.gold -= def.value;
      s.inventory = addItem(s.inventory, def.id, 1);
      sendInventoryUpdate(s);
    }

    function handleShopSell(s: Session, pkt: ShopSellRequest): void {
      const def = getItem(pkt.item);
      if (!def || !nearMerchant(s)) return;
      const removed = removeItem(s.inventory, def.id, 1);
      if (!removed) return;
      s.inventory = removed;
      s.gold += Math.floor(def.value / 2); // se vende a mitad de precio
      sendInventoryUpdate(s);
    }

    function handleChat(s: Session, chat: ChatSend): void {
      const now = Date.now();
      if (isOnChatCooldown(s.lastChatAt, now)) {
        const err: ChatError = {
          op: ServerToClientOp.ChatError,
          reason: "RATE_LIMITED",
        };
        send(s.socket, err);
        return;
      }

      const validation = validateChatText(chat.text);
      if (!validation.ok) {
        const err: ChatError = {
          op: ServerToClientOp.ChatError,
          reason: validation.reason,
        };
        send(s.socket, err);
        return;
      }

      s.lastChatAt = now;
      sessions.touch(s.id);

      const out: ChatBroadcast = {
        op: ServerToClientOp.ChatBroadcast,
        fromId: s.characterId as EntityId,
        fromName: s.characterName,
        text: validation.text,
        timestamp: now,
      };
      // Por ahora chat global del mapa (sala unica por mapa). Cuando
      // tengamos rango/canales (Fase 3+), filtrar aqui.
      broadcastToMap(s.mapId, out);
    }

    async function doHandshake(loginReq: LoginRequest): Promise<void> {
      clearTimeout(handshakeTimer);

      if (loginReq.clientVersion !== PROTOCOL_VERSION) {
        sendLoginResponse(socket, false, "OUTDATED_CLIENT");
        socket.close(CLOSE_PROTOCOL_VERSION, "OUTDATED_CLIENT");
        return;
      }

      let payload: JwtPayload;
      try {
        payload = app.jwt.verify<JwtPayload>(loginReq.token);
      } catch {
        sendLoginResponse(socket, false, "INVALID_TOKEN");
        socket.close(CLOSE_AUTH_FAILED, "INVALID_TOKEN");
        return;
      }

      const [character] = await db
        .select({
          id: characters.id,
          name: characters.name,
          level: characters.level,
          xp: characters.xp,
          hp: characters.hp,
          maxHp: characters.maxHp,
          gold: characters.gold,
          inventory: characters.inventory,
          equippedWeapon: characters.equippedWeapon,
          equippedArmor: characters.equippedArmor,
          mapId: characters.mapId,
          posX: characters.posX,
          posY: characters.posY,
          direction: characters.direction,
        })
        .from(characters)
        .where(
          and(
            eq(characters.id, loginReq.characterId as number),
            eq(characters.accountId, payload.accountId),
          ),
        )
        .limit(1);

      if (!character) {
        sendLoginResponse(socket, false, "CHARACTER_NOT_FOUND");
        socket.close(CLOSE_AUTH_FAILED, "CHARACTER_NOT_FOUND");
        return;
      }

      let spawnInfo: { map: MapState; position: Vector2 };
      try {
        spawnInfo = resolveSpawn(character.mapId, {
          x: character.posX,
          y: character.posY,
        });
      } catch {
        sendLoginResponse(socket, false, "MAP_NOT_FOUND");
        socket.close(CLOSE_AUTH_FAILED, "MAP_NOT_FOUND");
        return;
      }
      const { map, position: spawnPos } = spawnInfo;

      session = sessions.create(
        payload.accountId,
        character.id,
        character.name,
        socket,
        map.id,
        spawnPos,
      );
      session.direction = parseDirection(character.direction);
      session.level = character.level;
      session.xp = character.xp;
      // maxHp se deriva del nivel (fuente de verdad) para evitar drift.
      session.maxHp = maxHpForLevel(character.level);
      // Si el personaje quedo guardado con HP <= 0 (desconecto muerto), lo
      // revivimos al loguear con HP completo. Asi nunca entra "muerto eterno".
      session.hp =
        character.hp > 0 ? Math.min(character.hp, session.maxHp) : session.maxHp;
      session.gold = character.gold;
      session.inventory = character.inventory.map((s) => ({ ...s }));
      session.equippedWeapon = character.equippedWeapon;
      session.equippedArmor = character.equippedArmor;
      recomputeEquipment(session);

      sendLoginResponse(socket, true, undefined, {
        id: character.id as EntityId,
        name: character.name,
        level: character.level,
      });

      // Mapa + entidades visibles. Por ahora incluimos a TODAS las
      // sesiones del mapa porque no hay rango de vision todavia.
      const playerEntities = sessions.inMap(map.id).map((s) => ({
        id: s.characterId as EntityId,
        position: { x: s.position.x, y: s.position.y },
        direction: s.direction,
        name: s.characterName,
        hp: s.hp,
        maxHp: s.maxHp,
        kind: "player" as const,
        graphic: 0,
      }));
      const npcEntities = npcs.inMap(map.id).map((n) => ({
        id: n.id as EntityId,
        position: { x: n.position.x, y: n.position.y },
        direction: n.direction,
        name: n.type.name,
        hp: n.hp,
        maxHp: n.type.maxHp,
        kind: n.type.merchant ? ("merchant" as const) : ("npc" as const),
        graphic: n.type.graphic,
      }));
      const entities = [...playerEntities, ...npcEntities];

      const groundItemEntities = groundItems.inMap(map.id).map((g) => ({
        id: g.id as EntityId,
        position: { x: g.position.x, y: g.position.y },
        item: g.item,
        qty: g.qty,
      }));

      const mapPacket: MapData = {
        op: ServerToClientOp.MapData,
        mapId: map.id,
        name: map.name,
        width: map.width,
        height: map.height,
        graphic: map.graphic,
        blocked: map.blocked,
        entities,
        groundItems: groundItemEntities,
      };
      send(socket, mapPacket);

      // Avisamos al resto del mapa que aparecio un nuevo personaje.
      const spawn: EntitySpawn = {
        op: ServerToClientOp.EntitySpawn,
        id: session.characterId as EntityId,
        position: { x: session.position.x, y: session.position.y },
        direction: session.direction,
        name: session.characterName,
        hp: session.hp,
        maxHp: session.maxHp,
        kind: "player",
        graphic: 0,
      };
      broadcastToMap(map.id, spawn, session.id);

      // Stats e inventario iniciales para el HUD del jugador.
      sendStatsUpdate(session);
      sendInventoryUpdate(session);

      req.log.info(
        {
          sessionId: session.id,
          characterId: character.id,
          characterName: character.name,
          mapId: map.id,
          spawn: spawnPos,
          persisted: { mapId: character.mapId, x: character.posX, y: character.posY },
        },
        "[ws] handshake OK + MAP_DATA + SPAWN broadcast",
      );
    }
  });
};
