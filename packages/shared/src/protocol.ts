import type {
  CharacterSummary,
  Direction,
  EntityId,
  EntityKind,
  Vector2,
} from "./entities.js";
import type { InventorySlot } from "./items.js";

export const PROTOCOL_VERSION = 1;

export enum ClientToServerOp {
  LoginRequest = 0x01,
  Move = 0x10,
  ChatSend = 0x20,
  Attack = 0x30,
  Pickup = 0x40,
  UseItem = 0x41,
  Interact = 0x42,
  ShopBuy = 0x43,
  ShopSell = 0x44,
  DropItem = 0x45,
  InventoryReorder = 0x46,
  // Banco (E-4.2)
  BankDepositItem = 0x47,
  BankWithdrawItem = 0x48,
  BankDepositGold = 0x49,
  BankWithdrawGold = 0x4a,
  // Party (E-4.3)
  PartyInvite = 0x60,
  PartyAccept = 0x61,
  PartyLeave = 0x62,
  // Trade (E-4.4)
  TradeRequest = 0x70,
  TradeAccept = 0x71,
  TradeAddItem = 0x72,
  TradeSetGold = 0x73,
  TradeConfirm = 0x74,
  TradeCancel = 0x75,
  Disconnect = 0xff,
}

export enum ServerToClientOp {
  LoginResponse = 0x81,
  MapData = 0x90,
  EntityUpdate = 0x91,
  EntitySpawn = 0x92,
  EntityDespawn = 0x93,
  GroundItemSpawn = 0x94,
  GroundItemDespawn = 0x95,
  ChatBroadcast = 0xa0,
  ChatError = 0xa1,
  Damage = 0xb0,
  Death = 0xb1,
  Respawn = 0xb2,
  StatsUpdate = 0xb3,
  InventoryUpdate = 0xc0,
  ShopOpen = 0xc1,
  // Banco (E-4.2)
  BankOpen = 0xc2,
  BankUpdate = 0xc3,
  // Party (E-4.3)
  PartyInviteReceived = 0xd0,
  PartyUpdate = 0xd1,
  PartyDisbanded = 0xd2,
  // Trade (E-4.4)
  TradeInviteReceived = 0xe0,
  TradeUpdate = 0xe1,
  TradeComplete = 0xe2,
  TradeCancelled = 0xe3,
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
    readonly direction: Direction;
    readonly name: string;
    readonly hp: number;
    readonly maxHp: number;
    readonly kind: EntityKind;
    // Body/head para el sistema de sprites del AO clasico (Personajes.ind /
    // Cabezas.ind). 0 significa que la entidad usa el sprite genérico del
    // gráfico legacy (para NPCs monstruo tipo rata/lobo).
    readonly bodyId: number;
    readonly headId: number;
    // Grafico legacy — usado si bodyId=0 (NPCs monstruo con sprite unico).
    readonly graphic: number;
  }>;
  // Items tirados en el suelo del mapa (E-3.2).
  readonly groundItems: ReadonlyArray<{
    readonly id: EntityId;
    readonly position: Vector2;
    readonly item: number;
    readonly qty: number;
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
  readonly kind: EntityKind;
  readonly bodyId: number;
  readonly headId: number;
  readonly graphic: number;
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

// S→C: stats del propio personaje cambiaron (ganó XP, subió de nivel, se curó).
// Solo se envía al jugador dueño del personaje (no es broadcast).
export interface StatsUpdate {
  readonly op: ServerToClientOp.StatsUpdate;
  readonly level: number;
  readonly xp: number;
  // XP total acumulada necesaria para alcanzar el siguiente nivel.
  readonly xpForNextLevel: number;
  readonly hp: number;
  readonly maxHp: number;
}

// -- Items, inventario y tienda (Fase 3, E-3.2/3.3/3.4) --

// C→S: recoger el item que está en el tile del propio personaje.
export interface PickupRequest {
  readonly op: ClientToServerOp.Pickup;
}

// C→S: usar/equipar un item del inventario (poción cura; arma/armadura se equipan).
export interface UseItemRequest {
  readonly op: ClientToServerOp.UseItem;
  readonly item: number;
}

// C→S: interactuar con un NPC (abrir la tienda de un comerciante).
export interface InteractRequest {
  readonly op: ClientToServerOp.Interact;
  readonly targetId: EntityId;
}

// C→S: comprar / vender un item en la tienda abierta.
export interface ShopBuyRequest {
  readonly op: ClientToServerOp.ShopBuy;
  readonly item: number;
}
export interface ShopSellRequest {
  readonly op: ClientToServerOp.ShopSell;
  readonly item: number;
}

// C→S: tirar un item del inventario al tile actual del jugador.
// qty se ignora para no-apilables (siempre 1); para pociones/oro se toma
// como cantidad a soltar (clamp al total disponible).
export interface DropItemRequest {
  readonly op: ClientToServerOp.DropItem;
  readonly slot: number;
  readonly qty: number;
}

// C→S: reordenar el inventario intercambiando dos slots.
// from/to son índices dentro del array de slots que ve el cliente. Si
// alguno está vacío o fuera de rango, el server ignora el paquete.
export interface InventoryReorderRequest {
  readonly op: ClientToServerOp.InventoryReorder;
  readonly from: number;
  readonly to: number;
}

// S→C: apareció un item en el suelo.
export interface GroundItemSpawn {
  readonly op: ServerToClientOp.GroundItemSpawn;
  readonly id: EntityId;
  readonly position: Vector2;
  readonly item: number;
  readonly qty: number;
}

// S→C: se levantó / desapareció un item del suelo.
export interface GroundItemDespawn {
  readonly op: ServerToClientOp.GroundItemDespawn;
  readonly id: EntityId;
}

// S→C: estado completo del inventario del jugador (se reenvía en cada cambio).
export interface InventoryUpdate {
  readonly op: ServerToClientOp.InventoryUpdate;
  readonly gold: number;
  readonly slots: ReadonlyArray<InventorySlot>;
  readonly equippedWeapon: number | null;
  readonly equippedArmor: number | null;
}

// S→C: abrir la ventana de tienda con la oferta del comerciante.
export interface ShopOpen {
  readonly op: ServerToClientOp.ShopOpen;
  readonly merchantId: EntityId;
  readonly offers: ReadonlyArray<{ readonly item: number; readonly price: number }>;
}

// -- Banco (E-4.2) --

export interface BankDepositItemRequest {
  readonly op: ClientToServerOp.BankDepositItem;
  readonly item: number;
  readonly qty: number;
}
export interface BankWithdrawItemRequest {
  readonly op: ClientToServerOp.BankWithdrawItem;
  readonly item: number;
  readonly qty: number;
}
export interface BankDepositGoldRequest {
  readonly op: ClientToServerOp.BankDepositGold;
  readonly amount: number;
}
export interface BankWithdrawGoldRequest {
  readonly op: ClientToServerOp.BankWithdrawGold;
  readonly amount: number;
}

// S→C: abre la ventana del banco con el estado actual.
export interface BankOpen {
  readonly op: ServerToClientOp.BankOpen;
  readonly bankerId: EntityId;
  readonly bankInventory: ReadonlyArray<InventorySlot>;
  readonly bankGold: number;
}
// S→C: estado del banco actualizado tras un depósito/retiro.
export interface BankUpdate {
  readonly op: ServerToClientOp.BankUpdate;
  readonly bankInventory: ReadonlyArray<InventorySlot>;
  readonly bankGold: number;
  // También incluye inventario + oro del jugador (cambiaron).
  readonly playerInventory: ReadonlyArray<InventorySlot>;
  readonly playerGold: number;
}

// -- Party (E-4.3) --

export interface PartyInviteRequest {
  readonly op: ClientToServerOp.PartyInvite;
  readonly targetId: EntityId;
}
export interface PartyAcceptRequest {
  readonly op: ClientToServerOp.PartyAccept;
}
export interface PartyLeaveRequest {
  readonly op: ClientToServerOp.PartyLeave;
}

export interface PartyMemberData {
  readonly characterId: number;
  readonly name: string;
  readonly hp: number;
  readonly maxHp: number;
}

// S→C: alguien te invitó a una party.
export interface PartyInviteReceived {
  readonly op: ServerToClientOp.PartyInviteReceived;
  readonly inviterId: number;
  readonly inviterName: string;
}
// S→C: estado completo de la party (se envía al unirse, al salir alguien y en cada tick de HP).
export interface PartyUpdate {
  readonly op: ServerToClientOp.PartyUpdate;
  readonly members: ReadonlyArray<PartyMemberData>;
}
// S→C: la party fue disuelta.
export interface PartyDisbanded {
  readonly op: ServerToClientOp.PartyDisbanded;
}

// -- Trade (E-4.4) --

export interface TradeRequestMsg {
  readonly op: ClientToServerOp.TradeRequest;
  readonly targetId: EntityId;
}
export interface TradeAcceptMsg {
  readonly op: ClientToServerOp.TradeAccept;
}
export interface TradeAddItemMsg {
  readonly op: ClientToServerOp.TradeAddItem;
  readonly item: number;
  readonly qty: number;
}
export interface TradeSetGoldMsg {
  readonly op: ClientToServerOp.TradeSetGold;
  readonly amount: number;
}
export interface TradeConfirmMsg {
  readonly op: ClientToServerOp.TradeConfirm;
}
export interface TradeCancelMsg {
  readonly op: ClientToServerOp.TradeCancel;
}

export interface TradeOfferData {
  readonly items: ReadonlyArray<InventorySlot>;
  readonly gold: number;
  readonly confirmed: boolean;
}

// S→C: alguien quiere comerciar con vos.
export interface TradeInviteReceived {
  readonly op: ServerToClientOp.TradeInviteReceived;
  readonly initiatorId: number;
  readonly initiatorName: string;
}
// S→C: estado actual del trade (mi oferta + su oferta).
export interface TradeUpdate {
  readonly op: ServerToClientOp.TradeUpdate;
  readonly myOffer: TradeOfferData;
  readonly theirOffer: TradeOfferData;
  readonly theirName: string;
}
// S→C: trade completado — el inventario del jugador ya fue actualizado.
export interface TradeComplete {
  readonly op: ServerToClientOp.TradeComplete;
}
// S→C: trade cancelado.
export interface TradeCancelled {
  readonly op: ServerToClientOp.TradeCancelled;
  readonly reason: string;
}

export type ClientPacket =
  | LoginRequest
  | MoveRequest
  | ChatSend
  | AttackRequest
  | PickupRequest
  | UseItemRequest
  | InteractRequest
  | ShopBuyRequest
  | ShopSellRequest
  | DropItemRequest
  | InventoryReorderRequest
  | BankDepositItemRequest
  | BankWithdrawItemRequest
  | BankDepositGoldRequest
  | BankWithdrawGoldRequest
  | PartyInviteRequest
  | PartyAcceptRequest
  | PartyLeaveRequest
  | TradeRequestMsg
  | TradeAcceptMsg
  | TradeAddItemMsg
  | TradeSetGoldMsg
  | TradeConfirmMsg
  | TradeCancelMsg
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
  | Respawn
  | StatsUpdate
  | GroundItemSpawn
  | GroundItemDespawn
  | InventoryUpdate
  | ShopOpen
  | BankOpen
  | BankUpdate
  | PartyInviteReceived
  | PartyUpdate
  | PartyDisbanded
  | TradeInviteReceived
  | TradeUpdate
  | TradeComplete
  | TradeCancelled;
export type AnyPacket = ClientPacket | ServerPacket;
