import type {
  CharacterSummary,
  Direction,
  EntityId,
  EntityKind,
  Vector2,
} from "./entities.js";
import type { InventorySlot } from "./items.js";
import type { SkillSet } from "./skills-uso.js";

export const PROTOCOL_VERSION = 14;

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
  // Stats (Fase 5)
  AllocStat = 0x4c,
  // Habilidades
  UseSkill = 0x4d,
  // Meditar (toggle) — recupera maná acelerado hasta moverse/atacar.
  Meditate = 0x4e,
  // Lanzar un hechizo del libro (Hechizos.dat) sobre un objetivo.
  CastSpell = 0x4f,
  // Volver al hogar estando muerto (sistema /hogar del AO).
  GoHome = 0x50,
  // Trabajos: aplicar herramienta a un tile (talar/minar/pescar).
  Work = 0x51,
  // Construir un item (herrería/carpintería/fundición).
  Craft = 0x52,
  // Descansar junto a una fogata (toggle).
  Rest = 0x53,
  // Seguro /SEG: no atacar ciudadanos (toggle).
  SafeToggle = 0x54,
  // Misiones (Quests.DAT).
  QuestAccept = 0x55,
  QuestAbandon = 0x56,
  // Clanes (modGuilds.bas — núcleo).
  GuildCreate = 0x57,
  GuildInvite = 0x58,
  GuildAccept = 0x59,
  GuildLeave = 0x5a,
  GuildMessage = 0x5b,
  GuildOnline = 0x5c,
  // Popup de clan: pedir la info del propio clan / editar descripción y reglas (líder).
  GuildInfo = 0x68,
  GuildEdit = 0x69,
  // Directorio de clanes + solicitudes de ingreso.
  GuildList = 0x6a,          // pedir la lista de todos los clanes
  GuildJoinRequest = 0x6b,   // solicitar unirse a un clan
  GuildRequestAccept = 0x6c, // líder/oficial acepta una solicitud
  GuildRequestReject = 0x6d, // líder/oficial rechaza una solicitud
  GuildSetRank = 0x6e,       // líder otorga/quita rango a un miembro
  // Amigos (lista de 50 como el AO).
  FriendAdd = 0x5d,
  FriendRemove = 0x5e,
  FriendList = 0x5f,
  // Ocultarse (DoOcultarse del Trabajo.bas).
  Hide = 0x63,
  // Domar animales (DoDomar): intenta domar la criatura domable más cercana.
  Tame = 0x64,
  // Guardar la config de la barra de macros (persiste por personaje en la DB).
  SaveMacros = 0x65,
  // Cancelar el viaje al hogar en curso (para esperar a que otro te reviva).
  CancelGoHome = 0x66,
  // Disparar una flecha al piso (click en tile vacío): gasta 1 flecha y la
  // deja en el suelo.
  ShootGround = 0x67,
  // Whisper
  WhisperSend = 0x21,
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
  // Detalle de una criatura/NPC (exp, oro, drops) — click derecho.
  NpcInfo = 0x76,
  // Info de un personaje (nombre, descripción, nivel, clan) — click izquierdo.
  PlayerInfo = 0x77,
  Quit = 0x78,
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
  // Cambio de apariencia (ropaje): el body/head visible de una entidad cambió.
  EntityAppearance = 0x96,
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
  NpcInfo = 0xc4,
  PlayerInfo = 0xc5,
  // Party (E-4.3)
  PartyInviteReceived = 0xd0,
  PartyUpdate = 0xd1,
  PartyDisbanded = 0xd2,
  // Trade (E-4.4)
  TradeInviteReceived = 0xe0,
  TradeUpdate = 0xe1,
  TradeComplete = 0xe2,
  TradeCancelled = 0xe3,
  // Habilidades
  SkillEffect = 0xf0,
  // Meditación: estado on/off de una entidad (broadcast al mapa).
  MeditateUpdate = 0xf1,
  // Hechizos conocidos del personaje (login + al aprender).
  SpellsKnown = 0xf2,
  // Estado alterado de una entidad (paralizado/inmovilizado/invisible/
  // ceguera/estupidez) — on/off con duración.
  EntityEffect = 0xf3,
  // Mensaje de consola del server (resultados de trabajos, seguros, etc).
  ConsoleMsg = 0xf4,
  // Un NPC te ofrece una misión (al interactuar).
  QuestOffer = 0xf5,
  // Estado de tus misiones (activas con progreso + completadas).
  QuestState = 0xf6,
  // La facción de un jugador cambió (broadcast — tag bajo el nombre).
  FactionUpdate = 0xf7,
  // El clan de un jugador cambió (broadcast — tag bajo el nombre; null = sin clan).
  GuildTagUpdate = 0xf8,
  // Un tile del mapa cambió (puertas: gráfico de capa 3 + bloqueo).
  MapTileUpdate = 0xf9,
  // Lluvia global (toggle de GM, como el /LLUVIA del AO).
  RainToggle = 0xfa,
  GameConfig = 0xfb,
  ExitOk = 0xfc,
  // Whisper / chat privado
  WhisperReceived = 0xa2,
  // Criminal
  CriminalUpdate = 0xb4,
  // Info del propio clan para el popup (miembros + descripción + reglas).
  GuildInfoResponse = 0xfd,
  // Directorio de todos los clanes (popup cuando no estás en ninguno).
  GuildListResponse = 0xfe,
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
  // Música del mapa (MusicNumMp3 del MapaN.dat — /ao-assets/mp3/N.mp3).
  readonly music?: number;
  readonly width: number;
  readonly height: number;
  // Por tile, indice de gráfico de la capa 1 (suelo) del AO original.
  // Length = width * height, indexado por y * width + x.
  readonly graphic: ReadonlyArray<number>;
  // Capas 2-4 del AO: decoración de suelo, objetos (árboles/paredes que
  // ocluyen entidades) y techos. 0 = sin gráfico en ese tile.
  readonly layer2: ReadonlyArray<number>;
  readonly layer3: ReadonlyArray<number>;
  readonly layer4: ReadonlyArray<number>;
  // Trigger del tile (.map del AO). 1/2/4 = bajo techo (oculta capa 4).
  readonly trigger: ReadonlyArray<number>;
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
    // Jugadores: estado criminal (nombre rojo) vs ciudadano (azul).
    readonly criminal?: boolean;
    // Facción (0 ninguna · 1 Armada Real · 2 Legión Oscura) — tag bajo el nombre.
    readonly faction?: number;
    // Clan (tag <Nombre> bajo el nombre — tiene prioridad sobre la facción).
    readonly guild?: string;
    // Rol GM (0 jugador · 1 Consejero · 2 Semidiós · 3 Dios) — nombre en verde.
    readonly role?: number;
    // Jugadores: nivel y clase, para el label "Lv. N / Nombre - Clase".
    readonly level?: number;
    readonly classId?: number;
    // Jugadores: muerto (fantasma). El cliente lo dibuja atenuado y, si es el
    // propio, mantiene el velo de muerte al cambiar de mapa.
    readonly dead?: boolean;
    // Jugadores: invisible (ocultarse / hechizo / GM). Al entrar al mapa el
    // cliente lo oculta (antes solo se enteraba del cambio en vivo).
    readonly invisible?: boolean;
    // Jugadores: meditando (para ver el aura al entrar al mapa).
    readonly meditating?: boolean;
    // Overlays de equipo visibles (arma/escudo/casco).
    readonly weaponAnim?: number;
    readonly shieldAnim?: number;
    readonly helmetAnim?: number;
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
  // Jugadores: estado criminal (nombre rojo) vs ciudadano (azul).
  readonly criminal?: boolean;
  // Facción (0 ninguna · 1 Armada Real · 2 Legión Oscura).
  readonly faction?: number;
  // Clan (tag <Nombre> bajo el nombre).
  readonly guild?: string;
  // Rol GM (0 jugador · 1 Consejero · 2 Semidiós · 3 Dios) — nombre en verde.
  readonly role?: number;
  // Jugadores: nivel y clase, para el label "Lv. N / Nombre - Clase".
  readonly level?: number;
  readonly classId?: number;
  // Jugadores: muerto (fantasma) — ver MapData.entities.dead.
  readonly dead?: boolean;
  // Jugadores: invisible — ver MapData.entities.invisible.
  readonly invisible?: boolean;
  // Jugadores: meditando — ver MapData.entities.meditating.
  readonly meditating?: boolean;
  // Overlays de equipo visibles (arma/escudo/casco).
  readonly weaponAnim?: number;
  readonly shieldAnim?: number;
  readonly helmetAnim?: number;
}

export interface EntityDespawn {
  readonly op: ServerToClientOp.EntityDespawn;
  readonly id: EntityId;
}

// S→C: la apariencia de una entidad cambió (equipó/desequipó ropaje).
// Broadcast al mapa; el cliente reconstruye los sprites del personaje.
export interface EntityAppearance {
  readonly op: ServerToClientOp.EntityAppearance;
  readonly id: EntityId;
  readonly bodyId: number;
  readonly headId: number;
  // Overlays de equipo (índices de Armas.dat/Escudos.dat/Cascos.ini; 0 = nada).
  readonly weaponAnim?: number;
  readonly shieldAnim?: number;
  readonly helmetAnim?: number;
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
  // Grito (/gritar): el cliente lo muestra en mayúsculas y color destacado.
  readonly yell?: boolean;
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
  // El golpe falló (probabilidad de impacto del AO). amount = 0.
  readonly miss?: boolean;
  // La víctima rechazó el golpe con el escudo. amount = 0.
  readonly blocked?: boolean;
  // Daño extra de apuñalada incluido en amount (para el mensaje del log).
  readonly stab?: boolean;
  // Sonido del atacante si es criatura (Snd de NPCs.dat): rugido al golpear.
  readonly wav?: number;
  // Daño mágico (hechizo/veneno): el cliente NO anima el golpe melee del
  // atacante ni reproduce el impacto físico (el hechizo tiene su propio wav).
  readonly magic?: boolean;
}

// S→C: el objetivo murió (HP llegó a 0). Broadcast al mapa.
export interface Death {
  readonly op: ServerToClientOp.Death;
  readonly id: EntityId;
  // Sonido al morir. Criaturas: su Snd propio (NPCs.dat). Ausente = el cliente
  // usa el grito humano por defecto (jugadores).
  readonly wav?: number;
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
  // Maná (0 para clases sin maná como Guerrero o Arquero)
  readonly mana: number;
  readonly maxMana: number;
  // Stats primarios
  readonly str: number;
  readonly agi: number;
  readonly int: number;
  readonly con: number;
  readonly car: number;
  readonly statPoints: number;
  readonly classId: number;
  readonly race: number;
  readonly gender: number;
  readonly gold: number;
  // Hambre y sed (0-100). En 0 se corta la regeneración (AO original).
  readonly hunger: number;
  readonly thirst: number;
  // Energía (stamina del AO): los golpes y flechas la consumen.
  readonly sta: number;
  readonly maxSta: number;
  // Drogas activas: bonus temporal de STR (Poción Verde) / AGI (Amarilla).
  // 0 = sin efecto. buffExpiresAt = epoch ms del vencimiento (0 si nada).
  readonly strBonus: number;
  readonly agiBonus: number;
  readonly buffExpiresAt: number;
  // Skills por uso (21 skills del AO, 0-100).
  readonly skills: SkillSet;
}

// C→S: el jugador asigna 1 punto de stat libre (ganado al subir de nivel).
export interface AllocStatRequest {
  readonly op: ClientToServerOp.AllocStat;
  readonly stat: "str" | "agi" | "int" | "con" | "car";
}

// C→S: pedir el detalle de una criatura/NPC (click derecho): exp, oro, drops.
export interface NpcInfoRequest {
  readonly op: ClientToServerOp.NpcInfo;
  readonly targetId: EntityId;
}

// S→C: detalle de la criatura/NPC. Los drops incluyen su probabilidad; el oro
// se lista aparte (drops del item de oro, con su rango y chance).
export interface NpcInfoResponse {
  readonly op: ServerToClientOp.NpcInfo;
  readonly number: number;
  readonly name: string;
  readonly maxHp: number;
  // Vida ACTUAL de la criatura clickeada.
  readonly hp: number;
  readonly xpReward: number;
  // Entradas de oro (item 12) con su cantidad y probabilidad.
  readonly gold: ReadonlyArray<{ readonly qty: number; readonly chance: number }>;
  // Otros items dropeados con su probabilidad.
  readonly drops: ReadonlyArray<{ readonly item: number; readonly qty: number; readonly chance: number }>;
}

// C→S: pedir la info de un personaje (click izquierdo sobre él, propio u otro).
export interface PlayerInfoRequest {
  readonly op: ClientToServerOp.PlayerInfo;
  readonly targetId: EntityId;
}

// S→C: info del personaje para mostrar en la consola de chat.
// Formato: "Ves a {name} [{class}] [Nivel: {level}] - {estado}", coloreado
// según el estado (Ciudadano azul · Criminal rojo · Game Master verde). El GM
// no muestra clase ni nivel.
export interface PlayerInfoResponse {
  readonly op: ServerToClientOp.PlayerInfo;
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly classN: string;
  readonly clan: string | null;
  readonly criminal: boolean;
  // Rol GM (0 jugador · 1 Consejero · 2 Semidiós · 3 Dios).
  readonly role: number;
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
  // Interacción con un tile del mapa (puertas/carteles): targetId = 0.
  readonly tile?: Vector2;
}

// C→S: comprar / vender un item en la tienda abierta.
export interface ShopBuyRequest {
  readonly op: ClientToServerOp.ShopBuy;
  readonly item: number;
  readonly qty: number;
}
export interface ShopSellRequest {
  readonly op: ClientToServerOp.ShopSell;
  readonly item: number;
  readonly qty: number;
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
  // Nuevos slots de equipo (Fase 5)
  readonly equippedHelmet: number | null;
  readonly equippedShield: number | null;
  // Tipo de flecha "equipado" (munición seleccionada del arquero).
  readonly equippedArrow?: number | null;
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

// -- Habilidades --

// C→S: usar habilidad de clase (tecla 1 por defecto).
export interface UseSkillRequest {
  readonly op: ClientToServerOp.UseSkill;
  readonly skillId: number;
  readonly targetId?: EntityId; // para skills con objetivo
}

// S→C: resultado de una habilidad. Broadcast al mapa.
export interface SkillEffect {
  readonly op: ServerToClientOp.SkillEffect;
  readonly skillId: number;
  readonly casterId: EntityId;
  readonly targetId?: EntityId;
  // Para daño / curación: cuánto se aplicó
  readonly amount?: number;
  // Maná restante del lanzador (solo se envía al propio lanzador)
  readonly newCasterMana?: number;
  // HP del objetivo después del efecto
  readonly newTargetHp?: number;
  readonly newTargetMaxHp?: number;
  // true si el DoT fue aplicado
  readonly dotApplied?: boolean;
}

// -- Hechizos (libro de Hechizos.dat) --

// C→S: lanzar un hechizo conocido sobre un objetivo (jugador o NPC).
export interface CastSpellRequest {
  readonly op: ClientToServerOp.CastSpell;
  readonly spellId: number;
  readonly targetId: EntityId;
}

// S→C: hechizos que el personaje conoce (IDs de Hechizos.dat).
export interface SpellsKnown {
  readonly op: ServerToClientOp.SpellsKnown;
  readonly spellIds: ReadonlyArray<number>;
}

// C→S: viaje al hogar estando muerto (goHome del AO). El server teletransporta
// al spawn de la ciudad tras el tiempo de viaje.
export interface GoHomeRequest {
  readonly op: ClientToServerOp.GoHome;
}

// C→S: cancelar el viaje al hogar en curso (seguís muerto donde estás).
export interface CancelGoHomeRequest {
  readonly op: ClientToServerOp.CancelGoHome;
}

// C→S: disparar una flecha al piso (tile vacío) — gasta 1 flecha, la deja en
// el suelo. Requiere arco equipado y munición.
export interface ShootGroundRequest {
  readonly op: ClientToServerOp.ShootGround;
  readonly x: number;
  readonly y: number;
}

// -- Trabajos (Trabajo.bas del AO) --

// C→S: aplicar una herramienta sobre un tile (hacha→árbol, piquete→
// yacimiento, caña/red→agua). El server valida distancia y objetivo.
export interface WorkRequest {
  readonly op: ClientToServerOp.Work;
  readonly item: number; // herramienta
  readonly x: number;
  readonly y: number;
}

// C→S: construir un item (herrería junto al yunque, fundición junto a la
// fragua, carpintería con serrucho).
export interface CraftRequest {
  readonly op: ClientToServerOp.Craft;
  readonly item: number;
}

// C→S: descansar (toggle) — requiere fogata cerca.
export interface RestToggle {
  readonly op: ClientToServerOp.Rest;
}

// C→S: seguro /SEG (toggle) — con seguro activado no se ataca a ciudadanos.
export interface SafeToggleRequest {
  readonly op: ClientToServerOp.SafeToggle;
}

// C→S: guarda la config de macros del jugador (opaca para el server).
export interface SaveMacrosRequest {
  readonly op: ClientToServerOp.SaveMacros;
  readonly macros: readonly unknown[];
}

// S→C: mensaje de consola del server (como el ConsoleMsg del AO).
export interface ConsoleMsg {
  readonly op: ServerToClientOp.ConsoleMsg;
  readonly text: string;
  // Pestaña destino: chat/combate/global. "record" = anuncio de nuevo pico de
  // jugadores online (va a la pestaña global, resaltado grande celeste).
  readonly kind: "chat" | "combate" | "global" | "record";
  // WAV opcional a reproducir (talar, pescar, etc.)
  readonly wav?: number;
}

// -- Misiones (Quests.DAT) --

export interface QuestAcceptRequest {
  readonly op: ClientToServerOp.QuestAccept;
  readonly questId: number;
}
export interface QuestAbandonRequest {
  readonly op: ClientToServerOp.QuestAbandon;
  readonly questId: number;
}

// S→C: un NPC ofrece esta misión (el cliente muestra el diálogo con los
// datos de QUESTS del catálogo compartido).
export interface QuestOffer {
  readonly op: ServerToClientOp.QuestOffer;
  readonly questId: number;
}

export interface ActiveQuest {
  readonly id: number;
  // Kills por requisito, alineado con QUESTS[id].npcs.
  readonly kills: ReadonlyArray<number>;
}

// S→C: estado completo de misiones (login + cada cambio).
export interface QuestState {
  readonly op: ServerToClientOp.QuestState;
  readonly active: ReadonlyArray<ActiveQuest>;
  readonly done: ReadonlyArray<number>;
}

// S→C: la facción de un jugador cambió (enlistado/expulsado).
export interface FactionUpdate {
  readonly op: ServerToClientOp.FactionUpdate;
  readonly id: EntityId;
  readonly faction: number;
}

// Clanes (núcleo del modGuilds.bas): fundar, invitar, aceptar, salir, /cmsg.
export interface GuildCreateRequest {
  readonly op: ClientToServerOp.GuildCreate;
  readonly name: string;
}
export interface GuildInviteRequest {
  readonly op: ClientToServerOp.GuildInvite;
  // Nombre del personaje a invitar (debe estar online).
  readonly targetName: string;
}
export interface GuildAcceptRequest {
  readonly op: ClientToServerOp.GuildAccept;
}
export interface GuildLeaveRequest {
  readonly op: ClientToServerOp.GuildLeave;
}
export interface GuildMessageRequest {
  readonly op: ClientToServerOp.GuildMessage;
  readonly text: string;
}
export interface GuildOnlineRequest {
  readonly op: ClientToServerOp.GuildOnline;
}
// C→S: pedir la info del propio clan para el popup (miembros + desc + reglas).
export interface GuildInfoRequest {
  readonly op: ClientToServerOp.GuildInfo;
}
// C→S: el líder edita la descripción y las reglas del clan.
export interface GuildEditRequest {
  readonly op: ClientToServerOp.GuildEdit;
  readonly description: string;
  readonly rules: string;
}

// Un miembro del clan, para el listado del popup.
export interface GuildMemberInfo {
  readonly characterId: number;
  readonly name: string;
  readonly level: number;
  readonly classId: number;
  readonly online: boolean;
  readonly leader: boolean;
  // Rango: 0 = miembro · 1 = oficial.
  readonly rank: number;
}
// Una solicitud de ingreso pendiente (visible para líder/oficiales).
export interface GuildRequestInfo {
  readonly characterId: number;
  readonly name: string;
  readonly level: number;
  readonly classId: number;
}
// S→C: info completa del propio clan (respuesta a GuildInfoRequest).
export interface GuildInfoResponse {
  readonly op: ServerToClientOp.GuildInfoResponse;
  readonly name: string;
  // 0 = Ciudadanos · 1 = Criminales.
  readonly faction: number;
  readonly description: string;
  readonly rules: string;
  // ¿El que pide es el líder? (habilita editar descripción/reglas y rangos).
  readonly isLeader: boolean;
  // ¿Puede gestionar solicitudes (líder u oficial)?
  readonly canManage: boolean;
  readonly maxMembers: number;
  readonly members: readonly GuildMemberInfo[];
  // Solicitudes pendientes (solo se llena para quien puede gestionar).
  readonly requests: readonly GuildRequestInfo[];
}

// Un clan en el directorio (popup cuando NO estás en ningún clan).
export interface GuildDirectoryEntry {
  readonly id: number;
  readonly name: string;
  readonly faction: number;
  readonly leaderName: string;
  readonly memberCount: number;
  readonly maxMembers: number;
  readonly description: string;
  // ¿Ya mandaste solicitud a este clan?
  readonly requested: boolean;
  // ¿Podés unirte (misma facción y con cupo)?
  readonly canJoin: boolean;
}
// C→S: pedir el directorio de todos los clanes.
export interface GuildListRequest {
  readonly op: ClientToServerOp.GuildList;
}
// S→C: directorio de clanes.
export interface GuildListResponse {
  readonly op: ServerToClientOp.GuildListResponse;
  // Facción del que pide (para saber a cuáles puede unirse). 0/1.
  readonly myFaction: number;
  readonly guilds: readonly GuildDirectoryEntry[];
}
// C→S: solicitar unirse a un clan.
export interface GuildJoinRequestReq {
  readonly op: ClientToServerOp.GuildJoinRequest;
  readonly guildId: number;
}
// C→S: aceptar / rechazar una solicitud (líder u oficial).
export interface GuildRequestAcceptReq {
  readonly op: ClientToServerOp.GuildRequestAccept;
  readonly characterId: number;
}
export interface GuildRequestRejectReq {
  readonly op: ClientToServerOp.GuildRequestReject;
  readonly characterId: number;
}
// C→S: el líder otorga (rank=1) o quita (rank=0) rango a un miembro.
export interface GuildSetRankReq {
  readonly op: ClientToServerOp.GuildSetRank;
  readonly characterId: number;
  readonly rank: number;
}

// Amigos: agregar/quitar por nombre y pedir la lista (respuestas por ConsoleMsg).
export interface FriendAddRequest {
  readonly op: ClientToServerOp.FriendAdd;
  readonly name: string;
}
export interface FriendRemoveRequest {
  readonly op: ClientToServerOp.FriendRemove;
  readonly name: string;
}
export interface FriendListRequest {
  readonly op: ClientToServerOp.FriendList;
}

// C→S: intentar ocultarse entre las sombras (skill Ocultarse).
export interface HideRequest {
  readonly op: ClientToServerOp.Hide;
}

// C→S: intentar domar la criatura domable más cercana (skill Domar).
export interface TameRequest {
  readonly op: ClientToServerOp.Tame;
}

// S→C: el clan de un jugador cambió (broadcast — tag bajo el nombre).
export interface GuildTagUpdate {
  readonly op: ServerToClientOp.GuildTagUpdate;
  readonly id: EntityId;
  readonly guild: string | null;
}

// S→C: llueve / dejó de llover (global — /LLUVIA de GM).
export interface RainToggle {
  readonly op: ServerToClientOp.RainToggle;
  readonly raining: boolean;
}

// S→C: intervalos de jugabilidad editables desde el panel admin (ms). Se manda
// al entrar al mundo y cada vez que el admin los cambia, para que el cliente
// sincronice sus cooldowns locales (golpe melee, flechas) con el server EN VIVO.
export interface GameConfigMsg {
  readonly op: ServerToClientOp.GameConfig;
  readonly intervals: Readonly<Record<string, number>>;
}

// C→S: pedido de salir del juego (/salir). El server responde ExitOk enseguida
// en zona segura, o tras la cuenta regresiva en zona insegura.
export interface QuitRequest {
  readonly op: ClientToServerOp.Quit;
}

// S→C: el server autoriza la salida → el cliente vuelve a la selección de
// personaje / cierra.
export interface ExitOkMsg {
  readonly op: ServerToClientOp.ExitOk;
}

// S→C: un tile cambió (puertas del AO: nuevo GRH de capa 3 + bloqueo).
// wav opcional (SND_PUERTA = 5).
export interface MapTileUpdate {
  readonly op: ServerToClientOp.MapTileUpdate;
  readonly x: number;
  readonly y: number;
  readonly grh3: number;
  readonly blocked: boolean;
  readonly wav?: number;
}

// -- Estados alterados (hechizos del AO) --

export type EffectKind = "paralyzed" | "immobilized" | "invisible" | "blind" | "dumb";

// S→C: una entidad entró/salió de un estado. paralyzed/immobilized/invisible
// se broadcastean al mapa (todos lo ven); blind/dumb solo al afectado.
export interface EntityEffect {
  readonly op: ServerToClientOp.EntityEffect;
  readonly id: EntityId;
  readonly effect: EffectKind;
  readonly active: boolean;
  readonly durationMs?: number;
}

// -- Meditar --

// C→S: toggle de meditación. El server la corta al moverse/atacar/recibir daño.
export interface MeditateToggle {
  readonly op: ClientToServerOp.Meditate;
}

// S→C: broadcast al mapa — una entidad empezó/terminó de meditar.
export interface MeditateUpdate {
  readonly op: ServerToClientOp.MeditateUpdate;
  readonly id: EntityId;
  readonly meditating: boolean;
}

// -- Whisper --

// C→S: mensaje privado a otro jugador.
export interface WhisperSendRequest {
  readonly op: ClientToServerOp.WhisperSend;
  readonly targetName: string;
  readonly text: string;
}

// S→C: whisper recibido (se envía tanto al emisor como al receptor).
export interface WhisperReceived {
  readonly op: ServerToClientOp.WhisperReceived;
  readonly fromName: string;
  readonly toName: string;
  readonly text: string;
  readonly outgoing: boolean; // true = lo envié yo, false = lo recibí
  readonly timestamp: number;
}

// -- Criminal --

// S→C: el estado criminal de un jugador cambió. Broadcast al mapa —
// todos ven el color del nombre (rojo criminal / azul ciudadano).
export interface CriminalUpdate {
  readonly op: ServerToClientOp.CriminalUpdate;
  readonly id: EntityId;
  readonly criminal: boolean;
  readonly expiresAt: number; // epoch ms (0 si no es criminal)
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
  | AllocStatRequest
  | NpcInfoRequest
  | PlayerInfoRequest
  | UseSkillRequest
  | MeditateToggle
  | CastSpellRequest
  | GoHomeRequest
  | CancelGoHomeRequest
  | ShootGroundRequest
  | WorkRequest
  | CraftRequest
  | RestToggle
  | SafeToggleRequest
  | SaveMacrosRequest
  | QuestAcceptRequest
  | QuestAbandonRequest
  | GuildCreateRequest
  | GuildInviteRequest
  | GuildAcceptRequest
  | GuildLeaveRequest
  | GuildMessageRequest
  | GuildOnlineRequest
  | GuildInfoRequest
  | GuildEditRequest
  | GuildListRequest
  | GuildJoinRequestReq
  | GuildRequestAcceptReq
  | GuildRequestRejectReq
  | GuildSetRankReq
  | FriendAddRequest
  | FriendRemoveRequest
  | FriendListRequest
  | HideRequest
  | TameRequest
  | WhisperSendRequest
  | DisconnectRequest;
export type ServerPacket =
  | LoginResponse
  | MapData
  | EntityUpdate
  | EntitySpawn
  | EntityDespawn
  | EntityAppearance
  | ChatBroadcast
  | ChatError
  | Damage
  | Death
  | Respawn
  | StatsUpdate
  | NpcInfoResponse
  | PlayerInfoResponse
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
  | TradeCancelled
  | SkillEffect
  | MeditateUpdate
  | SpellsKnown
  | EntityEffect
  | ConsoleMsg
  | QuestOffer
  | QuestState
  | FactionUpdate
  | GuildTagUpdate
  | GuildInfoResponse
  | GuildListResponse
  | MapTileUpdate
  | RainToggle
  | GameConfigMsg
  | QuitRequest
  | ExitOkMsg
  | WhisperReceived
  | CriminalUpdate;
export type AnyPacket = ClientPacket | ServerPacket;
