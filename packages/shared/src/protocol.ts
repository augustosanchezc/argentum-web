import type { CharacterSummary, Direction, EntityId, Vector2 } from "./entities.js";

export const PROTOCOL_VERSION = 1;

export enum ClientToServerOp {
  LoginRequest = 0x01,
  Move = 0x10,
  ChatSend = 0x20,
  Attack = 0x30,
  Disconnect = 0xff,
}

export enum ServerToClientOp {
  LoginResponse = 0x81,
  MapData = 0x90,
  EntityUpdate = 0x91,
  EntitySpawn = 0x92,
  EntityDespawn = 0x93,
  ChatBroadcast = 0xa0,
  ChatError = 0xa1,
  Damage = 0xb0,
  Death = 0xb1,
  Respawn = 0xb2,
}

export interface LoginRequest {
  readonly op: ClientToServerOp.LoginRequest;
  readonly token: string;
  readonly characterId: EntityId;
  readonly clientVersion: number;
}

export interface LoginResponse {
  readonly op: ServerToClientOp.LoginResponse;
  readonly ok: boolean;
  readonly reason?: string;
  readonly character?: CharacterSummary;
}

export interface MoveRequest {
  readonly op: ClientToServerOp.Move;
  readonly direction: Direction;
  readonly sequence: number;
}

export interface MapData {
  readonly op: ServerToClientOp.MapData;
  readonly mapId: number;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  // Por tile, indice de gráfico (capa de suelo del AO original).
  // El cliente lo mapea a color por rango / a tileset real cuando exista.
  // Length = width * height, indexado por y * width + x.
  readonly graphic: ReadonlyArray<number>;
  // 1 = bloqueado (no caminable), 0 = caminable. Length = width * height.
  readonly blocked: ReadonlyArray<number>;
  readonly entities: ReadonlyArray<{
    readonly id: EntityId;
    readonly position: Vector2;
    readonly name: string;
    readonly hp: number;
    readonly maxHp: number;
  }>;
}

export interface EntityUpdate {
  readonly op: ServerToClientOp.EntityUpdate;
  readonly id: EntityId;
  readonly position: Vector2;
  readonly direction: Direction;
}

export interface EntitySpawn {
  readonly op: ServerToClientOp.EntitySpawn;
  readonly id: EntityId;
  readonly position: Vector2;
  readonly direction: Direction;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
}

export interface EntityDespawn {
  readonly op: ServerToClientOp.EntityDespawn;
  readonly id: EntityId;
}

export interface DisconnectRequest {
  readonly op: ClientToServerOp.Disconnect;
}

// Limites compartidos para validar tanto en cliente como en server.
export const CHAT_TEXT_MAX_LENGTH = 200;

export interface ChatSend {
  readonly op: ClientToServerOp.ChatSend;
  readonly text: string;
}

export interface ChatBroadcast {
  readonly op: ServerToClientOp.ChatBroadcast;
  readonly fromId: EntityId;
  readonly fromName: string;
  readonly text: string;
  // Epoch ms del server. El cliente formatea HH:mm con su locale.
  readonly timestamp: number;
}

export interface ChatError {
  readonly op: ServerToClientOp.ChatError;
  // RATE_LIMITED | EMPTY | TOO_LONG | BLOCKED
  readonly reason: string;
}

// -- Combate (Fase 2, E-2.2) --

// C→S: el cliente pide atacar al objetivo apuntado (el personaje en el tile
// que tiene en frente). El server valida rango, cooldown y que exista.
export interface AttackRequest {
  readonly op: ClientToServerOp.Attack;
  readonly targetId: EntityId;
}

// S→C: resultado de un golpe. Se hace broadcast al mapa para que todos
// actualicen la barra de HP del objetivo y muestren el número flotante.
export interface Damage {
  readonly op: ServerToClientOp.Damage;
  readonly attackerId: EntityId;
  readonly targetId: EntityId;
  readonly amount: number;
  // HP del objetivo tras el golpe (0..maxHp).
  readonly hp: number;
  readonly maxHp: number;
}

// S→C: el objetivo murió (HP llegó a 0). Broadcast al mapa.
export interface Death {
  readonly op: ServerToClientOp.Death;
  readonly id: EntityId;
}

// S→C: un personaje muerto reapareció en su punto de spawn con HP al máximo.
export interface Respawn {
  readonly op: ServerToClientOp.Respawn;
  readonly id: EntityId;
  readonly position: Vector2;
  readonly hp: number;
  readonly maxHp: number;
}

export type ClientPacket =
  | LoginRequest
  | MoveRequest
  | ChatSend
  | AttackRequest
  | DisconnectRequest;
export type ServerPacket =
  | LoginResponse
  | MapData
  | EntityUpdate
  | EntitySpawn
  | EntityDespawn
  | ChatBroadcast
  | ChatError
  | Damage
  | Death
  | Respawn;
export type AnyPacket = ClientPacket | ServerPacket;
