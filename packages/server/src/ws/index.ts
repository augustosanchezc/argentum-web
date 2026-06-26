import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  ClientToServerOp,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AnyPacket,
  type ChatBroadcast,
  type ChatError,
  type ChatSend,
  type Direction,
  type EntityDespawn,
  type EntityId,
  type EntitySpawn,
  type EntityUpdate,
  type LoginRequest,
  type LoginResponse,
  type MapData,
  type MoveRequest,
  type Vector2,
} from "@ao/shared";
import { eq, and } from "drizzle-orm";
import { isOnChatCooldown, validateChatText } from "../chat/index.js";
import { db } from "../db/index.js";
import { characters } from "../db/schema/characters.js";
import { getMap, isWalkable, type MapState } from "../world/maps.js";
import { attemptMove } from "../world/movement.js";
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
        default:
          req.log.warn({ op: (packet as { op: number }).op }, "[ws] opcode desconocido");
          socket.close(CLOSE_UNKNOWN_OPCODE, "UNKNOWN_OPCODE");
      }
    }

    function handleMove(s: Session, move: MoveRequest): void {
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

      sendLoginResponse(socket, true, undefined, {
        id: character.id as EntityId,
        name: character.name,
        level: character.level,
      });

      // Mapa + entidades visibles. Por ahora incluimos a TODAS las
      // sesiones del mapa porque no hay rango de vision todavia.
      const entities = sessions.inMap(map.id).map((s) => ({
        id: s.characterId as EntityId,
        position: { x: s.position.x, y: s.position.y },
        name: s.characterName,
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
      };
      send(socket, mapPacket);

      // Avisamos al resto del mapa que aparecio un nuevo personaje.
      const spawn: EntitySpawn = {
        op: ServerToClientOp.EntitySpawn,
        id: session.characterId as EntityId,
        position: { x: session.position.x, y: session.position.y },
        direction: session.direction,
        name: session.characterName,
      };
      broadcastToMap(map.id, spawn, session.id);

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
