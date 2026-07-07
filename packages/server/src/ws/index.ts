import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  ClientToServerOp,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AllocStatRequest,
  type AnyPacket,
  type AttackRequest,
  type BankDepositGoldRequest,
  type BankDepositItemRequest,
  type BankOpen,
  type BankUpdate,
  type BankWithdrawGoldRequest,
  type BankWithdrawItemRequest,
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
  type PartyDisbanded,
  type PartyInviteReceived,
  type PartyInviteRequest,
  type PartyUpdate,
  type ShopBuyRequest,
  type ShopOpen,
  type ShopSellRequest,
  type StatsUpdate,
  type TradeAddItemMsg,
  type TradeCancelled,
  type TradeComplete,
  type TradeInviteReceived,
  type TradeRequestMsg,
  type TradeSetGoldMsg,
  type TradeUpdate,
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
  helmetDefenseFor,
  removeFromSlot,
  removeItem,
  reorderSlots,
  shieldDefenseFor,
  totalArmorDefense,
  weaponBonusFor,
} from "../world/inventory.js";
import {
  bankDepositGold,
  bankDepositItem,
  bankWithdrawGold,
  bankWithdrawItem,
} from "../world/bank.js";
import { getMap, isWalkable, type MapState } from "../world/maps.js";
import type { PortalTile } from "../world/maps.js";
import { attemptMove } from "../world/movement.js";
import { isNpcId, npcs, rollNpcGold } from "../world/npcs.js";
import { partyRegistry } from "../world/party.js";
import { tradeRegistry } from "../world/trade.js";
import { applyXpGain, calcMaxHp, calcMaxMp, levelProgress, maxHpForLevel } from "../world/xp.js";
import { getClass, STAT_POINTS_PER_LEVEL } from "../world/classes.js";
import { tickRegen, REGEN_INTERVAL_MS } from "../world/regen.js";
import { canAttackPlayer } from "../world/zones.js";
import { broadcastToMap } from "./broadcast.js";
import { decode, encode } from "./codec.js";
import {
  bankOpsTotal,
  chatMessagesTotal,
  mapTransitionsTotal,
  npcKillsTotal,
  tradeCompletedTotal,
} from "../metrics.js";
import { sessions, type Session } from "./sessions.js";

function buildMapDataPacket(map: MapState): MapData {
  const playerEntities = sessions.inMap(map.id).map((s) => ({
    id: s.characterId as EntityId,
    position: { x: s.position.x, y: s.position.y },
    direction: s.direction,
    name: s.characterName,
    hp: s.hp,
    maxHp: s.maxHp,
    kind: "player" as const,
    bodyId: s.bodyId,
    headId: s.headId,
    graphic: 0,
  }));
  const npcEntities = npcs.inMap(map.id).map((n) => ({
    id: n.id as EntityId,
    position: { x: n.position.x, y: n.position.y },
    direction: n.direction,
    name: n.type.name,
    hp: n.hp,
    maxHp: n.type.maxHp,
    kind: n.type.merchant
      ? ("merchant" as const)
      : n.type.banker
        ? ("banker" as const)
        : ("npc" as const),
    bodyId: n.type.bodyId ?? 0,
    headId: n.type.headId ?? 0,
    graphic: n.type.graphic,
  }));
  const groundItemEntities = groundItems.inMap(map.id).map((g) => ({
    id: g.id as EntityId,
    position: { x: g.position.x, y: g.position.y },
    item: g.item,
    qty: g.qty,
  }));
  return {
    op: ServerToClientOp.MapData,
    mapId: map.id,
    name: map.name,
    width: map.width,
    height: map.height,
    graphic: map.graphic,
    blocked: map.blocked,
    entities: [...playerEntities, ...npcEntities],
    groundItems: groundItemEntities,
  };
}

const CLOSE_NORMAL = 1000;
const CLOSE_AUTH_FAILED = 4001;
const CLOSE_UNKNOWN_OPCODE = 4002;
const CLOSE_INVALID_PACKET = 4003;
const CLOSE_PROTOCOL_VERSION = 4005;
const HANDSHAKE_TIMEOUT_MS = 5_000;

const VALID_DIRECTIONS: ReadonlySet<Direction> = new Set([
  "north", "south", "east", "west",
]);

function parseDirection(raw: string | null | undefined): Direction {
  if (raw && VALID_DIRECTIONS.has(raw as Direction)) return raw as Direction;
  return "south";
}

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
      mana: s.mana,
      maxMana: s.maxMana,
      str: s.str,
      agi: s.agi,
      int_: s.int_,
      con: s.con,
      car: s.car,
      statPoints: s.statPoints,
      gold: s.gold,
      inventory: s.inventory,
      equippedWeapon: s.equippedWeapon,
      equippedArmor: s.equippedArmor,
      equippedHelmet: s.equippedHelmet,
      equippedShield: s.equippedShield,
      bankInventory: s.bankInventory,
      bankGold: s.bankGold,
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
    // socket cerrado o roto
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

function syncPartyStats(s: Session): void {
  if (!s.partyId) return;
  partyRegistry.updateMemberStats(s.characterId, s.hp, s.maxHp);
}

function sendStatsUpdate(s: Session): void {
  const prog = levelProgress(s.level, s.xp);
  const pkt: StatsUpdate = {
    op: ServerToClientOp.StatsUpdate,
    level: prog.level,
    xp: prog.xpIntoLevel,
    xpForNextLevel: prog.xpForNextLevel,
    hp: s.hp,
    maxHp: s.maxHp,
    mana: s.mana,
    maxMana: s.maxMana,
    str: s.str,
    agi: s.agi,
    int: s.int_,
    con: s.con,
    car: s.car,
    statPoints: s.statPoints,
    classId: s.classId,
  };
  send(s.socket, pkt);
}

function recomputeEquipment(s: Session): void {
  if (s.equippedWeapon !== null && countItem(s.inventory, s.equippedWeapon) === 0) {
    s.equippedWeapon = null;
  }
  if (s.equippedArmor !== null && countItem(s.inventory, s.equippedArmor) === 0) {
    s.equippedArmor = null;
  }
  if (s.equippedHelmet !== null && countItem(s.inventory, s.equippedHelmet) === 0) {
    s.equippedHelmet = null;
  }
  if (s.equippedShield !== null && countItem(s.inventory, s.equippedShield) === 0) {
    s.equippedShield = null;
  }
  s.weaponBonus = weaponBonusFor(s.equippedWeapon);
  s.armorDefense = armorDefenseFor(s.equippedArmor);
  s.helmetDefense = helmetDefenseFor(s.equippedHelmet);
  s.shieldDefense = shieldDefenseFor(s.equippedShield);
}

function sendInventoryUpdate(s: Session): void {
  recomputeEquipment(s);
  const pkt: InventoryUpdate = {
    op: ServerToClientOp.InventoryUpdate,
    gold: s.gold,
    slots: s.inventory,
    equippedWeapon: s.equippedWeapon,
    equippedArmor: s.equippedArmor,
    equippedHelmet: s.equippedHelmet,
    equippedShield: s.equippedShield,
  };
  send(s.socket, pkt);
}

// Iniciar el loop de regen al momento de cargar el módulo.
// Usar sendStatsUpdate como callback — funciona porque es función declarada más arriba.
setInterval(() => tickRegen(sendStatsUpdate), REGEN_INTERVAL_MS);

// eslint-disable-next-line @typescript-eslint/require-await
export const registerWsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/ws", { websocket: true }, (socket, req) => {
    let session: Session | null = null;

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

        if (closingSession.tradeId) {
          cancelTrade(closingSession.tradeId, "DISCONNECT");
        }
        if (closingSession.partyId) {
          doPartyLeave(closingSession);
        }

        const despawn: EntityDespawn = {
          op: ServerToClientOp.EntityDespawn,
          id: closingSession.characterId as EntityId,
        };
        broadcastToMap(closingSession.mapId, despawn, closingSession.id);
        sessions.remove(closingSession.id);
        session = null;

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

      if (!session) {
        if (packet.op !== ClientToServerOp.LoginRequest) {
          sendLoginResponse(socket, false, "EXPECTED_LOGIN");
          socket.close(CLOSE_AUTH_FAILED, "EXPECTED_LOGIN");
          return;
        }
        await doHandshake(packet);
        return;
      }

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
        case ClientToServerOp.AllocStat:
          handleAllocStat(session, packet);
          break;
        // Banco (E-4.2)
        case ClientToServerOp.BankDepositItem:
          handleBankDepositItem(session, packet);
          break;
        case ClientToServerOp.BankWithdrawItem:
          handleBankWithdrawItem(session, packet);
          break;
        case ClientToServerOp.BankDepositGold:
          handleBankDepositGold(session, packet);
          break;
        case ClientToServerOp.BankWithdrawGold:
          handleBankWithdrawGold(session, packet);
          break;
        // Party (E-4.3)
        case ClientToServerOp.PartyInvite:
          handlePartyInvite(session, packet);
          break;
        case ClientToServerOp.PartyAccept:
          handlePartyAccept(session);
          break;
        case ClientToServerOp.PartyLeave:
          doPartyLeave(session);
          break;
        // Trade (E-4.4)
        case ClientToServerOp.TradeRequest:
          handleTradeRequest(session, packet);
          break;
        case ClientToServerOp.TradeAccept:
          handleTradeAccept(session);
          break;
        case ClientToServerOp.TradeAddItem:
          handleTradeAddItem(session, packet);
          break;
        case ClientToServerOp.TradeSetGold:
          handleTradeSetGold(session, packet);
          break;
        case ClientToServerOp.TradeConfirm:
          handleTradeConfirm(session);
          break;
        case ClientToServerOp.TradeCancel:
          handleTradeCancel(session);
          break;
        default:
          req.log.warn({ op: (packet as { op: number }).op }, "[ws] opcode desconocido");
          socket.close(CLOSE_UNKNOWN_OPCODE, "UNKNOWN_OPCODE");
      }
    }

    function doMapTransition(s: Session, portal: PortalTile): void {
      const destMap = getMap(portal.toMapId);
      if (!destMap) return;

      const fromMapId = s.mapId;

      const despawn: EntityDespawn = {
        op: ServerToClientOp.EntityDespawn,
        id: s.characterId as EntityId,
      };
      broadcastToMap(fromMapId, despawn, s.id);

      s.mapId = destMap.id;
      s.position = { x: portal.toX, y: portal.toY };
      s.direction = "south";

      send(s.socket, buildMapDataPacket(destMap));

      const spawn: EntitySpawn = {
        op: ServerToClientOp.EntitySpawn,
        id: s.characterId as EntityId,
        position: { x: s.position.x, y: s.position.y },
        direction: s.direction,
        name: s.characterName,
        hp: s.hp,
        maxHp: s.maxHp,
        kind: "player",
        bodyId: s.bodyId,
        headId: s.headId,
        graphic: 0,
      };
      broadcastToMap(destMap.id, spawn, s.id);

      req.log.info(
        { sessionId: s.id, characterId: s.characterId, fromMap: fromMapId, toMap: destMap.id },
        "[ws] transición de mapa",
      );
      mapTransitionsTotal.inc();
    }

    function handleMove(s: Session, move: MoveRequest): void {
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
      broadcastToMap(s.mapId, update);

      const portal = map.portals.find(
        (p) => p.x === s.position.x && p.y === s.position.y,
      );
      if (portal) doMapTransition(s, portal);
    }

    function handleAttack(s: Session, attack: AttackRequest): void {
      const now = Date.now();
      if (s.deadUntil !== 0) return;
      if (now - s.lastAttackAt < ATTACK_COOLDOWN_MS) return;

      const targetId = attack.targetId as unknown as number;
      if (targetId === s.characterId) return;

      if (isNpcId(targetId)) {
        attackNpc(s, targetId, now);
        return;
      }

      const target = sessions.getByCharacterId(targetId);
      if (!target || target.mapId !== s.mapId) return;
      if (target.deadUntil !== 0) return;
      if (!isAdjacent(s.position, target.position)) return;
      if (s.partyId !== null && s.partyId === target.partyId) return;
      // Zona segura: no PvP en ciudad
      if (!canAttackPlayer(s.mapId, target.mapId)) return;

      s.lastAttackAt = now;
      sessions.touch(s.id);

      const defTotal = totalArmorDefense(target.equippedArmor, target.equippedHelmet, target.equippedShield);
      const amount = rollDamage(s.level, s.weaponBonus, s.str, defTotal);
      target.hp = Math.max(0, target.hp - amount);

      const damage: Damage = {
        op: ServerToClientOp.Damage,
        attackerId: s.characterId as EntityId,
        targetId: target.characterId as EntityId,
        amount,
        hp: target.hp,
        maxHp: target.maxHp,
      };
      broadcastToMap(s.mapId, damage);

      syncPartyStats(target);
      if (target.hp === 0) {
        target.deadUntil = now + RESPAWN_DELAY_MS;
        if (target.tradeId) cancelTrade(target.tradeId, "DEATH");
        const death: Death = {
          op: ServerToClientOp.Death,
          id: target.characterId as EntityId,
        };
        broadcastToMap(target.mapId, death);
        req.log.info(
          { attacker: s.characterId, victim: target.characterId },
          "[ws] muerte en combate PvP",
        );
      }
    }

    function attackNpc(s: Session, npcId: number, now: number): void {
      const npc = npcs.get(npcId);
      if (!npc || npc.mapId !== s.mapId || npc.deadUntil !== 0) return;
      if (npc.type.merchant || npc.type.banker) return;
      if (!isAdjacent(s.position, npc.position)) return;

      s.lastAttackAt = now;
      sessions.touch(s.id);

      const amount = rollDamage(s.level, s.weaponBonus, s.str, 0);
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

        const party = partyRegistry.getByCharacter(s.characterId);
        const xpReceivers: Session[] = party
          ? Array.from(party.members.keys())
              .map((id) => sessions.getByCharacterId(id))
              .filter((ms): ms is Session => !!ms && ms.mapId === s.mapId && ms.deadUntil === 0)
          : [s];
        const xpShare = Math.max(1, Math.floor(npc.type.xpReward / xpReceivers.length));
        for (const recv of xpReceivers) {
          const gain = applyXpGain(recv.level, recv.xp, xpShare);
          recv.xp = gain.totalXp;
          if (gain.leveledUp) {
            recv.level = gain.level;
            recv.statPoints += STAT_POINTS_PER_LEVEL;
            // Recalcular HP/MP máximos con la clase del personaje
            const classDef = getClass(recv.classId);
            if (classDef) {
              recv.maxHp = calcMaxHp(classDef, recv.level, recv.con);
              recv.maxMana = calcMaxMp(classDef, recv.level, recv.int_);
            } else {
              recv.maxHp = maxHpForLevel(recv.level);
            }
            recv.hp = recv.maxHp;
            recv.mana = recv.maxMana;
            if (party) partyRegistry.updateMemberStats(recv.characterId, recv.hp, recv.maxHp);
          }
          sendStatsUpdate(recv);
        }
        if (party) broadcastPartyUpdate(party.id);
        sendInventoryUpdate(s);
        req.log.info(
          { attacker: s.characterId, npc: npc.id, xpShare, gold },
          "[ws] NPC eliminado",
        );
        npcKillsTotal.inc();
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
      if (s.equippedWeapon === removed.item && countItem(removed.slots, removed.item) === 0) {
        s.equippedWeapon = null;
      }
      if (s.equippedArmor === removed.item && countItem(removed.slots, removed.item) === 0) {
        s.equippedArmor = null;
      }
      if (s.equippedHelmet === removed.item && countItem(removed.slots, removed.item) === 0) {
        s.equippedHelmet = null;
      }
      if (s.equippedShield === removed.item && countItem(removed.slots, removed.item) === 0) {
        s.equippedShield = null;
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
        if (def.heal !== undefined && def.heal > 0) {
          const healed = Math.min(s.maxHp, s.hp + def.heal);
          if (healed === s.hp) return;
          s.hp = healed;
          const removed = removeItem(s.inventory, pkt.item, 1);
          if (removed) s.inventory = removed;
          sendStatsUpdate(s);
          sendInventoryUpdate(s);
        } else if (def.manaHeal !== undefined && def.manaHeal > 0) {
          if (s.maxMana === 0) return; // clase sin maná
          const restored = Math.min(s.maxMana, s.mana + def.manaHeal);
          if (restored === s.mana) return;
          s.mana = restored;
          const removed = removeItem(s.inventory, pkt.item, 1);
          if (removed) s.inventory = removed;
          sendStatsUpdate(s);
          sendInventoryUpdate(s);
        }
      } else if (def.type === "weapon") {
        s.equippedWeapon = pkt.item;
        sendInventoryUpdate(s);
      } else if (def.type === "armor") {
        s.equippedArmor = pkt.item;
        sendInventoryUpdate(s);
      } else if (def.type === "helmet") {
        s.equippedHelmet = pkt.item;
        sendInventoryUpdate(s);
      } else if (def.type === "shield") {
        s.equippedShield = pkt.item;
        sendInventoryUpdate(s);
      }
    }

    function handleAllocStat(s: Session, pkt: AllocStatRequest): void {
      if (s.statPoints <= 0) return;
      s.statPoints -= 1;
      switch (pkt.stat) {
        case "str": s.str += 1; break;
        case "agi": s.agi += 1; break;
        case "int": s.int_ += 1; break;
        case "con":
          s.con += 1;
          {
            const classDef = getClass(s.classId);
            if (classDef) {
              const newMax = calcMaxHp(classDef, s.level, s.con);
              s.maxHp += newMax - s.maxHp; // aplica solo la diferencia
              s.maxHp = newMax;
            }
          }
          break;
        case "car": s.car += 1; break;
      }
      // Re-calcular MP si sube INT
      if (pkt.stat === "int") {
        const classDef = getClass(s.classId);
        if (classDef) s.maxMana = calcMaxMp(classDef, s.level, s.int_);
      }
      sendStatsUpdate(s);
    }

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
      if (!npc || npc.mapId !== s.mapId) return;
      const dx = Math.abs(npc.position.x - s.position.x);
      const dy = Math.abs(npc.position.y - s.position.y);
      if (Math.max(dx, dy) > 3) return;

      if (npc.type.merchant) {
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
      } else if (npc.type.banker) {
        const bankOpen: BankOpen = {
          op: ServerToClientOp.BankOpen,
          bankerId: npc.id as EntityId,
          bankInventory: s.bankInventory,
          bankGold: s.bankGold,
        };
        send(s.socket, bankOpen);
      }
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
      s.gold += Math.floor(def.value / 2);
      sendInventoryUpdate(s);
    }

    // ── Banco (E-4.2) ────────────────────────────────────────────────────────

    function nearBanker(s: Session): boolean {
      for (const n of npcs.inMap(s.mapId)) {
        if (!n.type.banker) continue;
        const dx = Math.abs(n.position.x - s.position.x);
        const dy = Math.abs(n.position.y - s.position.y);
        if (Math.max(dx, dy) <= 3) return true;
      }
      return false;
    }

    function sendBankUpdate(s: Session): void {
      const pkt: BankUpdate = {
        op: ServerToClientOp.BankUpdate,
        bankInventory: s.bankInventory,
        bankGold: s.bankGold,
        playerInventory: s.inventory,
        playerGold: s.gold,
      };
      send(s.socket, pkt);
    }

    function handleBankDepositItem(s: Session, pkt: BankDepositItemRequest): void {
      if (!nearBanker(s)) return;
      const ok = bankDepositItem(s, pkt.item, pkt.qty);
      if (!ok) return;
      sendBankUpdate(s);
      bankOpsTotal.inc({ op: "deposit_item" });
    }

    function handleBankWithdrawItem(s: Session, pkt: BankWithdrawItemRequest): void {
      if (!nearBanker(s)) return;
      const ok = bankWithdrawItem(s, pkt.item, pkt.qty);
      if (!ok) return;
      sendBankUpdate(s);
      bankOpsTotal.inc({ op: "withdraw_item" });
    }

    function handleBankDepositGold(s: Session, pkt: BankDepositGoldRequest): void {
      if (!nearBanker(s)) return;
      const ok = bankDepositGold(s, pkt.amount);
      if (!ok) return;
      sendBankUpdate(s);
      bankOpsTotal.inc({ op: "deposit_gold" });
    }

    function handleBankWithdrawGold(s: Session, pkt: BankWithdrawGoldRequest): void {
      if (!nearBanker(s)) return;
      const ok = bankWithdrawGold(s, pkt.amount);
      if (!ok) return;
      sendBankUpdate(s);
      bankOpsTotal.inc({ op: "withdraw_gold" });
    }

    // ── Party (E-4.3) ────────────────────────────────────────────────────────

    function broadcastPartyUpdate(partyId: string): void {
      const party = partyRegistry.get(partyId);
      if (!party) return;
      const members = Array.from(party.members.values()).map((m) => ({
        characterId: m.characterId,
        name: m.name,
        hp: m.hp,
        maxHp: m.maxHp,
      }));
      const pkt: PartyUpdate = { op: ServerToClientOp.PartyUpdate, members };
      for (const m of party.members.values()) {
        const ms = sessions.getByCharacterId(m.characterId);
        if (ms) send(ms.socket, pkt);
      }
    }

    function doPartyLeave(s: Session): void {
      if (!s.partyId) return;
      const partyId = s.partyId;
      s.partyId = null;
      const { disbanded, party } = partyRegistry.removeMember(s.characterId);
      if (!party) return;

      if (disbanded) {
        const pkt: PartyDisbanded = { op: ServerToClientOp.PartyDisbanded };
        for (const m of party.members.values()) {
          const ms = sessions.getByCharacterId(m.characterId);
          if (ms) { ms.partyId = null; send(ms.socket, pkt); }
        }
      } else {
        broadcastPartyUpdate(partyId);
      }
    }

    function handlePartyInvite(s: Session, pkt: PartyInviteRequest): void {
      if (s.deadUntil !== 0) return;
      const targetId = pkt.targetId as unknown as number;
      const target = sessions.getByCharacterId(targetId);
      if (!target || target.mapId !== s.mapId) return;
      if (target.partyId) return;
      if (partyRegistry.getInvite(targetId)) return;

      partyRegistry.addInvite(s.characterId, s.characterName, targetId);
      const inv: PartyInviteReceived = {
        op: ServerToClientOp.PartyInviteReceived,
        inviterId: s.characterId,
        inviterName: s.characterName,
      };
      send(target.socket, inv);
    }

    function handlePartyAccept(s: Session): void {
      const invite = partyRegistry.getInvite(s.characterId);
      if (!invite) return;
      partyRegistry.removeInvite(s.characterId);

      const inviterSession = sessions.getByCharacterId(invite.inviterId);

      let party = partyRegistry.getByCharacter(invite.inviterId);
      if (!party) {
        if (inviterSession) {
          party = partyRegistry.create(invite.inviterId, invite.inviterName);
          partyRegistry.updateMemberStats(invite.inviterId, inviterSession.hp, inviterSession.maxHp);
          inviterSession.partyId = party.id;
        } else {
          return;
        }
      }

      partyRegistry.addMember(party, s.characterId, s.characterName);
      partyRegistry.updateMemberStats(s.characterId, s.hp, s.maxHp);
      s.partyId = party.id;
      broadcastPartyUpdate(party.id);
    }

    // ── Trade (E-4.4) ────────────────────────────────────────────────────────

    function sendTradeUpdateForTrade(tradeId: string): void {
      for (const s of sessions.all()) {
        if (s.tradeId !== tradeId) continue;
        const trade = tradeRegistry.getByCharacter(s.characterId);
        if (!trade) continue;
        const isA = s.characterId === trade.playerA;
        const myOffer = isA ? trade.offerA : trade.offerB;
        const theirOffer = isA ? trade.offerB : trade.offerA;
        const other = sessions.getByCharacterId(isA ? trade.playerB : trade.playerA);
        const pkt: TradeUpdate = {
          op: ServerToClientOp.TradeUpdate,
          myOffer: { items: myOffer.items, gold: myOffer.gold, confirmed: myOffer.confirmed },
          theirOffer: { items: theirOffer.items, gold: theirOffer.gold, confirmed: theirOffer.confirmed },
          theirName: other?.characterName ?? "?",
        };
        send(s.socket, pkt);
      }
    }

    function cancelTrade(tradeId: string, reason: string): void {
      const trade = tradeRegistry.remove(tradeId);
      if (!trade) return;
      const pkt: TradeCancelled = { op: ServerToClientOp.TradeCancelled, reason };
      const sA = sessions.getByCharacterId(trade.playerA);
      const sB = sessions.getByCharacterId(trade.playerB);
      if (sA) { sA.tradeId = null; send(sA.socket, pkt); }
      if (sB) { sB.tradeId = null; send(sB.socket, pkt); }
    }

    function handleTradeRequest(s: Session, pkt: TradeRequestMsg): void {
      if (s.deadUntil !== 0) return;
      if (s.tradeId) return;
      const targetId = pkt.targetId as unknown as number;
      if (targetId === s.characterId) return;
      const target = sessions.getByCharacterId(targetId);
      if (!target || target.mapId !== s.mapId) return;
      if (target.tradeId) return;

      tradeRegistry.addInvite(s.characterId, s.characterName, targetId);
      const inv: TradeInviteReceived = {
        op: ServerToClientOp.TradeInviteReceived,
        initiatorId: s.characterId,
        initiatorName: s.characterName,
      };
      send(target.socket, inv);
    }

    function handleTradeAccept(s: Session): void {
      if (s.tradeId) return;
      const invite = tradeRegistry.getInvite(s.characterId);
      if (!invite) return;
      tradeRegistry.removeInvite(s.characterId);

      const initiator = sessions.getByCharacterId(invite.initiatorId);
      if (!initiator || initiator.tradeId) return;

      const trade = tradeRegistry.create(invite.initiatorId, s.characterId);
      initiator.tradeId = trade.id;
      s.tradeId = trade.id;

      sendTradeUpdateForTrade(trade.id);
    }

    function handleTradeAddItem(s: Session, pkt: TradeAddItemMsg): void {
      if (!s.tradeId) return;
      const trade = tradeRegistry.getByCharacter(s.characterId);
      if (!trade) return;

      const isA = s.characterId === trade.playerA;
      const offer = isA ? trade.offerA : trade.offerB;

      trade.offerA.confirmed = false;
      trade.offerB.confirmed = false;
      offer.confirmed = false;

      const def = getItem(pkt.item);
      if (!def) return;
      if (countItem(s.inventory, pkt.item) < pkt.qty) return;

      const existing = offer.items.find((sl) => sl.item === pkt.item);
      if (existing) {
        const newQty = existing.qty + pkt.qty;
        if (countItem(s.inventory, pkt.item) < newQty) return;
        offer.items = offer.items.map((sl) =>
          sl.item === pkt.item ? { item: sl.item, qty: newQty } : sl,
        );
      } else {
        offer.items = [...offer.items, { item: pkt.item, qty: pkt.qty }];
      }

      sendTradeUpdateForTrade(trade.id);
    }

    function handleTradeSetGold(s: Session, pkt: TradeSetGoldMsg): void {
      if (!s.tradeId) return;
      const trade = tradeRegistry.getByCharacter(s.characterId);
      if (!trade) return;
      if (pkt.amount < 0 || pkt.amount > s.gold) return;

      const isA = s.characterId === trade.playerA;
      const offer = isA ? trade.offerA : trade.offerB;
      trade.offerA.confirmed = false;
      trade.offerB.confirmed = false;
      offer.gold = pkt.amount;
      sendTradeUpdateForTrade(trade.id);
    }

    function handleTradeConfirm(s: Session): void {
      if (!s.tradeId) return;
      const trade = tradeRegistry.getByCharacter(s.characterId);
      if (!trade) return;

      const isA = s.characterId === trade.playerA;
      const offer = isA ? trade.offerA : trade.offerB;
      offer.confirmed = true;
      sendTradeUpdateForTrade(trade.id);

      if (!trade.offerA.confirmed || !trade.offerB.confirmed) return;

      const sA = sessions.getByCharacterId(trade.playerA);
      const sB = sessions.getByCharacterId(trade.playerB);
      if (!sA || !sB) {
        cancelTrade(trade.id, "PLAYER_DISCONNECTED");
        return;
      }

      for (const slot of trade.offerA.items) {
        if (countItem(sA.inventory, slot.item) < slot.qty) {
          cancelTrade(trade.id, "OFFER_INVALID"); return;
        }
      }
      if (sA.gold < trade.offerA.gold) { cancelTrade(trade.id, "OFFER_INVALID"); return; }
      for (const slot of trade.offerB.items) {
        if (countItem(sB.inventory, slot.item) < slot.qty) {
          cancelTrade(trade.id, "OFFER_INVALID"); return;
        }
      }
      if (sB.gold < trade.offerB.gold) { cancelTrade(trade.id, "OFFER_INVALID"); return; }

      for (const slot of trade.offerA.items) {
        sA.inventory = removeItem(sA.inventory, slot.item, slot.qty) ?? sA.inventory;
        sB.inventory = addItem(sB.inventory, slot.item, slot.qty);
      }
      sA.gold -= trade.offerA.gold;
      sB.gold += trade.offerA.gold;
      for (const slot of trade.offerB.items) {
        sB.inventory = removeItem(sB.inventory, slot.item, slot.qty) ?? sB.inventory;
        sA.inventory = addItem(sA.inventory, slot.item, slot.qty);
      }
      sB.gold -= trade.offerB.gold;
      sA.gold += trade.offerB.gold;

      tradeRegistry.remove(trade.id);
      sA.tradeId = null;
      sB.tradeId = null;

      const completePkt: TradeComplete = { op: ServerToClientOp.TradeComplete };
      send(sA.socket, completePkt);
      send(sB.socket, completePkt);
      sendInventoryUpdate(sA);
      sendInventoryUpdate(sB);
      tradeCompletedTotal.inc();
    }

    function handleTradeCancel(s: Session): void {
      if (!s.tradeId) return;
      cancelTrade(s.tradeId, "CANCELLED_BY_PLAYER");
    }

    function handleChat(s: Session, chat: ChatSend): void {
      const now = Date.now();
      if (isOnChatCooldown(s.lastChatAt, now)) {
        const err: ChatError = { op: ServerToClientOp.ChatError, reason: "RATE_LIMITED" };
        send(s.socket, err);
        return;
      }

      const validation = validateChatText(chat.text);
      if (!validation.ok) {
        const err: ChatError = { op: ServerToClientOp.ChatError, reason: validation.reason };
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
      broadcastToMap(s.mapId, out);
      chatMessagesTotal.inc();
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
          classId: characters.classId,
          level: characters.level,
          xp: characters.xp,
          hp: characters.hp,
          maxHp: characters.maxHp,
          mana: characters.mana,
          maxMana: characters.maxMana,
          str: characters.str,
          agi: characters.agi,
          int_: characters.int_,
          con: characters.con,
          car: characters.car,
          statPoints: characters.statPoints,
          gold: characters.gold,
          inventory: characters.inventory,
          equippedWeapon: characters.equippedWeapon,
          equippedArmor: characters.equippedArmor,
          equippedHelmet: characters.equippedHelmet,
          equippedShield: characters.equippedShield,
          mapId: characters.mapId,
          posX: characters.posX,
          posY: characters.posY,
          direction: characters.direction,
          bodyId: characters.bodyId,
          headId: characters.headId,
          bankInventory: characters.bankInventory,
          bankGold: characters.bankGold,
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
        spawnInfo = resolveSpawn(character.mapId, { x: character.posX, y: character.posY });
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
      session.classId = character.classId;
      session.level = character.level;
      session.xp = character.xp;
      session.str = character.str;
      session.agi = character.agi;
      session.int_ = character.int_;
      session.con = character.con;
      session.car = character.car;
      session.statPoints = character.statPoints;

      // Recalcular HP/MP máximos desde la clase (fuente de verdad)
      const classDef = getClass(session.classId);
      if (classDef) {
        session.maxHp = calcMaxHp(classDef, session.level, session.con);
        session.maxMana = calcMaxMp(classDef, session.level, session.int_);
      } else {
        session.maxHp = maxHpForLevel(character.level);
        session.maxMana = 0;
      }
      session.hp = character.hp > 0 ? Math.min(character.hp, session.maxHp) : session.maxHp;
      session.mana = Math.min(character.mana, session.maxMana);

      session.gold = character.gold;
      session.inventory = character.inventory.map((sl) => ({ ...sl }));
      session.equippedWeapon = character.equippedWeapon;
      session.equippedArmor = character.equippedArmor;
      session.equippedHelmet = character.equippedHelmet;
      session.equippedShield = character.equippedShield;
      session.bodyId = character.bodyId;
      session.headId = character.headId;
      session.bankInventory = character.bankInventory.map((sl) => ({ ...sl }));
      session.bankGold = character.bankGold;
      recomputeEquipment(session);

      sendLoginResponse(socket, true, undefined, {
        id: character.id as EntityId,
        name: character.name,
        level: character.level,
        classId: character.classId,
      });

      send(socket, buildMapDataPacket(map));

      const spawn: EntitySpawn = {
        op: ServerToClientOp.EntitySpawn,
        id: session.characterId as EntityId,
        position: { x: session.position.x, y: session.position.y },
        direction: session.direction,
        name: session.characterName,
        hp: session.hp,
        maxHp: session.maxHp,
        kind: "player",
        bodyId: session.bodyId,
        headId: session.headId,
        graphic: 0,
      };
      broadcastToMap(map.id, spawn, session.id);

      sendStatsUpdate(session);
      sendInventoryUpdate(session);

      req.log.info(
        {
          sessionId: session.id,
          characterId: character.id,
          characterName: character.name,
          classId: character.classId,
          mapId: map.id,
        },
        "[ws] handshake OK",
      );
    }
  });
};
