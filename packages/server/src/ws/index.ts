import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  ClientToServerOp,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AllocStatRequest,
  type NpcInfoRequest,
  type NpcInfoResponse,
  type PlayerInfoRequest,
  type PlayerInfoResponse,
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
  type EntityAppearance,
  type EntityDespawn,
  type EntityEffect,
  type FactionUpdate,
  type GuildCreateRequest,
  type GuildEditRequest,
  type GuildInfoResponse,
  type GuildInviteRequest,
  type GuildJoinRequestReq,
  type GuildListResponse,
  type GuildDirectoryEntry,
  type GuildMemberInfo,
  type GuildMessageRequest,
  type GuildRequestAcceptReq,
  type GuildRequestInfo,
  type GuildRequestRejectReq,
  type GuildSetRankReq,
  type GuildTagUpdate,
  type MapTileUpdate,
  type RainToggle,
  type GameConfigMsg,
  type ExitOkMsg,
  type EntityId,
  type EntitySpawn,
  type EntityUpdate,
  type InventorySlot,
  type GroundItemDespawn,
  type GroundItemSpawn,
  type InteractRequest,
  type InventoryReorderRequest,
  type InventoryUpdate,
  type LoginRequest,
  type LoginResponse,
  type MapData,
  type MeditateUpdate,
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
  type ShootGroundRequest,
  type UseSkillRequest,
  type CastSpellRequest,
  type ConsoleMsg,
  type CraftRequest,
  type SkillEffect,
  type SpellsKnown,
  type WorkRequest,
  getAoSpell,
  getSkill,
  knownSpellsFor,
  spellLearnLevel,
  classUsesMagic,
  type WhisperSendRequest,
  type WhisperReceived,
  type CriminalUpdate,
  type QuestAcceptRequest,
  type QuestAbandonRequest,
  type QuestOffer,
  type QuestState,
  type Vector2,
  QUESTS,
  getItem,
  skillsForLevel,
} from "@ao/shared";
import { eq, and, sql } from "drizzle-orm";
import { isOnChatCooldown, validateChatText } from "../chat/index.js";
import { db } from "../db/index.js";
import { characters } from "../db/schema/characters.js";
import { guilds } from "../db/schema/guilds.js";
import {
  INTERVALS,
  RANGED_RANGE,
  calcularDano,
  isAdjacent,
  playerPoderAtaqueArma,
  playerPoderAtaqueProyectil,
  playerPoderEvasion,
  playerPoderEvasionEscudo,
  rollHit,
  rollShieldBlock,
  rollStab,
} from "../world/combat.js";
import { getClassMods } from "../world/balance.js";
import { trainSkill } from "../world/skill-training.js";
import {
  MINERALS_PER_INGOT,
  OBJTYPE,
  PRODUCTS,
  SMELT_MAP,
  TOOLS,
  WORK_INTERVAL_MS,
  WORK_WAV,
  isWaterGraphic,
  objTypeNear,
  rollWorkSuccess,
  toolKind,
} from "../world/work.js";
import { groundItems } from "../world/ground-items.js";
import {
  addItem,
  armorDefenseFor,
  countItem,
  helmetDefenseFor,
  carryCapacity,
  removeFromSlot,
  removeItem,
  reorderSlots,
  sanQty,
  shieldDefenseFor,
  rollTotalArmorDefense,
  weaponBonusFor,
} from "../world/inventory.js";
import {
  bankDepositGold,
  bankDepositItem,
  bankWithdrawGold,
  bankWithdrawItem,
} from "../world/bank.js";
import { findLandingTile, getMap, isWalkable, isWaterAt, type MapState } from "../world/maps.js";
import type { PortalTile } from "../world/maps.js";
import { attemptMove } from "../world/movement.js";
import { GOLD_ITEM, MAX_MASCOTAS, getNpcType, isNpcId, npcDeathSound, npcs, petsOf, rollNpcDamage, rollNpcGold, type NpcInstance } from "../world/npcs.js";
import { setPetAttackHandler, setPlayerDeathHandler, setPlayerDamagedHandler } from "./loop.js";
import { weather } from "../world/weather.js";
import { accounts } from "../db/schema/accounts.js";
import { partyRegistry } from "../world/party.js";
import { tradeRegistry } from "../world/trade.js";
import { applyXpGain, calcMaxHp, calcMaxMp, levelProgress, maxHpForLevel, MAX_LEVEL } from "../world/xp.js";
import { getClass, golpeUsuario, calcMaxSta } from "../world/classes.js";
import { tickRegen, REGEN_INTERVAL_MS } from "../world/regen.js";
import { currentIntervals, onIntervalsChanged } from "../world/game-config.js";
import { addCustomTeleport, removeCustomTeleport } from "../world/teleports.js";
import { addNpcDeletion } from "../world/npc-deletions.js";
import { addGmNpc, removeGmNpc } from "../world/gm-npcs.js";
import { addBlock, removeBlock, isBlockStored } from "../world/blocked-tiles.js";
import { isIpBanned, banIp, unbanIp } from "../world/ip-bans.js";
import { canAttackPlayer } from "../world/zones.js";
import { activeDots, executeSkill } from "../world/skills.js";
import {
  ENLISTER_FACTION,
  FACTION_NAMES,
  FACTION_ARMOR_IDS,
  canEnlistArmada,
  canEnlistCaos,
  factionRankName,
  factionRankArmor,
  killGivesFactionPoints,
  killLevelValid,
  nextRank,
  POINTS_PER_KILL,
  REKILL_COOLDOWN_MS,
  FACTION_ARMADA,
  FACTION_CAOS,
  FACTION_NONE,
} from "../world/factions.js";
import {
  canFoundGuild,
  canJoinGuild,
  canManageGuild,
  clearRequestsForCharacter,
  clearRequestsForGuild,
  createGuild,
  createJoinRequest,
  deleteJoinRequest,
  factionName,
  getGuild,
  getGuildMembers,
  guildIdsRequestedBy,
  isGuildLeader,
  joinGuild,
  joinGuildById,
  leaveGuild,
  listGuilds,
  listJoinRequests,
  sessionFaction,
  setGuildRank,
  setGuildText,
  validGuildName,
  GUILD_COST,
  GUILD_MAX_MEMBERS,
} from "../world/guilds.js";
import { tickDots } from "../world/dots.js";
import { bailPrice, isCriminal, setCriminal } from "../world/criminal.js";
import { broadcastToMap, CASPER_BODY, CASPER_HEAD, DEAD_FOREVER, killPlayer, revivePlayer, stopMeditating } from "./broadcast.js";
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
    // Muerto = fantasma (casper): el cuerpo vivo NO se filtra al re-entrar.
    bodyId: s.deadUntil !== 0 ? CASPER_BODY : s.visibleBodyId,
    // Navegando = sin cabeza (solo el barco). Antes esta línea del MAP_DATA usaba
    // s.headId crudo, así que al CAMBIAR DE MAPA el cliente reconstruía la entidad
    // con la cabeza real y reaparecía flotando sobre el barco.
    headId: computeVisibleHead(s),
    graphic: 0,
    criminal: isCriminal(s),
    faction: s.faction,
    guild: s.guildName ?? undefined,
    role: s.role,
    level: s.level,
    classId: s.classId,
    dead: s.deadUntil !== 0 || undefined,
    invisible: s.invisibleUntil > Date.now() || undefined,
    meditating: s.meditating || undefined,
    ...computeVisibleEquip(s),
  }));
  // Solo NPCs vivos: los muertos aparecían "parados" (inatacables) hasta su respawn.
  const npcEntities = npcs.inMap(map.id).filter((n) => n.deadUntil === 0).map((n) => ({
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
    bodyId: n.type.bodyId,
    headId: n.type.headId,
    graphic: 0,
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
    music: map.music,
    width: map.width,
    height: map.height,
    graphic: map.graphic,
    layer2: map.layer2,
    layer3: map.layer3,
    layer4: map.layer4,
    trigger: map.trigger,
    blocked: map.blocked,
    entities: [...playerEntities, ...npcEntities],
    groundItems: groundItemEntities,
  };
}

// Tile libre cerca de `origin` para tirar un item: caminable y sin otro item
// en el piso. Espiral hacia afuera, como TirarItemAlPiso del AO original —
// así un NPC que dropea varios items los desparrama en vez de apilarlos.
// Tile LIBRE (caminable y SIN item) más cercano al origen, buscando en espiral
// hasta radio 4. Devuelve null si no hay ninguno (no se puede tirar → nunca se
// apilan 2 items en el mismo tile).
function findDropTile(mapId: number, origin: Vector2): Vector2 | null {
  const map = getMap(mapId);
  if (!map) return null;
  for (let r = 0; r <= 4; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (!isWalkable(map, x, y)) continue;
        if (groundItems.atTile(mapId, { x, y })) continue;
        return { x, y };
      }
    }
  }
  return null;
}

// Tira un item al piso en el tile LIBRE más cercano a `origin` (jamás apila 2
// items en el mismo tile). Devuelve false si no hay lugar (no se tira nada).
// Broadcastea el spawn y, si el mapa estaba lleno, el despawn del item evicted.
function dropOnGround(mapId: number, origin: Vector2, item: number, qty: number): boolean {
  const pos = findDropTile(mapId, origin);
  if (!pos) return false;
  const g = groundItems.spawn(mapId, pos, item, qty);
  if (g.evictedId !== undefined) {
    broadcastToMap(mapId, { op: ServerToClientOp.GroundItemDespawn, id: g.evictedId as EntityId } satisfies GroundItemDespawn);
  }
  broadcastToMap(mapId, {
    op: ServerToClientOp.GroundItemSpawn,
    id: g.id as EntityId,
    position: { x: g.position.x, y: g.position.y },
    item: g.item,
    qty: g.qty,
  } satisfies GroundItemSpawn);
  return true;
}

function chebyshev(a: Vector2, b: Vector2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// Duraciones de estados (el server original las maneja con contadores de
// ticks de 500ms; estos son los valores efectivos típicos).
const PARALYSIS_MS = 8_000;
const IMMOBILIZE_MS = 30_000;
const INVISIBILITY_MS = 60_000;
const BLINDNESS_MS = 6_000;
const DUMB_MS = 8_000;

function broadcastEffect(
  mapId: number,
  id: number,
  effect: EntityEffect["effect"],
  active: boolean,
  durationMs?: number,
): void {
  const pkt: EntityEffect = {
    op: ServerToClientOp.EntityEffect,
    id: id as EntityId,
    effect,
    active,
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
  broadcastToMap(mapId, pkt);
}

// Atacar o castear rompe la invisibilidad propia (AO).
// Sigilo de CLASE: el Asesino con armadura de Asesino y el Cazador con la
// Armadura de Cazador (item 360) mantienen el OCULTARSE al actuar (caminar,
// atacar, tomar pociones) — no así la invisibilidad por hechizo.
function hasClassStealth(s: Session): boolean {
  const armor = s.equippedArmor !== null ? getItem(s.equippedArmor) : undefined;
  return (
    (s.classId === 5 && (armor?.name.includes("Asesino") ?? false)) ||
    (s.classId === 4 && s.equippedArmor === 360)
  );
}

function breakInvisibility(s: Session): void {
  // Si está OCULTO (skill Ocultarse) y tiene sigilo de clase, no se rompe:
  // sigue oculto igual que al caminar. (No aplica a la invisibilidad de hechizo,
  // que no setea s.hiding.)
  if (s.hiding && hasClassStealth(s)) return;
  s.hiding = false;
  if (s.invisibleUntil > Date.now()) {
    s.invisibleUntil = 0;
    broadcastEffect(s.mapId, s.characterId, "invisible", false);
  }
}

// Atributos ADICIONALES por items equipados (house rule editable en el panel
// admin): cualquier pieza equipada (arma/armadura/casco/escudo) puede sumar HP
// máximo y/o ataque extra, además de su stat base. Se suman entre todas.
function equipSlotIds(s: Session): Array<number | null> {
  return [s.equippedWeapon, s.equippedArmor, s.equippedHelmet, s.equippedShield];
}
function equipBonusHp(s: Session): number {
  let b = 0;
  for (const id of equipSlotIds(s)) if (id !== null) b += getItem(id)?.bonusHp ?? 0;
  return b;
}
// Ataque extra del equipo: `bonusHit` (ambos) + el específico del contexto.
function equipBonusHitVsPlayer(s: Session): number {
  let b = 0;
  for (const id of equipSlotIds(s)) {
    if (id === null) continue;
    const it = getItem(id);
    b += (it?.bonusHit ?? 0) + (it?.bonusHitPvp ?? 0);
  }
  return b;
}
function equipBonusHitVsNpc(s: Session): number {
  let b = 0;
  for (const id of equipSlotIds(s)) {
    if (id === null) continue;
    const it = getItem(id);
    b += (it?.bonusHit ?? 0) + (it?.bonusHitNpc ?? 0);
  }
  return b;
}
// HP máximo = base por clase/nivel/constitución + bonus de equipo. Clampa el HP
// actual. Reemplaza los `s.maxHp = calcMaxHp(...)` sueltos para incluir el bonus.
function recomputeMaxHp(s: Session): void {
  const cd = getClass(s.classId);
  const base = cd ? calcMaxHp(cd, s.level, s.con) : maxHpForLevel(s.level);
  s.maxHp = base + equipBonusHp(s);
  if (s.hp > s.maxHp) s.hp = s.maxHp;
}

// Body visible del jugador: navegando = el barco; si no, el ropaje
// (NumRopaje de obj.dat) de la armadura equipada, o el body base.
function computeVisibleBody(s: Session): number {
  if (s.navigating && s.boatBody > 0) return s.boatBody;
  if (s.mounted && s.mountBody > 0) return s.mountBody;
  if (s.equippedArmor !== null) {
    const def = getItem(s.equippedArmor);
    if (def && def.type === "armor" && def.bodyId !== undefined && def.bodyId > 0) {
      return def.bodyId;
    }
  }
  return s.bodyId;
}

// Cabeza visible del jugador: NAVEGANDO no se ve (solo el barco/galera/galeón);
// muerto = cabeza fantasma (Casper); si no, su cabeza real. Navegar tiene
// prioridad sobre muerto (barcos no caen al morir → igual se ve solo el barco).
function computeVisibleHead(s: Session): number {
  if (s.navigating) return 0;
  if (s.deadUntil !== 0) return CASPER_HEAD;
  return s.headId;
}

const CLOSE_NORMAL = 1000;
const CLOSE_AUTH_FAILED = 4001;
const CLOSE_UNKNOWN_OPCODE = 4002;
const CLOSE_INVALID_PACKET = 4003;
const CLOSE_PROTOCOL_VERSION = 4005;
const HANDSHAKE_TIMEOUT_MS = 5_000;
// Viaje al hogar tras morir (cuenta regresiva en vivo en el cliente).
const HOME_TRAVEL_MS = 3_000;

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
  navigating = false,
): { map: MapState; position: Vector2 } {
  const persistedMap = getMap(persistedMapId);
  if (persistedMap) {
    // A pie: tile caminable. Navegando: también vale un tile de agua (antes
    // desconectarse en barco "invalidaba" la posición y te mandaba a Ulla).
    const ok = navigating
      ? isWalkable(persistedMap, persistedPos.x, persistedPos.y) ||
        isWaterAt(persistedMap, persistedPos.x, persistedPos.y)
      : isWalkable(persistedMap, persistedPos.x, persistedPos.y);
    if (ok) return { map: persistedMap, position: persistedPos };
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
      hunger: s.hunger,
      thirst: s.thirst,
      skills: s.skills,
      skillsXp: s.skillsXp,
      knownSpells: s.knownSpells,
      quests: s.quests,
      questsDone: s.questsDone,
      faction: s.faction,
      citizensKilled: s.citizensKilled,
      criminalsKilled: s.criminalsKilled,
      gold: s.gold,
      inventory: s.inventory,
      equippedWeapon: s.equippedWeapon,
      equippedArmor: s.equippedArmor,
      equippedHelmet: s.equippedHelmet,
      equippedShield: s.equippedShield,
      bankInventory: s.bankInventory,
      bankGold: s.bankGold,
      dead: s.deadUntil !== 0,
      navigating: s.navigating,
      boatBody: s.boatBody,
      pardonedKills: s.pardonedKills,
      bailsPaid: s.bailsPaid,
      factionRewards: s.factionRewards,
      factionPoints: s.factionPoints,
      factionRank: s.factionRank,
      equippedArrow: s.equippedArrow,
      updatedAt: new Date(),
    })
    .where(eq(characters.id, s.characterId));
}

// Guarda TODAS las sesiones conectadas de una. Lo llama el apagado graceful
// (SIGTERM en cada deploy) ANTES de cerrar la DB, para que nadie pierda progreso
// al reiniciar el server (antes se perdía hasta lo del último autosave de 60s).
export async function flushAllSessions(): Promise<void> {
  await Promise.all([...sessions.all()].map((s) => persistPosition(s).catch(() => undefined)));
}

// Autosave periódico de TODAS las sesiones. Sin esto el único guardado era al
// cerrar el socket: un crash del server revertía todo el progreso (oro,
// compras, trades) de los jugadores conectados desde su login.
const AUTOSAVE_INTERVAL_MS = 30_000;
setInterval(() => {
  for (const s of sessions.all()) {
    void persistPosition(s).catch(() => undefined);
  }
}, AUTOSAVE_INTERVAL_MS);

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
    race: s.race,
    gender: s.gender,
    gold: s.gold,
    hunger: s.hunger,
    thirst: s.thirst,
    sta: s.sta,
    maxSta: s.maxSta,
    strBonus: s.strBonus,
    agiBonus: s.agiBonus,
    buffExpiresAt: s.buffUntil,
    skills: s.skills,
  };
  send(s.socket, pkt);
}

// Intervalos de jugabilidad (editables en el panel) → cliente, para que sincronice
// sus cooldowns locales (golpe/flechas) con el server. Se manda al entrar y en cada
// cambio del admin.
function sendGameConfig(s: Session): void {
  const pkt: GameConfigMsg = { op: ServerToClientOp.GameConfig, intervals: currentIntervals() };
  send(s.socket, pkt);
}
// Al cambiar los intervalos desde el panel, re-broadcastear a todos los conectados.
onIntervalsChanged(() => {
  const pkt: GameConfigMsg = { op: ServerToClientOp.GameConfig, intervals: currentIntervals() };
  for (const s of sessions.all()) send(s.socket, pkt);
});

// Tope de oro: la columna `gold` es integer de Postgres (máx 2.147e9); topamos
// en 2e9 para que ninguna suma (venta, quest, trade, /oro) desborde y corrompa
// el guardado del personaje.
const MAX_GOLD = 2_000_000_000;

// Newbie: AO Libre (GameLogic.bas EsNewbie = ELV <= LimiteNewbie). Nivel <= 12 es
// newbie; al 13 deja de serlo (se le quitan los items newbie y sale del dungeon).
const NEWBIE_MAX_LEVEL = 12;
const NEWBIE_DUNGEON_MAP = 167; // Dungeon Newbie (destino del teleport de Ulla)

function addGold(s: Session, amount: number): void {
  s.gold = Math.max(0, Math.min(MAX_GOLD, s.gold + amount));
}

// Mensaje de consola a una sesión (versión module-level de consoleMsg, para
// usar desde funciones fuera del handler de conexión).
function consoleTo(s: Session, text: string): void {
  send(s.socket, { op: ServerToClientOp.ConsoleMsg, text, kind: "global" } satisfies ConsoleMsg);
}

// Auto-expulsión por facción: si el estado (ciudadano/criminal) de un miembro
// deja de coincidir con la facción de su clan, se lo saca automáticamente.
// Se llama cuando el estado puede cambiar (matar un ciudadano / pagar fianza).
async function enforceGuildFaction(s: Session): Promise<void> {
  if (!s.guildId) return;
  const g = await getGuild(s.guildId);
  if (!g) return;
  if (sessionFaction(s) === g.faction) return;
  const oldId = s.guildId;
  const oldName = s.guildName ?? g.name;
  const result = await leaveGuild(s);
  await setGuildRank(s.characterId, 0);
  s.guildId = null;
  s.guildName = null;
  s.guildRank = 0;
  consoleTo(
    s,
    `Tu alineación cambió y ya no coincidís con el clan ${oldName} (${factionName(g.faction)}): fuiste expulsado.`,
  );
  broadcastToMap(s.mapId, {
    op: ServerToClientOp.GuildTagUpdate,
    id: s.characterId as EntityId,
    guild: null,
  } satisfies GuildTagUpdate);
  if (result.disbanded) { await clearRequestsForGuild(oldId); return; }
  for (const member of sessions.all()) {
    if (member.guildId !== oldId) continue;
    consoleTo(member, `${s.characterName} fue expulsado del clan (cambió de alineación).`);
    if (result.newLeaderId === member.characterId) {
      consoleTo(member, `Ahora eres el líder del clan ${oldName}.`);
    }
  }
}

// Resolución única de la muerte de un jugador (melee, hechizo directo o veneno
// DoT): cancela el trade del muerto, aplica la penalización de XP (10% del
// progreso del nivel, como el AO), y si hay un matador jugador, actualiza los
// contadores de facción y lo marca criminal si la víctima era ciudadana.
// `killer` es null si murió por fuente no atribuible a un jugador (criatura,
// o el envenenador ya se desconectó).
// ConsoleMsg a nivel módulo (la versión del closure no está disponible acá).
function notify(s: Session, text: string, wav?: number): void {
  const pkt: ConsoleMsg = {
    op: ServerToClientOp.ConsoleMsg,
    text,
    kind: "global",
    ...(wav !== undefined ? { wav } : {}),
  };
  send(s.socket, pkt);
}

// Busca una sesión ONLINE por nombre de personaje (case-insensitive). Lo usan
// muchos comandos GM (/echar, /donde, /curar, etc.).
function findOnlineByName(name: string): Session | undefined {
  const lower = name.trim().toLowerCase();
  for (const t of sessions.all()) {
    if (t.characterName.toLowerCase() === lower) return t;
  }
  return undefined;
}

// ── Salir del juego (/salir): instantáneo en zona segura, 10s en insegura ──────
const QUIT_DELAY_MS = 10_000;
function sendExitOk(s: Session): void {
  s.quitAt = 0;
  const pkt: ExitOkMsg = { op: ServerToClientOp.ExitOk };
  send(s.socket, pkt);
}
function handleQuit(s: Session): void {
  const map = getMap(s.mapId);
  // Zona segura (ciudad), muerto (fantasma) o mapa desconocido → sale ya.
  if (!map || map.safeZone || s.deadUntil !== 0) { sendExitOk(s); return; }
  if (s.quitAt !== 0) return; // ya está en cuenta regresiva
  s.quitAt = Date.now() + QUIT_DELAY_MS;
  notify(s, `Saldrás del juego en ${(QUIT_DELAY_MS / 1000).toString()} segundos. No te muevas ni entres en combate o se cancelará.`);
}
// Cancela la cuenta regresiva de salida (al moverse, atacar o recibir daño).
function cancelExitCountdown(s: Session): void {
  if (s.quitAt === 0) return;
  s.quitAt = 0;
  notify(s, "Salida cancelada.");
}
// Completa las salidas cuya cuenta regresiva ya venció.
setInterval(() => {
  const now = Date.now();
  for (const s of sessions.all()) {
    if (s.quitAt !== 0 && now >= s.quitAt) sendExitOk(s);
  }
}, 500);
// Recibir daño de un NPC cancela la salida (anti combat-log en PvE).
setPlayerDamagedHandler(cancelExitCountdown);

// Muerte AO original: se CAEN TODOS los items al piso — salvo los newbie, las
// armaduras faccionarias (recompensa que no se pierde) y los BARCOS (objType 31:
// barca/galera/galeón — no se caen al morir).
function dropAllItemsOnDeath(victim: Session): void {
  const kept: InventorySlot[] = [];
  let dropped = 0;
  for (const slot of victim.inventory) {
    const def = getItem(slot.item);
    if (!def || def.newbie || def.objType === 31 || FACTION_ARMOR_IDS.has(slot.item)) {
      kept.push(slot);
      continue;
    }
    if (dropOnGround(victim.mapId, victim.position, slot.item, slot.qty)) {
      dropped += 1;
    } else {
      // Sin tile libre alrededor: el item se queda con el muerto (no se pierde).
      kept.push(slot);
    }
  }
  victim.inventory = kept;
  // Limpiar el equipo que se cayó.
  const still = (it: number | null): boolean => it !== null && kept.some((sl) => sl.item === it);
  if (!still(victim.equippedWeapon)) victim.equippedWeapon = null;
  if (!still(victim.equippedArmor)) victim.equippedArmor = null;
  if (!still(victim.equippedHelmet)) victim.equippedHelmet = null;
  if (!still(victim.equippedShield)) victim.equippedShield = null;
  if (dropped > 0) notify(victim, "¡Has perdido tus pertenencias al morir!");
}

// Pierde la facción (Armada al atacar ciudadanos): baja el flag y el rango.
function loseFaction(s: Session, reason: string): void {
  if (s.faction === FACTION_NONE) return;
  s.faction = FACTION_NONE;
  s.factionRank = 0;
  consoleTo(s, reason);
  broadcastToMap(s.mapId, {
    op: ServerToClientOp.FactionUpdate,
    id: s.characterId as EntityId,
    faction: FACTION_NONE,
  } satisfies FactionUpdate);
  sendStatsUpdate(s);
}

// Puntos de facción por matar a otro jugador: +10 si la kill es VÁLIDA
// (víctima no newbie + regla de nivel) y otorga puntos según la alineación del
// matador, respetando el anti-farmeo (no re-kill del mismo par en 5 minutos).
function awardFactionPoints(killer: Session, victim: Session): void {
  const victimNewbie = victim.level <= NEWBIE_MAX_LEVEL;
  if (!killLevelValid(killer.level, victim.level, victimNewbie)) return;
  if (!killGivesFactionPoints(killer, victim)) return;
  const now = Date.now();
  const last = killer.factionKillCooldowns.get(victim.characterId) ?? 0;
  if (now - last < REKILL_COOLDOWN_MS) return; // re-kill reciente: no cuenta
  killer.factionKillCooldowns.set(victim.characterId, now);
  killer.factionPoints += POINTS_PER_KILL;
  consoleTo(killer, `+${POINTS_PER_KILL.toString()} puntos de facción (total: ${killer.factionPoints.toString()}).`);
}

function resolvePlayerDeath(victim: Session, killer: Session | null): void {
  // Idempotente: con varios DoTs en el mismo tick, el segundo resultado
  // "dead" duplicaba la penalización y el contador criminal.
  if (victim.deadUntil !== 0) return;
  // Cancelar el trade del muerto (usa el registro de módulo, no el closure).
  if (victim.tradeId) {
    const trade = tradeRegistry.remove(victim.tradeId);
    if (trade) {
      const pkt: TradeCancelled = { op: ServerToClientOp.TradeCancelled, reason: "DEATH" };
      const sA = sessions.getByCharacterId(trade.playerA);
      const sB = sessions.getByCharacterId(trade.playerB);
      if (sA) { sA.tradeId = null; send(sA.socket, pkt); }
      if (sB) { sB.tradeId = null; send(sB.socket, pkt); }
    }
  }

  const victimWasCriminal = isCriminal(victim);
  killPlayer(victim);
  // AO original: al morir se caen TODOS los items (salvo newbie/facción).
  // Sin penalización de XP (la del AO es perder las cosas).
  dropAllItemsOnDeath(victim);
  sendInventoryUpdate(victim);
  sendStatsUpdate(victim);

  // Facción/criminal: solo si el matador es otro jugador (sigue conectado).
  if (killer && killer.characterId !== victim.characterId) {
    if (victimWasCriminal) {
      killer.criminalsKilled += 1;
    } else {
      killer.citizensKilled += 1;
      setCriminal(killer);
      const criminalPkt: CriminalUpdate = {
        op: ServerToClientOp.CriminalUpdate,
        id: killer.characterId as EntityId,
        criminal: true,
        expiresAt: 0, // persistente: se paga fianza al sacerdote
      };
      broadcastToMap(killer.mapId, criminalPkt);
      // Volverse criminal puede sacarlo de un clan de ciudadanos.
      void enforceGuildFaction(killer);
    }
    // Puntos de facción por la kill (sistema de puntos + /recompensa).
    awardFactionPoints(killer, victim);
    sendStatsUpdate(killer);
  }
}

// Hechizos conocidos según clase y nivel (libro del AO).
function sendSpellsKnown(s: Session): void {
  const pkt: SpellsKnown = {
    op: ServerToClientOp.SpellsKnown,
    // Sistema de pergaminos: el libro son los hechizos aprendidos (persistidos),
    // ya no se derivan del nivel.
    spellIds: s.knownSpells,
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
  // La flecha equipada se descarta si te quedaste sin ese tipo.
  if (s.equippedArrow !== null && countItem(s.inventory, s.equippedArrow) === 0) {
    s.equippedArrow = null;
  }
  s.weaponBonus = weaponBonusFor(s.equippedWeapon);
  s.armorDefense = armorDefenseFor(s.equippedArmor);
  s.helmetDefense = helmetDefenseFor(s.equippedHelmet);
  s.shieldDefense = shieldDefenseFor(s.equippedShield);
}

// Overlays de equipo (Armas/Escudos/Cascos del cliente AO): índice de anim
// del item equipado. Sin overlays si está muerto, navegando o montado.
function computeVisibleEquip(s: Session): { weaponAnim: number; shieldAnim: number; helmetAnim: number } {
  if (s.deadUntil !== 0 || s.navigating || s.mounted) {
    return { weaponAnim: 0, shieldAnim: 0, helmetAnim: 0 };
  }
  const animOf = (itemId: number | null): number => {
    if (itemId === null) return 0;
    return getItem(itemId)?.anim ?? 0;
  };
  return {
    weaponAnim: animOf(s.equippedWeapon),
    shieldAnim: animOf(s.equippedShield),
    helmetAnim: animOf(s.equippedHelmet),
  };
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
    equippedArrow: s.equippedArrow,
  };
  send(s.socket, pkt);

  // Ropaje/equipo: si el body visible o los overlays cambiaron, avisar a
  // todo el mapa para que redibujen el sprite.
  const visible = computeVisibleBody(s);
  const equip = computeVisibleEquip(s);
  if (
    visible !== s.visibleBodyId ||
    equip.weaponAnim !== s.visibleWeaponAnim ||
    equip.shieldAnim !== s.visibleShieldAnim ||
    equip.helmetAnim !== s.visibleHelmetAnim
  ) {
    s.visibleBodyId = visible;
    s.visibleWeaponAnim = equip.weaponAnim;
    s.visibleShieldAnim = equip.shieldAnim;
    s.visibleHelmetAnim = equip.helmetAnim;
    const appearance: EntityAppearance = {
      op: ServerToClientOp.EntityAppearance,
      id: s.characterId as EntityId,
      bodyId: visible,
      headId: computeVisibleHead(s),
      ...equip,
    };
    broadcastToMap(s.mapId, appearance);
  }
}

// Iniciar el loop de regen al momento de cargar el módulo.
// Usar sendStatsUpdate como callback — funciona porque es función declarada más arriba.
setInterval(() => tickRegen(sendStatsUpdate), REGEN_INTERVAL_MS);

// Expiración de estados alterados (parálisis/inmovilización/invisibilidad/
// ceguera/estupidez) de jugadores y NPCs, + llegadas del viaje al hogar.
setInterval(() => {
  const now = Date.now();
  for (const s of sessions.all()) {
    if (s.paralyzedUntil > 0 && now >= s.paralyzedUntil) {
      s.paralyzedUntil = 0;
      broadcastEffect(s.mapId, s.characterId, "paralyzed", false);
    }
    if (s.immobilizedUntil > 0 && now >= s.immobilizedUntil) {
      s.immobilizedUntil = 0;
      broadcastEffect(s.mapId, s.characterId, "immobilized", false);
    }
    if (s.invisibleUntil > 0 && now >= s.invisibleUntil) {
      s.invisibleUntil = 0;
      broadcastEffect(s.mapId, s.characterId, "invisible", false);
    }
    if (s.blindUntil > 0 && now >= s.blindUntil) {
      s.blindUntil = 0;
      const pkt: EntityEffect = {
        op: ServerToClientOp.EntityEffect,
        id: s.characterId as EntityId,
        effect: "blind",
        active: false,
      };
      send(s.socket, pkt);
    }
    if (s.dumbUntil > 0 && now >= s.dumbUntil) {
      s.dumbUntil = 0;
      const pkt: EntityEffect = {
        op: ServerToClientOp.EntityEffect,
        id: s.characterId as EntityId,
        effect: "dumb",
        active: false,
      };
      send(s.socket, pkt);
    }
  }
  for (const n of npcs.all()) {
    if (n.paralyzedUntil > 0 && now >= n.paralyzedUntil) {
      n.paralyzedUntil = 0;
      broadcastEffect(n.mapId, n.id, "paralyzed", false);
    }
  }
  for (const s of sessions.all()) {
    if (s.homeTravelUntil === 0 || now < s.homeTravelUntil) continue;
    s.homeTravelUntil = 0;
    const home = getMap(1);
    if (!home) continue;

    const fromMapId = s.mapId;
    const despawn: EntityDespawn = {
      op: ServerToClientOp.EntityDespawn,
      id: s.characterId as EntityId,
    };
    broadcastToMap(fromMapId, despawn, s.id);

    s.mapId = home.id;
    s.position = { x: home.spawn.x, y: home.spawn.y };
    s.direction = "south";

    send(s.socket, buildMapDataPacket(home));
    const spawnPkt: EntitySpawn = {
      op: ServerToClientOp.EntitySpawn,
      id: s.characterId as EntityId,
      position: { x: s.position.x, y: s.position.y },
      direction: s.direction,
      name: s.characterName,
      hp: s.hp,
      maxHp: s.maxHp,
      kind: "player",
      bodyId: s.deadUntil !== 0 ? CASPER_BODY : s.visibleBodyId,
      headId: computeVisibleHead(s),
      graphic: 0,
      criminal: isCriminal(s),
      faction: s.faction,
      guild: s.guildName ?? undefined,
      role: s.role,
      level: s.level,
      classId: s.classId,
      dead: s.deadUntil !== 0 || undefined,
      invisible: s.invisibleUntil > Date.now() || undefined,
    meditating: s.meditating || undefined,
      ...computeVisibleEquip(s),
    };
    broadcastToMap(home.id, spawnPkt, s.id);

    revivePlayer(s);
    sendInventoryUpdate(s); // re-broadcastea los overlays de equipo
    sendStatsUpdate(s);
  }
}, 1_000);

setInterval(() => {
  const dotResults = tickDots();
  for (const r of dotResults) {
    const target = sessions.getByCharacterId(r.targetId);
    if (!target) continue;
    const dmgPkt: Damage = {
      op: ServerToClientOp.Damage,
      attackerId: r.casterId as EntityId,
      targetId: r.targetId as EntityId,
      amount: r.damage,
      hp: r.newHp,
      maxHp: target.maxHp,
      // Veneno/DoT: sin animación de golpe del "atacante" en el cliente.
      magic: true,
    };
    broadcastToMap(target.mapId, dmgPkt);
    if (r.dead) {
      // Muerte por veneno: misma resolución que el combate directo (crédito
      // criminal, penalización de XP, cancelar trade). El envenenador es un
      // jugador (casterId); si se desconectó, killer queda null.
      resolvePlayerDeath(target, sessions.getByCharacterId(r.casterId) ?? null);
    }
  }
}, 1000);

// eslint-disable-next-line @typescript-eslint/require-await
export const registerWsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/ws", { websocket: true }, (socket, req) => {
    let session: Session | null = null;
    // IP real del cliente (trustProxy lee el X-Forwarded-For de Caddy). Si está
    // baneada, se cierra la conexión de entrada.
    const clientIp = req.ip || "";
    if (isIpBanned(clientIp)) {
      socket.close(CLOSE_AUTH_FAILED, "IP_BANNED");
      return;
    }

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

        // Sesión reemplazada por un relogin del MISMO personaje: no despawnear
        // (borraría la entidad recién spawneada del relogueado, dejándolo
        // invisible y sin poder moverse), no sacarlo de la party, y no
        // persistir (pisaría con estado stale el estado de la sesión nueva).
        if (closingSession.superseded) {
          session = null;
          return;
        }

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

    // Heartbeat ping/pong: sin esto, un corte sin FIN (móvil, suspensión)
    // dejaba una sesión zombie parada en el mundo hasta el timeout de TCP.
    let socketAlive = true;
    socket.on("pong", () => { socketAlive = true; });
    const heartbeat = setInterval(() => {
      if (!socketAlive) {
        clearInterval(heartbeat);
        socket.terminate(); // dispara el close handler → persiste y despawnea
        return;
      }
      socketAlive = false;
      try { socket.ping(); } catch { /* cerrándose */ }
    }, 30_000);
    socket.on("close", () => { clearInterval(heartbeat); });

    async function handleMessage(raw: Buffer): Promise<void> {
      let packet: AnyPacket;
      try {
        packet = decode<AnyPacket>(raw);
      } catch {
        socket.close(CLOSE_INVALID_PACKET, "DECODE_FAILED");
        return;
      }

      // Cualquier excepción de un handler (p.ej. un cliente no oficial que manda
      // un campo con tipo inesperado) se captura acá: se loguea y se ignora el
      // paquete, sin tumbar el proceso ni afectar a otras sesiones.
      try {
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
        case ClientToServerOp.NpcInfo:
          handleNpcInfo(session, packet);
          break;
        case ClientToServerOp.PlayerInfo:
          handlePlayerInfo(session, packet);
          break;
        case ClientToServerOp.Quit:
          handleQuit(session);
          break;
        case ClientToServerOp.SaveMacros: {
          // Persistencia opaca de la barra de macros (por personaje en la DB).
          // Rate-limit (2s) + tope de tamaño: sin esto, spamear SaveMacros
          // martillaba la DB con jsonb arbitrario.
          const mnow = Date.now();
          if (mnow - session.lastMacroSaveAt < 2_000) break;
          const macros = Array.isArray(packet.macros) ? packet.macros.slice(0, 32) : [];
          if (JSON.stringify(macros).length > 16_384) break;
          session.lastMacroSaveAt = mnow;
          void db.update(characters).set({ macros }).where(eq(characters.id, session.characterId));
          break;
        }
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
        case ClientToServerOp.UseSkill:
          handleUseSkill(session, packet);
          break;
        case ClientToServerOp.Meditate:
          handleMeditate(session);
          break;
        case ClientToServerOp.CastSpell:
          handleCastSpell(session, packet);
          break;
        case ClientToServerOp.GoHome:
          handleGoHome(session);
          break;
        case ClientToServerOp.CancelGoHome:
          handleCancelGoHome(session);
          break;
        case ClientToServerOp.ShootGround:
          handleShootGround(session, packet);
          break;
        case ClientToServerOp.Work:
          handleWork(session, packet);
          break;
        case ClientToServerOp.Craft:
          handleCraft(session, packet);
          break;
        case ClientToServerOp.Rest:
          handleRest(session);
          break;
        case ClientToServerOp.SafeToggle:
          handleSafeToggle(session);
          break;
        case ClientToServerOp.QuestAccept:
          handleQuestAccept(session, packet);
          break;
        case ClientToServerOp.QuestAbandon:
          handleQuestAbandon(session, packet);
          break;
        case ClientToServerOp.WhisperSend:
          handleWhisper(session, packet);
          break;
        // Clanes
        case ClientToServerOp.GuildCreate:
          void handleGuildCreate(session, packet).catch((err) =>
            req.log.error({ err }, "[guild] error al fundar"),
          );
          break;
        case ClientToServerOp.GuildInvite:
          void handleGuildInvite(session, packet).catch((err) =>
            req.log.error({ err }, "[guild] error al invitar"),
          );
          break;
        case ClientToServerOp.GuildAccept:
          void handleGuildAccept(session).catch((err) =>
            req.log.error({ err }, "[guild] error al aceptar"),
          );
          break;
        case ClientToServerOp.GuildLeave:
          void handleGuildLeave(session).catch((err) =>
            req.log.error({ err }, "[guild] error al salir"),
          );
          break;
        case ClientToServerOp.GuildMessage:
          handleGuildMessage(session, packet);
          break;
        case ClientToServerOp.GuildOnline:
          handleGuildOnline(session);
          break;
        case ClientToServerOp.GuildInfo:
          void handleGuildInfo(session).catch((err) =>
            req.log.error({ err }, "[guild] error al pedir info"),
          );
          break;
        case ClientToServerOp.GuildEdit:
          void handleGuildEdit(session, packet).catch((err) =>
            req.log.error({ err }, "[guild] error al editar"),
          );
          break;
        case ClientToServerOp.GuildList:
          void handleGuildList(session).catch((err) =>
            req.log.error({ err }, "[guild] error al listar"),
          );
          break;
        case ClientToServerOp.GuildJoinRequest:
          void handleGuildJoinRequest(session, packet).catch((err) =>
            req.log.error({ err }, "[guild] error al solicitar"),
          );
          break;
        case ClientToServerOp.GuildRequestAccept:
          void handleGuildRequestAccept(session, packet).catch((err) =>
            req.log.error({ err }, "[guild] error al aceptar solicitud"),
          );
          break;
        case ClientToServerOp.GuildRequestReject:
          void handleGuildRequestReject(session, packet).catch((err) =>
            req.log.error({ err }, "[guild] error al rechazar solicitud"),
          );
          break;
        case ClientToServerOp.GuildSetRank:
          void handleGuildSetRank(session, packet).catch((err) =>
            req.log.error({ err }, "[guild] error al setear rango"),
          );
          break;
        // Amigos
        case ClientToServerOp.FriendAdd:
          handleFriendAdd(session, packet.name);
          break;
        case ClientToServerOp.FriendRemove:
          handleFriendRemove(session, packet.name);
          break;
        case ClientToServerOp.FriendList:
          handleFriendList(session);
          break;
        case ClientToServerOp.Hide:
          handleHide(session);
          break;
        case ClientToServerOp.Tame:
          handleTame(session);
          break;
        default:
          req.log.warn({ op: (packet as { op: number }).op }, "[ws] opcode desconocido");
          socket.close(CLOSE_UNKNOWN_OPCODE, "UNKNOWN_OPCODE");
      }
      } catch (err) {
        req.log.error({ err, op: (packet as { op: number }).op }, "[ws] excepción en handler");
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
      // A pie, el destino debe ser tierra transitable (hay portales nativos
      // que apuntan a agua o a celdas selladas → jugador varado). Navegando
      // se respeta la coord original (los viajes en barco terminan en agua).
      s.position = s.navigating
        ? { x: portal.toX, y: portal.toY }
        : findLandingTile(destMap, { x: portal.toX, y: portal.toY });
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
        // El muerto sigue muerto al cruzar de mapa (fantasma, no se "resucita").
        bodyId: s.deadUntil !== 0 ? CASPER_BODY : s.visibleBodyId,
        headId: computeVisibleHead(s),
        graphic: 0,
        criminal: isCriminal(s),
        faction: s.faction,
        guild: s.guildName ?? undefined,
        role: s.role,
        level: s.level,
        classId: s.classId,
        dead: s.deadUntil !== 0 || undefined,
        invisible: s.invisibleUntil > Date.now() || undefined,
    meditating: s.meditating || undefined,
        ...computeVisibleEquip(s),
      };
      broadcastToMap(destMap.id, spawn, s.id);

      req.log.info(
        { sessionId: s.id, characterId: s.characterId, fromMap: fromMapId, toMap: destMap.id },
        "[ws] transición de mapa",
      );
      mapTransitionsTotal.inc();
    }

    // Sacerdote cerca (HaySacerdote/AccionParaSacerdote del AO): al caminar
    // muerto a distancia < 5 de un NPC Revividor, te resucita.
    function checkPriestRevive(s: Session): void {
      if (s.deadUntil === 0) return;
      for (const n of npcs.inMap(s.mapId)) {
        if (!n.type.isPriest || n.deadUntil !== 0) continue;
        if (chebyshev(s.position, n.position) < 5) {
          revivePlayer(s);
          sendInventoryUpdate(s); // re-broadcastea los overlays de equipo
          sendStatsUpdate(s);
          consoleMsg(s, "¡Has sido resucitado!", "global", 213); // SND_RESUCITAR
          return;
        }
      }
    }

    function handleMove(s: Session, move: MoveRequest): void {
      // Cualquier intento de movimiento corta la meditación (AO original),
      // incluso si el paso termina bloqueado o en cooldown.
      // Los muertos SÍ caminan (fantasma/casper del AO).
      stopMeditating(s);
      cancelExitCountdown(s); // moverse cancela la salida (anti combat-log)

      // Paralizado o inmovilizado: no se mueve — corrección al cliente.
      const nowMs = Date.now();
      if (s.paralyzedUntil > nowMs || s.immobilizedUntil > nowMs) {
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
        navigating: s.navigating,
        isOccupied: (pos) => {
          // Los fantasmas no bloquean el paso (los vivos los atraviesan) y
          // un fantasma atraviesa a todos.
          if (s.deadUntil !== 0) return false;
          for (const other of sessions.inMap(s.mapId)) {
            if (other.id === s.id) continue;
            if (other.deadUntil !== 0) continue;
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
      s.resting = false; // moverse corta el descanso
      sessions.touch(s.id);

      const update: EntityUpdate = {
        op: ServerToClientOp.EntityUpdate,
        id: s.characterId as EntityId,
        position: { x: s.position.x, y: s.position.y },
        direction: s.direction,
      };
      broadcastToMap(s.mapId, update);

      // Fantasma: revivir si hay un sacerdote cerca.
      // Caminar rompe el OCULTARSE (AO) — salvo el sigilo de clase (Asesino con
      // armadura de Asesino, o Cazador con Armadura de Cazador item 360). La
      // invisibilidad por hechizo no se rompe al caminar.
      if (s.hiding && !hasClassStealth(s)) {
        s.hiding = false;
        if (s.invisibleUntil > Date.now()) {
          s.invisibleUntil = 0;
          broadcastEffect(s.mapId, s.characterId, "invisible", false);
          consoleMsg(s, "¡Has vuelto a ser visible!", "combate");
        }
      }

      checkPriestRevive(s);

      const portal = map.portals.find(
        (p) => p.x === s.position.x && p.y === s.position.y,
      );
      if (portal) doMapTransition(s, portal);
    }

    // Disparar una flecha al PISO (click en tile vacío): gasta 1 flecha y la
    // deja en el suelo. Requiere arco equipado + munición + respetar el
    // intervalo de flechas.
    function handleShootGround(s: Session, pkt: ShootGroundRequest): void {
      if (s.deadUntil !== 0) return;
      const weapon = s.equippedWeapon !== null ? getItem(s.equippedWeapon) : undefined;
      if (!weapon?.ranged || !weapon.needsAmmo) return;
      const now = Date.now();
      if (now - s.lastAttackAt < INTERVALS.arrow) return;
      // La energía NO limita ni se consume al combatir (decisión de diseño).
      const arrowSlot = pickArrowSlot(s);
      if (!arrowSlot) { consoleMsg(s, "¡No tienes municiones!", "combate"); return; }
      const map = getMap(s.mapId);
      if (!map) return;
      const x = Math.max(0, Math.min(Math.floor(pkt.x) || 0, map.width - 1));
      const y = Math.max(0, Math.min(Math.floor(pkt.y) || 0, map.height - 1));
      if (chebyshev(s.position, { x, y }) > RANGED_RANGE) return;

      s.lastAttackAt = now;
      breakInvisibility(s);
      cancelExitCountdown(s); // disparar cancela la salida
      // Se gasta 1 flecha (se pierde — NO queda en el piso para recoger).
      const removed = removeItem(s.inventory, arrowSlot.item, 1);
      if (removed) s.inventory = removed;
      sendInventoryUpdate(s);
    }

    // Preparación común del ataque físico (SistemaCombate.bas):
    // intervalos (golpe 1500ms / flechas 1400ms / golpe-tras-magia 1000ms),
    // stamina (mínimo 10, consume 1-10), arma a distancia con munición.
    interface AttackPrep {
      ranged: boolean;
      weaponMin: number;
      weaponMax: number;
      ammoMin?: number;
      ammoMax?: number;
      ammoItem?: number;
      poder: number;
      modDano: number;
      // Skill que entrena este ataque (armas/proyectiles/wrestling).
      skillKey: "armas" | "proyectiles" | "wrestling";
    }

    // Slot de munición a usar: la flecha EQUIPADA si hay stock, si no la
    // primera flecha del inventario.
    function pickArrowSlot(s: Session): { item: number; qty: number } | undefined {
      if (s.equippedArrow !== null) {
        const eq = s.inventory.find((sl) => sl.item === s.equippedArrow && sl.qty > 0);
        if (eq) return eq;
      }
      return s.inventory.find((sl) => getItem(sl.item)?.type === "arrow" && sl.qty > 0);
    }

    function prepareAttack(s: Session, now: number): AttackPrep | null {
      if (s.deadUntil !== 0) return null;
      // Paralizado no pega (sí puede castear — para Remover Parálisis).
      if (s.paralyzedUntil > now) return null;
      // Golpear tras castear respeta IntervaloMagiaGolpe.
      if (now - s.lastCastAt < INTERVALS.magiaGolpe) return null;

      const weapon = s.equippedWeapon !== null ? getItem(s.equippedWeapon) : undefined;
      const ranged = weapon?.ranged === true;
      const interval = ranged ? INTERVALS.arrow : INTERVALS.melee;
      if (now - s.lastAttackAt < interval) return null;

      // La energía NO limita ni se consume al golpear (decisión de diseño: que no
      // moleste). Solo gatean los intervalos y (para el arco) la munición.

      const mods = getClassMods(s.classId);
      const prep: AttackPrep = {
        ranged,
        weaponMin: weapon?.minHit ?? 0,
        weaponMax: weapon?.maxHit ?? 0,
        poder: ranged ? playerPoderAtaqueProyectil(s) : playerPoderAtaqueArma(s),
        modDano: ranged ? mods.danoProyectiles : mods.danoArmas,
        skillKey: ranged ? "proyectiles" : weapon ? "armas" : "wrestling",
      };

      if (ranged && weapon?.needsAmmo) {
        // Munición: usar el tipo EQUIPADO si está disponible; si no, la primera.
        const arrowSlot = pickArrowSlot(s);
        if (!arrowSlot) {
          consoleMsg(s, "¡No tienes municiones!", "combate");
          return null;
        }
        const arrowDef = getItem(arrowSlot.item);
        prep.ammoItem = arrowSlot.item;
        prep.ammoMin = arrowDef?.minHit ?? 0;
        prep.ammoMax = arrowDef?.maxHit ?? 0;
      }
      return prep;
    }

    function commitAttackCosts(s: Session, prep: AttackPrep, now: number): void {
      breakInvisibility(s);
      cancelExitCountdown(s); // atacar cancela la salida
      s.lastAttackAt = now;
      // Energía: ya no se consume al golpear (no limita el combate).
      if (prep.ammoItem !== undefined) {
        // Consume 1 flecha (solo si el ataque se lanzó, como el AO).
        const removed = removeItem(s.inventory, prep.ammoItem, 1);
        if (removed) s.inventory = removed;
        sendInventoryUpdate(s);
      }
      sessions.touch(s.id);
      stopMeditating(s);
      sendStatsUpdate(s);
    }

    function sendMissOrBlock(
      s: Session,
      targetEntity: EntityId,
      hp: number,
      maxHp: number,
      blocked: boolean,
    ): void {
      const pkt: Damage = {
        op: ServerToClientOp.Damage,
        attackerId: s.characterId as EntityId,
        targetId: targetEntity,
        amount: 0,
        hp,
        maxHp,
        ...(blocked ? { blocked: true } : { miss: true }),
      };
      broadcastToMap(s.mapId, pkt);
    }

    // GM /eliminarnpc armado: saca el NPC del mundo. Si lo invocó un GM (/invocar)
    // lo quita de gm-npcs.json; si es del .inf del mapa, persiste la baja
    // (npc-deletions). En ambos casos no reaparece tras un redeploy. Un solo uso.
    function gmDeleteNpc(s: Session, npc: NpcInstance): void {
      s.armedDeleteNpc = false;
      if (npc.gmSpawned) {
        removeGmNpc(npc.mapId, npc.type.number, npc.spawn.x, npc.spawn.y);
      } else {
        addNpcDeletion(npc.mapId, npc.type.number, npc.spawn.x, npc.spawn.y);
      }
      npcs.remove(npc.id);
      const gone: EntityDespawn = { op: ServerToClientOp.EntityDespawn, id: npc.id as EntityId };
      broadcastToMap(npc.mapId, gone);
      consoleMsg(s, `NPC eliminado: ${npc.type.name} (#${npc.type.number.toString()}). No reaparecerá.`, "global");
    }

    function handleAttack(s: Session, attack: AttackRequest): void {
      const now = Date.now();
      const targetId = attack.targetId as unknown as number;
      if (targetId === s.characterId) return;

      // GM con /eliminarnpc armado: clickear (atacar) a un NPC lo ELIMINA en vez de
      // golpearlo — así se pueden sacar criaturas/jefes invocados con /invocar.
      if (s.armedDeleteNpc && s.role >= 3 && isNpcId(targetId)) {
        const npc = npcs.get(targetId);
        if (npc && npc.mapId === s.mapId) {
          gmDeleteNpc(s, npc);
          return;
        }
      }

      const prep = prepareAttack(s, now);
      if (!prep) return;

      if (isNpcId(targetId)) {
        attackNpc(s, targetId, now, prep);
        return;
      }

      const target = sessions.getByCharacterId(targetId);
      if (!target || target.mapId !== s.mapId) return;
      if (target.deadUntil !== 0) return;
      const dist = chebyshev(s.position, target.position);
      if (prep.ranged ? dist > RANGED_RANGE : !isAdjacent(s.position, target.position)) return;
      if (s.partyId !== null && s.partyId === target.partyId) return;
      // Zona segura: no PvP en ciudad
      if (!canAttackPlayer(s.mapId, target.mapId)) return;
      // Seguro /SEG: con el seguro puesto no se ataca a ciudadanos.
      if (s.safeOn && !isCriminal(target)) {
        consoleMsg(s, "No podés atacar ciudadanos — desactivá el seguro (/SEG).", "combate");
        return;
      }
      // La Armada Real pierde la facción al atacar a un ciudadano (incluye a
      // otros Armada; los criminales/Caos sí se pueden atacar).
      if (s.faction === FACTION_ARMADA && !isCriminal(target)) {
        loseFaction(s, "¡Atacaste a un ciudadano! Fuiste expulsado de la Armada Real.");
      }

      commitAttackCosts(s, prep, now);
      stopMeditating(target);

      // Impacto (UsuarioImpacto): 50 + (ataque - evasión)*0.4, clamp 10-90.
      // El escudo del defensor suma evasión; si falló y hay escudo, puede
      // rechazar el golpe (mensaje + sonido en el original).
      const targetShield = target.equippedShield !== null;
      const evasion =
        playerPoderEvasion(target) + (targetShield ? playerPoderEvasionEscudo(target) : 0);
      if (!rollHit(prep.poder, evasion)) {
        const blocked =
          targetShield && rollShieldBlock(target.skills.defensa, target.skills.tacticas);
        sendMissOrBlock(s, target.characterId as EntityId, target.hp, target.maxHp, blocked);
        // Entrenamiento: el atacante falló; el defensor evadió / bloqueó.
        trainSkill(s, prep.skillKey, false);
        trainSkill(target, blocked ? "defensa" : "tacticas", true);
        return;
      }
      trainSkill(s, prep.skillKey, true);

      // Daño (CalcularDano) − defensa por armadura del objetivo, mínimo 1.
      const defTotal = rollTotalArmorDefense(target.equippedArmor, target.equippedHelmet, target.equippedShield);
      let amount = Math.max(
        1,
        calcularDano({
          weaponMin: prep.weaponMin,
          weaponMax: prep.weaponMax,
          extraAmmoMin: prep.ammoMin,
          extraAmmoMax: prep.ammoMax,
          userHitMin: golpeUsuario(s.classId, s.level).min,
          userHitMax: golpeUsuario(s.classId, s.level).max,
          fuerza: s.str + s.strBonus,
          modClaseDano: prep.modDano,
        }) + equipBonusHitVsPlayer(s) - defTotal,
      );

      // Apuñalar (arma con Apunala=1): daño extra ×1.4 asesino / ×1.5 resto.
      // MIN_APUNALAR=10 de skill (el asesino apuñala sin mínimo).
      let stabbed = false;
      const weapon = s.equippedWeapon !== null ? getItem(s.equippedWeapon) : undefined;
      if (!prep.ranged && weapon?.stabs && (s.classId === 5 || s.skills.apunalar >= 10)) {
        stabbed = rollStab(s.classId, s.skills.apunalar);
        if (stabbed) {
          amount += Math.round(amount * (s.classId === 5 ? 1.4 : 1.5));
        }
        trainSkill(s, "apunalar", stabbed);
      }

      target.hp = Math.max(0, target.hp - amount);
      cancelExitCountdown(target); // recibir daño PvP cancela la salida

      const damage: Damage = {
        op: ServerToClientOp.Damage,
        attackerId: s.characterId as EntityId,
        targetId: target.characterId as EntityId,
        amount,
        hp: target.hp,
        maxHp: target.maxHp,
        ...(stabbed ? { stab: true } : {}),
      };
      broadcastToMap(s.mapId, damage);

      syncPartyStats(target);
      if (target.hp === 0) {
        resolvePlayerDeath(target, s);
        req.log.info(
          { attacker: s.characterId, victim: target.characterId },
          "[ws] muerte en combate PvP",
        );
      }
    }

    function attackNpc(s: Session, npcId: number, now: number, prep: AttackPrep): void {
      const npc = npcs.get(npcId);
      if (!npc || npc.mapId !== s.mapId || npc.deadUntil !== 0) return;
      if (!npc.type.attackable || npc.type.merchant || npc.type.banker) return;
      const dist = chebyshev(s.position, npc.position);
      if (prep.ranged ? dist > RANGED_RANGE : !isAdjacent(s.position, npc.position)) return;

      commitAttackCosts(s, prep, now);

      // Impacto contra la evasión del NPC (PoderEvasion de NPCs.dat).
      if (!rollHit(prep.poder, npc.type.poderEvasion)) {
        sendMissOrBlock(s, npc.id as EntityId, npc.hp, npc.type.maxHp, false);
        trainSkill(s, prep.skillKey, false);
        return;
      }
      trainSkill(s, prep.skillKey, true);

      // Daño (CalcularDano) − DEF física del NPC (UserDanoNpc), mínimo 0.
      let amount = Math.max(
        0,
        calcularDano({
          weaponMin: prep.weaponMin,
          weaponMax: prep.weaponMax,
          extraAmmoMin: prep.ammoMin,
          extraAmmoMax: prep.ammoMax,
          userHitMin: golpeUsuario(s.classId, s.level).min,
          userHitMax: golpeUsuario(s.classId, s.level).max,
          fuerza: s.str + s.strBonus,
          modClaseDano: prep.modDano,
        }) + equipBonusHitVsNpc(s) - npc.type.defense,
      );

      // Apuñalar contra criaturas: daño extra ×2 (DoApunalar del AO).
      let stabbed = false;
      const weapon = s.equippedWeapon !== null ? getItem(s.equippedWeapon) : undefined;
      if (!prep.ranged && weapon?.stabs && (s.classId === 5 || s.skills.apunalar >= 10)) {
        stabbed = rollStab(s.classId, s.skills.apunalar);
        if (stabbed) amount += amount * 2;
        trainSkill(s, "apunalar", stabbed);
      }

      damageNpc(s, npc, amount, now, stabbed);
    }

    // Aplica daño a un NPC (melee o hechizo) y resuelve muerte: oro, drops
    // dispersos, XP compartida en party, respawn programado.
    // Otorga XP con level-up (recalcula skills/HP/MP/hechizos como siempre).
    function grantXp(recv: Session, amount: number): void {
      if (amount <= 0) return;
      const prevLevel = recv.level;
      const gain = applyXpGain(recv.level, recv.xp, amount);
      recv.xp = gain.totalXp;
      if (gain.leveledUp) {
        recv.level = gain.level;
        recv.skills = skillsForLevel(recv.level);
        const classDef = getClass(recv.classId);
        if (classDef) {
          recv.maxMana = calcMaxMp(classDef, recv.level, recv.int_);
          recv.maxSta = calcMaxSta(classDef, recv.level);
        }
        recomputeMaxHp(recv); // base por clase/nivel + bonus de HP del equipo
        recv.hp = recv.maxHp;
        recv.mana = recv.maxMana;
        partyRegistry.updateMemberStats(recv.characterId, recv.hp, recv.maxHp);
        sendSpellsKnown(recv);
        // Dejó de ser newbie (AO Libre: EsNewbie = nivel <= 12): quitar items
        // newbie y sacarlo del Dungeon Newbie a Ullathorpe.
        if (prevLevel <= NEWBIE_MAX_LEVEL && recv.level > NEWBIE_MAX_LEVEL) graduateNewbie(recv);
      }
      sendStatsUpdate(recv);
    }

    // Graduación de newbie (AO Libre GameLogic.bas EsNewbie: ELV <= LimiteNewbie=12).
    // Al pasar el nivel 12: se quitan los objetos newbie (intransferibles) y, si
    // está en el Dungeon Newbie (mapa 167), se lo teletransporta a Ullathorpe (1).
    function graduateNewbie(s: Session): void {
      const hadNewbie = s.inventory.some((sl) => getItem(sl.item)?.newbie === true);
      if (hadNewbie) s.inventory = s.inventory.filter((sl) => getItem(sl.item)?.newbie !== true);
      const inDungeon = s.mapId === NEWBIE_DUNGEON_MAP;
      if (inDungeon) {
        const ulla = getMap(1);
        if (ulla) doGmTeleport(s, 1, ulla.spawn.x, ulla.spawn.y);
      }
      if (hadNewbie || inDungeon) {
        sendInventoryUpdate(s); // recomputa equipo (desequipa lo newbie que ya no está)
        consoleMsg(
          s,
          "¡Ya no eres newbie! Se te quitaron los objetos de newbie" + (inDungeon ? " y volviste a Ullathorpe." : "."),
          "global",
        );
      }
    }

    // XP de combate como el AO 0.13: POR DAÑO hecho (no al último golpe). En
    // party se reparte PONDERADO POR NIVEL entre los miembros vivos CERCANOS
    // (mismo mapa, ≤20 tiles).
    function awardCombatXp(s: Session, amount: number): void {
      if (amount <= 0) return;
      const party = partyRegistry.getByCharacter(s.characterId);
      if (!party) {
        grantXp(s, amount);
        return;
      }
      const nearby = Array.from(party.members.keys())
        .map((id) => sessions.getByCharacterId(id))
        .filter((m): m is Session =>
          !!m && m.mapId === s.mapId && m.deadUntil === 0 && chebyshev(m.position, s.position) <= 20);
      if (nearby.length === 0) {
        grantXp(s, amount);
        return;
      }
      const totalLevel = nearby.reduce((t, m) => t + m.level, 0);
      for (const m of nearby) {
        grantXp(m, Math.max(1, Math.floor((amount * m.level) / totalLevel)));
      }
      broadcastPartyUpdate(party.id);
    }

    function damageNpc(
      s: Session,
      npc: NpcInstance,
      amount: number,
      now: number,
      stabbed = false,
      attackerEntityId?: number,
      magic = false,
    ): void {
      const prevHp = npc.hp;
      npc.hp = Math.max(0, npc.hp - amount);
      // XP por daño efectivo, proporcional a la vida del NPC.
      const effective = Math.min(amount, prevHp);
      const xpGolpe = Math.floor((npc.type.xpReward * effective) / npc.type.maxHp);
      awardCombatXp(s, xpGolpe);
      // Aviso al chat por cada golpe con XP (el número en negrita con "!!").
      if (xpGolpe > 0) {
        consoleMsg(s, `Has golpeado a un ${npc.type.name} y te ha dado **${xpGolpe.toString()}!!** de experiencia`, "global");
      }

      // Las mascotas del atacante asisten contra este NPC (FollowAmo).
      if (npc.hp > 0 && npc.ownerCharacterId !== s.characterId) {
        for (const pet of petsOf(s.characterId)) {
          if (pet.id !== npc.id && pet.mapId === npc.mapId) pet.petTargetNpcId = npc.id;
        }
      }

      const damage: Damage = {
        op: ServerToClientOp.Damage,
        attackerId: (attackerEntityId ?? s.characterId) as EntityId,
        targetId: npc.id as EntityId,
        amount,
        hp: npc.hp,
        maxHp: npc.type.maxHp,
        ...(stabbed ? { stab: true } : {}),
        ...(magic ? { magic: true } : {}),
      };
      broadcastToMap(s.mapId, damage);

      if (npc.hp === 0) {
        npc.deadUntil = now + npc.type.respawnMs;
        npc.targetCharacterId = null;
        const death: Death = { op: ServerToClientOp.Death, id: npc.id as EntityId, wav: npcDeathSound(npc.type) };
        broadcastToMap(npc.mapId, death);

        // Oro: en AO el oro se dropea como item 12 de la tabla Drop (cada entrada
        // con su probabilidad). Lo enviamos directo a la bolsa del que mató. El
        // GiveGLD directo se mantiene para los pocos NPCs que lo usan.
        // Además juntamos una línea por CADA probabilidad que se ejecutó (oro o
        // item) para avisarle al que mató qué recompensa dio la criatura.
        const rewardLines: string[] = [];
        let gold = rollNpcGold(npc.type);
        if (gold > 0) rewardLines.push(`Has obtenido ${gold.toString()} de oro.`);
        for (const drop of npc.type.drops) {
          if (Math.random() >= drop.chance) continue;
          if (drop.item === GOLD_ITEM) {
            gold += drop.qty;
            rewardLines.push(`Has obtenido ${drop.qty.toString()} de oro.`);
            continue;
          }
          // Cada item busca su propio tile libre — no se apilan (AO original).
          if (!dropOnGround(npc.mapId, npc.position, drop.item, drop.qty)) continue;
          const itemName = getItem(drop.item)?.name ?? `objeto ${drop.item.toString()}`;
          rewardLines.push(`Has obtenido ${drop.qty.toString()} ${itemName}.`);
        }
        if (gold > 0) addGold(s, gold);
        for (const line of rewardLines) consoleMsg(s, line, "combate");

        // (La XP ya se otorgó POR DAÑO en cada golpe — awardCombatXp.)
        sendInventoryUpdate(s);
        // Progreso de misiones del que mató.
        questKillProgress(s, npc.type.number);
        req.log.info(
          { attacker: s.characterId, npc: npc.id, gold },
          "[ws] NPC eliminado",
        );
        npcKillsTotal.inc();
      }
    }

    // Golpe de mascota contra NPC (NpcAtacaNpc): impacto por poderes del
    // NPCs.dat; el kill lo resuelve damageNpc (XP/drops al amo, como el AO).
    // Morir a manos de un NPC = misma resolución que PvP (drop de items, etc.).
    setPlayerDeathHandler(resolvePlayerDeath);
    setPetAttackHandler((owner, target, petId, now) => {
      const pet = npcs.get(petId);
      if (!pet) return;
      if (!rollHit(pet.type.poderAtaque, target.type.poderEvasion)) {
        const missPkt: Damage = {
          op: ServerToClientOp.Damage,
          attackerId: petId as EntityId,
          targetId: target.id as EntityId,
          amount: 0,
          hp: target.hp,
          maxHp: target.type.maxHp,
          miss: true,
        };
        broadcastToMap(pet.mapId, missPkt);
        return;
      }
      const amount = Math.max(1, rollNpcDamage(pet.type) - target.type.defense);
      damageNpc(owner, target, amount, now, false, petId);
    });

    // ── Domar animales (DoDomar / Trabajo.bas, reglas literales) ─────────

    function handleTame(s: Session): void {
      if (s.deadUntil !== 0) return;
      const now = Date.now();
      if (now - s.lastWorkAt < WORK_INTERVAL_MS) return;
      s.lastWorkAt = now;

      // Criatura domable más cercana en radio 2 (el AO doma por click cercano).
      let target: NpcInstance | null = null;
      let bestDist = Infinity;
      for (const n of npcs.inMap(s.mapId)) {
        if (n.deadUntil !== 0 || n.type.domable <= 0) continue;
        const d = chebyshev(s.position, n.position);
        if (d <= 2 && d < bestDist) {
          target = n;
          bestDist = d;
        }
      }
      if (!target) {
        consoleMsg(s, "No hay criaturas domables cerca.", "global");
        return;
      }
      if (target.ownerCharacterId === s.characterId) {
        consoleMsg(s, "Ya domaste a esa criatura.", "global");
        return;
      }
      if (target.ownerCharacterId !== null) {
        consoleMsg(s, "La criatura ya tiene amo.", "global");
        return;
      }
      const pets = petsOf(s.characterId);
      if (pets.length >= MAX_MASCOTAS) {
        consoleMsg(s, "No puedes controlar más criaturas.", "global");
        return;
      }
      if (pets.filter((p) => p.type.number === target.type.number).length >= 2) {
        consoleMsg(s, "No puedes domar más de dos criaturas del mismo tipo.", "global");
        return;
      }
      // DoDomar: puntos = Carisma × skill Domar; éxito si alcanzan los
      // puntos del Domable Y sale 1 en 5 (azar del original).
      const puntosDomar = s.car * (s.skills.domar ?? 0);
      if (target.type.domable <= puntosDomar && 1 + Math.floor(Math.random() * 5) === 1) {
        target.ownerCharacterId = s.characterId;
        target.petTargetNpcId = null;
        consoleMsg(s, "La criatura te ha aceptado como su amo.", "global");
        trainSkill(s, "domar", true);
      } else if (target.type.domable > puntosDomar) {
        consoleMsg(s, "No tienes suficientes puntos de domar para esa criatura.", "global");
        trainSkill(s, "domar", false);
      } else {
        consoleMsg(s, "No has logrado domar esa criatura.", "global");
        trainSkill(s, "domar", false);
      }
      sendStatsUpdate(s);
    }

    function handlePickup(s: Session): void {
      if (s.deadUntil !== 0) return;
      const g = groundItems.atTile(s.mapId, s.position);
      if (!g) return;
      // Espacio: tope de stack (10k) + tope de slots (24). El oro no ocupa slot.
      if (g.item !== GOLD_ITEM && carryCapacity(s.inventory, g.item) < g.qty) {
        consoleMsg(s, "No tienes espacio en el inventario.", "combate");
        return;
      }
      groundItems.remove(g.id);
      // El oro (item 12) va a la bolsa, no al inventario (AO original).
      if (g.item === GOLD_ITEM) {
        addGold(s, g.qty);
        sendStatsUpdate(s);
      } else {
        s.inventory = addItem(s.inventory, g.item, g.qty);
      }
      const despawn: GroundItemDespawn = {
        op: ServerToClientOp.GroundItemDespawn,
        id: g.id as EntityId,
      };
      broadcastToMap(s.mapId, despawn);
      sendInventoryUpdate(s);
    }

    function handleDropItem(s: Session, pkt: DropItemRequest): void {
      if (s.deadUntil !== 0) return;
      // Slot entero válido + qty saneada (NaN/decimales corrompían stacks).
      if (!Number.isInteger(pkt.slot)) return;
      const qty = sanQty(pkt.qty);
      if (qty === 0) return;
      // Chequeo de lugar ANTES de sacar el item: si el tile propio ya tiene item
      // y no hay tile libre cerca, no se tira (nunca 2 items en el mismo lugar).
      const pos = findDropTile(s.mapId, s.position);
      if (!pos) {
        consoleMsg(s, "No hay lugar libre para tirar el objeto acá.", "global");
        return;
      }
      const removed = removeFromSlot(s.inventory, pkt.slot, qty);
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
      dropOnGround(s.mapId, s.position, removed.item, removed.qty); // tile libre garantizado
      sendInventoryUpdate(s);
    }

    function handleReorder(s: Session, pkt: InventoryReorderRequest): void {
      const next = reorderSlots(s.inventory, pkt.from, pkt.to);
      if (!next) return;
      s.inventory = next;
      sendInventoryUpdate(s);
    }

    function consumeOne(s: Session, item: number): void {
      const removed = removeItem(s.inventory, item, 1);
      if (removed) s.inventory = removed;
      sendStatsUpdate(s);
      sendInventoryUpdate(s);
    }

    function handleUseItem(s: Session, pkt: UseItemRequest): void {
      const def = getItem(pkt.item);
      if (!def) return;
      if (countItem(s.inventory, pkt.item) === 0) return;
      // Muerto no puede usar nada (UseInvItem del AO).
      if (s.deadUntil !== 0) return;

      const now = Date.now();
      // Paralizado no puede usar objetos (AO: UserParalizado en UseInvItem).
      // Inmovilizar (Inmovilizar) solo frena el movimiento: sí puede tomar pociones.
      if (s.paralyzedUntil > now) {
        consoleMsg(s, "Estás paralizado y no podés usar objetos.", "combate");
        return;
      }
      // IntervaloUserPuedeUsar (125ms) para todo uso.
      if (now - s.lastUseAt < INTERVALS.use) return;
      if (def.type === "potion") {
        // AO Libre: las pociones (rojas) se spamean rápido — cooldown propio
        // corto y tuneable (INTERVALS.potion). El poteo es fluido incluso en
        // combate: golpeUsar por defecto es 0 (no frena tras golpear); solo
        // frena si el admin lo sube en el panel.
        if (INTERVALS.golpeUsar > 0 && now - s.lastAttackAt < INTERVALS.golpeUsar) {
          consoleMsg(s, "¡Debes esperar unos momentos para tomar una poción!", "combate");
          return;
        }
        if (now - s.lastPotionAt < INTERVALS.potion) return;
        s.lastPotionAt = now;
      }
      s.lastUseAt = now;

      // Pergaminos (objType 24): al doble-click enseñan un hechizo. Fiel a AO
      // Libre (ClasePuedeUsarItem): CUALQUIER clase mágica puede aprender el
      // hechizo salvo que el pergamino la prohíba (ClaseProhibida = forbidden
      // Classes). El único otro requisito es el nivel: el hechizo se aprende
      // cuando tu Magia (derivada del nivel) alcanza su minSkill. Se consume al
      // aprenderlo y queda permanente (persistido) en el personaje.
      if (def.spellId !== undefined) {
        const spellId = def.spellId;
        const spellName = getAoSpell(spellId)?.name ?? "este hechizo";
        if (!classUsesMagic(s.classId)) {
          consoleMsg(s, "Tu clase no puede usar magia.", "combate");
          return;
        }
        if (def.forbiddenClasses?.includes(s.classId)) {
          consoleMsg(s, `Tu clase no puede aprender ${spellName}.`, "combate");
          return;
        }
        const reqLevel = spellLearnLevel(spellId);
        if (reqLevel === undefined) {
          consoleMsg(s, `${spellName} no se puede aprender.`, "combate");
          return;
        }
        if (s.level < reqLevel) {
          consoleMsg(s, `Necesitás ser nivel ${reqLevel.toString()} para aprender ${spellName}.`, "combate");
          return;
        }
        if (s.knownSpells.includes(spellId)) {
          consoleMsg(s, `Ya conocés ${spellName}.`, "combate");
          return;
        }
        s.knownSpells = [...s.knownSpells, spellId];
        consumeOne(s, pkt.item);
        sendSpellsKnown(s);
        consoleMsg(s, `¡Has aprendido ${spellName}!`, "combate");
        void persistPosition(s).catch(() => undefined);
        return;
      }

      if (def.type === "potion") {
        // AO tira RandomNumber(MinModificador, MaxModificador) en cada uso.
        const randInt = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (Math.max(lo, hi) - lo + 1));
        const healMax = def.healMax ?? def.heal ?? 0;
        const agiMax = def.agiBoostMax ?? def.agiBoost ?? 0;
        const strMax = def.strBoostMax ?? def.strBoost ?? 0;
        if (healMax > 0) {
          // Poción Roja (InvUsuario.bas L1864): +RandomNumber(MinMod, MaxMod).
          // Se toma (y se consume) aunque la vida esté llena, como en el AO.
          const amount = randInt(def.healMin ?? def.heal ?? healMax, healMax);
          s.hp = Math.min(s.maxHp, s.hp + amount);
          consumeOne(s, pkt.item);
          consoleMsg(s, "", "global", SND_BEBER); // glup clásico del AO
        } else if (def.restoresMana || (def.manaHeal ?? 0) > 0) {
          if (s.maxMana === 0) return; // clase sin maná (no la usa)
          // Poción Azul del AO (InvUsuario.bas L1882):
          //   maná += 4% del máximo + nivel/2 + 40/nivel
          const gain =
            Math.floor(s.maxMana * 0.04) + Math.floor(s.level / 2) + Math.floor(40 / Math.max(1, s.level));
          // Se consume aunque el maná esté lleno (AO).
          s.mana = Math.min(s.maxMana, s.mana + gain);
          consumeOne(s, pkt.item);
          consoleMsg(s, "", "global", SND_BEBER);
        } else if (agiMax > 0 || strMax > 0) {
          // Drogas del AO: Amarilla (+AGI, InvUsuario.bas L1816) / Verde (+STR,
          // L1839). Cada toma SUMA RandomNumber(Min,Max) al bonus ya acumulado,
          // no re-tira de cero. El bonus se guarda aparte del base.
          // House rule: el BUFF (bonus) topa en +21 sobre el atributo base de cada
          // clase (ej: humano str 19 → 40 con el buff al máximo).
          const BUFF_MAX = 21;
          if (agiMax > 0) {
            const roll = randInt(def.agiBoostMin ?? def.agiBoost ?? agiMax, agiMax);
            s.agiBonus = Math.min(s.agiBonus + roll, BUFF_MAX);
          }
          if (strMax > 0) {
            const roll = randInt(def.strBoostMin ?? def.strBoost ?? strMax, strMax);
            s.strBonus = Math.min(s.strBonus + roll, BUFF_MAX);
          }
          // Duración de la droga: house rule de 100s para verde/amarilla (en AO
          // eran ~40s). Fija, independiente del DuracionEfecto del obj.dat.
          s.buffUntil = Date.now() + 100 * 1000;
          consumeOne(s, pkt.item);
          consoleMsg(s, "", "global", SND_BEBER);
        } else if (def.curesPoison) {
          // Poción Violeta: quita el veneno (InvUsuario.bas L1897).
          const dots = activeDots.get(s.characterId);
          if (!dots?.some((d) => d.poison)) return;
          activeDots.set(s.characterId, dots.filter((d) => !d.poison));
          consumeOne(s, pkt.item);
          consoleMsg(s, "", "global", SND_BEBER);
        }
      } else if (def.type === "arrow") {
        // Equipar munición: elegir qué tipo de flecha usar (toggle). Se marca
        // con el tilde verde; el arco dispara ese tipo.
        s.equippedArrow = s.equippedArrow === pkt.item ? null : pkt.item;
        sendInventoryUpdate(s);
      } else if (def.objType === 31) {
        // Barco (DoNavega): junto al agua para zarpar, junto a tierra para
        // desembarcar. Requiere skill de Navegación del barco.
        const map = getMap(s.mapId);
        if (!map) return;
        if (s.mounted) {
          consoleMsg(s, "¡No puedes navegar mientras estás en tu montura!", "global");
          return;
        }
        if (s.skills.navegacion < (def.minSkillNav ?? 0)) {
          consoleMsg(s, `Necesitás ${(def.minSkillNav ?? 0).toString()} de Navegación para ese barco.`, "global");
          return;
        }
        const DIRS = [[0, -1], [0, 1], [1, 0], [-1, 0]] as const;
        if (!s.navigating) {
          const shore = DIRS.find(([dx, dy]) => isWaterAt(map, s.position.x + dx, s.position.y + dy));
          if (!shore) {
            consoleMsg(s, "Tenés que estar junto al agua para zarpar.", "global");
            return;
          }
          s.navigating = true;
          s.boatBody = def.bodyId ?? 0;
          // Zarpar: el personaje entra al agua.
          s.position = { x: s.position.x + shore[0], y: s.position.y + shore[1] };
          consoleMsg(s, "Comenzás a navegar.", "global", 55); // CONVERSION_BARCO
          trainSkill(s, "navegacion", true);
        } else {
          const land = DIRS.find(([dx, dy]) => isWalkable(map, s.position.x + dx, s.position.y + dy, false));
          if (!land) {
            consoleMsg(s, "Necesitás estar junto a la costa para desembarcar.", "global");
            return;
          }
          s.navigating = false;
          s.boatBody = 0;
          s.position = { x: s.position.x + land[0], y: s.position.y + land[1] };
          consoleMsg(s, "Dejás de navegar.", "global", 55);
        }
        // Mover + cambiar apariencia para todos.
        const update: EntityUpdate = {
          op: ServerToClientOp.EntityUpdate,
          id: s.characterId as EntityId,
          position: { x: s.position.x, y: s.position.y },
          direction: s.direction,
        };
        broadcastToMap(s.mapId, update);
        sendInventoryUpdate(s); // recalcula y broadcastea el body visible
      } else if (def.objType === 25) {
        // Montura (DoEquita del Trabajo.bas): toggle equitando con el body
        // de la montura (NumRopaje). 10s de espera tras desmontar.
        if (s.deadUntil !== 0) return;
        if (s.navigating) {
          consoleMsg(s, "¡No puedes usar tu montura mientras navegas!", "global");
          return;
        }
        const now = Date.now();
        if (!s.mounted) {
          if (now < s.mountCooldownUntil) {
            const secs = Math.ceil((s.mountCooldownUntil - now) / 1000);
            consoleMsg(s, `Debes esperar ${secs} segundos para volver a usar tu montura.`, "global");
            return;
          }
          s.mounted = true;
          s.mountBody = def.bodyId ?? 0;
          consoleMsg(s, `Te has montado en tu ${def.name}.`, "global");
          trainSkill(s, "equitacion", true);
        } else {
          s.mounted = false;
          s.mountBody = 0;
          s.mountCooldownUntil = now + 10_000;
          consoleMsg(s, "Has desmontado.", "global");
        }
        sendInventoryUpdate(s); // recalcula y broadcastea el body visible
      } else if (def.id === PRODUCTS.lena) {
        // Hacer fogata: 3 leñas → fogata encendida en el piso (AO).
        const removed = removeItem(s.inventory, PRODUCTS.lena, 3);
        if (!removed) {
          consoleMsg(s, "Necesitás 3 leñas para hacer una fogata.", "global");
          return;
        }
        s.inventory = removed;
        dropOnGround(s.mapId, s.position, PRODUCTS.fogata, 1); // tile libre (no apila)
        trainSkill(s, "supervivencia", true);
        consoleMsg(s, "Has hecho una fogata. Usá Descansar (R) para recuperarte junto a ella.", "global", 14); // SND_FOGATA
        sendInventoryUpdate(s);
      } else if (def.type === "food") {
        if (s.deadUntil !== 0) return;
        if (s.hunger >= 100) return;
        s.hunger = Math.min(100, s.hunger + (def.hunger ?? 10));
        consumeOne(s, pkt.item);
        consoleMsg(s, "", "global", 7); // SND_COMIDA (masticar)
      } else if (def.type === "drink") {
        if (s.deadUntil !== 0) return;
        // Las bebidas restauran sed (MinAgu) y también energía (MinST) del AO.
        const staGain = def.stamina ?? 0;
        const canDrink = s.thirst < 100 || (staGain > 0 && s.sta < s.maxSta);
        if (!canDrink) return;
        s.thirst = Math.min(100, s.thirst + (def.thirst ?? 0));
        if (staGain > 0) s.sta = Math.min(s.maxSta, s.sta + staGain);
        consumeOne(s, pkt.item);
        consoleMsg(s, "", "global", SND_BEBER);
      } else if (def.type === "weapon" || def.type === "armor" || def.type === "helmet" || def.type === "shield") {
        // Doble click sobre el item ya equipado lo desequipa (AO original).
        const isEquipped =
          (def.type === "weapon" && s.equippedWeapon === pkt.item) ||
          (def.type === "armor" && s.equippedArmor === pkt.item) ||
          (def.type === "helmet" && s.equippedHelmet === pkt.item) ||
          (def.type === "shield" && s.equippedShield === pkt.item);
        // Al EQUIPAR (no al desequipar) se respetan las clases prohibidas del
        // AO (CP1..CPn de obj.dat). Desequipar siempre se permite. Los GMs
        // (Consejero/Semidiós/Dios, role > 0) pueden usar TODO sin restricción.
        if (!isEquipped && s.role === 0 && def.forbiddenClasses?.includes(s.classId)) {
          consoleMsg(s, "Tu clase no puede usar este objeto.", "global");
          return;
        }
        if (def.type === "weapon") s.equippedWeapon = isEquipped ? null : pkt.item;
        else if (def.type === "armor") s.equippedArmor = isEquipped ? null : pkt.item;
        else if (def.type === "helmet") s.equippedHelmet = isEquipped ? null : pkt.item;
        else s.equippedShield = isEquipped ? null : pkt.item;
        // SND_SACARARMA del AO al equipar un arma.
        if (def.type === "weapon" && !isEquipped) consoleMsg(s, "", "global", 25);
        // El equipo puede dar HP máximo extra (bonusHp) → recalcular y avisar.
        recomputeMaxHp(s);
        sendStatsUpdate(s);
        sendInventoryUpdate(s);
      }
    }

    // Detalle de una criatura/NPC (click derecho): exp, oro y drops con su
    // probabilidad. Usa el tipo EFECTIVO (con overrides del panel admin).
    function handleNpcInfo(s: Session, pkt: NpcInfoRequest): void {
      const id = pkt.targetId as unknown as number;
      if (!isNpcId(id)) return;
      const npc = npcs.get(id);
      if (!npc) return;
      const t = getNpcType(npc.type.number) ?? npc.type;
      const gold = t.drops
        .filter((d) => d.item === GOLD_ITEM)
        .map((d) => ({ qty: d.qty, chance: d.chance }));
      const drops = t.drops
        .filter((d) => d.item !== GOLD_ITEM)
        .map((d) => ({ item: d.item, qty: d.qty, chance: d.chance }));
      const resp: NpcInfoResponse = {
        op: ServerToClientOp.NpcInfo,
        number: t.number,
        name: t.name,
        maxHp: t.maxHp,
        hp: npc.hp,
        xpReward: t.xpReward,
        gold,
        drops,
      };
      send(s.socket, resp);
    }

    // Info de un personaje (click izquierdo): nombre, descripción, nivel, clan.
    function handlePlayerInfo(s: Session, pkt: PlayerInfoRequest): void {
      const id = pkt.targetId as unknown as number;
      const target = id === s.characterId ? s : sessions.getByCharacterId(id);
      if (!target) return;
      const resp: PlayerInfoResponse = {
        op: ServerToClientOp.PlayerInfo,
        name: target.characterName,
        description: target.description,
        level: target.level,
        classN: getClass(target.classId)?.name ?? "",
        clan: target.guildName,
        criminal: isCriminal(target),
        role: target.role,
      };
      send(s.socket, resp);
    }

    function handleAllocStat(s: Session, pkt: AllocStatRequest): void {
      if (s.statPoints <= 0) return;
      // Validar el stat ANTES de descontar (un stat inválido quemaba el punto).
      if (!["str", "agi", "int", "con", "car"].includes(pkt.stat)) return;
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
      // Interacción con un tile del mapa: puertas y carteles (Acciones.bas).
      if (pkt.tile) {
        handleTileInteract(s, pkt.tile.x, pkt.tile.y);
        return;
      }
      const targetId = pkt.targetId as unknown as number;
      if (!isNpcId(targetId)) return;
      const npc = npcs.get(targetId);
      if (!npc || npc.mapId !== s.mapId) return;

      // GM /eliminarnpc armado: el click a un vendedor/banquero lo ELIMINA del
      // mundo (en vez de abrir la tienda) y persiste la baja para que no vuelva
      // a aparecer tras un redeploy. Es de un solo uso (se desarma al usarlo).
      if (s.armedDeleteNpc && s.role >= 3) {
        gmDeleteNpc(s, npc);
        return;
      }

      // Sacerdote por click (Acciones.bas L125-140): distancia ≤ 10 —
      // revive al muerto y cura al herido.
      if (npc.type.isPriest && chebyshev(s.position, npc.position) <= 10) {
        if (s.deadUntil !== 0) {
          revivePlayer(s);
          sendInventoryUpdate(s); // re-broadcastea los overlays de equipo
          consoleMsg(s, "¡Has sido resucitado!", "global", 213); // SND_RESUCITAR
        } else if (s.faction !== 2 && s.citizensKilled > s.pardonedKills) {
          // FIANZA: el sacerdote perdona los crímenes por oro. El precio crece
          // por Fibonacci (500, 500, 1000, 1500, 2500…). La Legión no tiene perdón.
          const price = bailPrice(s.bailsPaid);
          if (s.gold < price) {
            consoleMsg(s, `Sacerdote: "Puedo perdonar tus crímenes por ${price.toLocaleString("es")} monedas de oro." (no te alcanza)`, "global");
          } else {
            s.gold -= price;
            s.pardonedKills = s.citizensKilled;
            s.bailsPaid += 1;
            s.criminalUntil = 0;
            broadcastToMap(s.mapId, {
              op: ServerToClientOp.CriminalUpdate,
              id: s.characterId as EntityId,
              criminal: false,
              expiresAt: 0,
            } satisfies CriminalUpdate);
            consoleMsg(s, `El sacerdote perdona tus crímenes por ${price.toLocaleString("es")} de oro. Volvés a ser ciudadano. (La próxima fianza costará ${bailPrice(s.bailsPaid).toLocaleString("es")}.)`, "global", 214);
            sendInventoryUpdate(s);
            // Dejar de ser criminal puede sacarlo de un clan de criminales.
            void enforceGuildFaction(s);
          }
        } else if (s.hp < s.maxHp) {
          s.hp = s.maxHp;
          consoleMsg(s, "El sacerdote te ha curado.", "global", 214); // SND_CURAR
        }
        sendStatsUpdate(s);
        return;
      }

      // NPC de misiones (Quests.DAT): ofrecer / mostrar progreso / entregar.
      if (npc.type.questNumber > 0 && chebyshev(s.position, npc.position) <= 5) {
        handleQuestNpc(s, npc.type.questNumber);
        return;
      }

      // Enlistador de facción (Tancredo → Armada, Demonio → Legión). El
      // enlistamiento y el ascenso se hacen con /enlistar y /recompensa cerca
      // del NPC; al clickearlo solo mostramos el estado / instrucción.
      const enlistFaction = ENLISTER_FACTION[npc.type.number];
      if (enlistFaction !== undefined && chebyshev(s.position, npc.position) <= 5) {
        if (s.faction === enlistFaction) {
          consoleMsg(s, `${FACTION_NAMES[s.faction]!}: sos ${factionRankName(s.faction, s.factionRank)} · ${s.factionPoints.toString()} puntos. Escribí /recompensa para ascender.`, "global");
        } else if (s.faction === FACTION_NONE) {
          consoleMsg(s, `Para unirte a la ${FACTION_NAMES[enlistFaction]!} escribí /enlistar (necesitás nivel y puntos de facción).`, "global");
        } else {
          consoleMsg(s, "Ya perteneces a la facción rival. No podés enlistarte acá.", "global");
        }
        return;
      }

      const dx = Math.abs(npc.position.x - s.position.x);
      const dy = Math.abs(npc.position.y - s.position.y);
      if (Math.max(dx, dy) > 3) return;

      if (npc.type.merchant) {
        // Oferta EFECTIVA (relee getNpcType para reflejar ediciones del panel
        // admin sin reiniciar el server; el typeCache se limpió al editar).
        const shopOffers = getNpcType(npc.type.number)?.shopOffers ?? npc.type.shopOffers;
        // Precio fijo por el valor base del item (el skill Comerciar ya no
        // afecta los precios — decisión de diseño).
        const offers = shopOffers.map((it) => {
          const def = getItem(it);
          return { item: it, price: Math.max(1, def ? def.value : 0) };
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
      // El item debe estar en la oferta de ALGÚN comerciante cercano — sin
      // esto se podía comprar cualquier item del juego a su valor base.
      let offered = false;
      for (const n of npcs.inMap(s.mapId)) {
        if (!n.type.merchant) continue;
        if (Math.max(Math.abs(n.position.x - s.position.x), Math.abs(n.position.y - s.position.y)) > 3) continue;
        const offers = getNpcType(n.type.number)?.shopOffers ?? n.type.shopOffers;
        if (offers.includes(pkt.item)) { offered = true; break; }
      }
      if (!offered) return;
      // Cantidad: 1..10.000 (tope de apilado del AO). addItem reparte en slots.
      const qty = Math.max(1, Math.min(Math.floor(pkt.qty) || 1, 10_000));
      // Mismo precio que mostró la tienda: valor base (Comerciar no afecta precios).
      const unit = Math.max(1, def.value);
      // Cuántas puede pagar realmente con el oro EN MANO (el del banco no cuenta)
      // y cuántas le ENTRAN (tope de stack 10k + tope de 24 slots).
      const space = carryCapacity(s.inventory, def.id);
      if (space === 0) {
        consoleMsg(s, "No tienes espacio en el inventario.", "combate");
        return;
      }
      const affordable = Math.min(qty, Math.floor(s.gold / unit), space);
      if (affordable <= 0) {
        consoleMsg(s, "No tienes suficiente oro.", "combate");
        return;
      }
      s.gold -= unit * affordable;
      s.inventory = addItem(s.inventory, def.id, affordable);
      // Si no le alcanzó para todo lo pedido, avisar (evita el "me vendió pocas
      // y no sé por qué"). El oro puede estar en el banco.
      if (affordable < qty) {
        consoleMsg(s, `Compraste ${affordable.toString()} — no te alcanzó el oro para las ${qty.toString()} pedidas.`, "combate");
      }
      trainSkill(s, "comerciar", true);
      sendInventoryUpdate(s);
    }

    function handleShopSell(s: Session, pkt: ShopSellRequest): void {
      const def = getItem(pkt.item);
      if (!def || !nearMerchant(s)) return;
      // Cuántas tiene realmente en el inventario (clamp de la cantidad pedida).
      const have = s.inventory.reduce((n, sl) => (sl?.item === def.id ? n + sl.qty : n), 0);
      const qty = Math.max(1, Math.min(Math.floor(pkt.qty) || 1, have));
      if (have <= 0) return;
      const removed = removeItem(s.inventory, def.id, qty);
      if (!removed) return;
      s.inventory = removed;
      // Precio de venta del AO original: un tercio del valor, por unidad.
      addGold(s, Math.floor(def.value / 3) * qty);
      trainSkill(s, "comerciar", true);
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
      // Recomputar equipo: depositar el arma/armadura equipada dejaba el
      // bonus "fantasma" (equippedWeapon stale) hasta el próximo update.
      sendInventoryUpdate(s);
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

      // Máximo 5 miembros como el AO original.
      if (party.members.size >= 5) {
        consoleMsg(s, "La party está completa (máximo 5 miembros).", "global");
        if (inviterSession) consoleMsg(inviterSession, "Tu party está completa (máximo 5).", "global");
        return;
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
      if (s.deadUntil !== 0) return; // los fantasmas no comercian
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
      if (s.deadUntil !== 0) return;
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
      // sanQty: entero positivo o 0. Sin esto, una qty negativa/NaN pasaba los
      // `<` y en el confirm creaba items de la nada (removeItem con negativo
      // AUMENTA el stack del oferente y resta al receptor).
      const qty = sanQty(pkt.qty);
      if (qty === 0) return;
      if (countItem(s.inventory, pkt.item) < qty) return;

      const existing = offer.items.find((sl) => sl.item === pkt.item);
      if (existing) {
        const newQty = existing.qty + qty;
        if (countItem(s.inventory, pkt.item) < newQty) return;
        offer.items = offer.items.map((sl) =>
          sl.item === pkt.item ? { item: sl.item, qty: newQty } : sl,
        );
      } else {
        offer.items = [...offer.items, { item: pkt.item, qty }];
      }

      sendTradeUpdateForTrade(trade.id);
    }

    function handleTradeSetGold(s: Session, pkt: TradeSetGoldMsg): void {
      if (s.deadUntil !== 0) return;
      if (!s.tradeId) return;
      const trade = tradeRegistry.getByCharacter(s.characterId);
      if (!trade) return;
      // Entero >= 0 (NaN/decimal/negativo → inválido). NaN evadía ambos checks
      // y dejaba el oro de las dos partes en NaN al confirmar.
      const amount =
        typeof pkt.amount === "number" && Number.isFinite(pkt.amount)
          ? Math.max(0, Math.floor(pkt.amount))
          : -1;
      if (amount < 0 || amount > s.gold) return;

      const isA = s.characterId === trade.playerA;
      const offer = isA ? trade.offerA : trade.offerB;
      trade.offerA.confirmed = false;
      trade.offerB.confirmed = false;
      offer.gold = amount;
      sendTradeUpdateForTrade(trade.id);
    }

    function handleTradeConfirm(s: Session): void {
      if (s.deadUntil !== 0) return;
      if (!s.tradeId) return;
      const trade = tradeRegistry.getByCharacter(s.characterId);
      if (!trade) return;
      // Re-chequeo de cercanía al confirmar: ambos vivos, mismo mapa y a
      // distancia razonable (evita el "trade a distancia" tras alejarse).
      const other = sessions.getByCharacterId(
        s.characterId === trade.playerA ? trade.playerB : trade.playerA,
      );
      if (!other || other.deadUntil !== 0 || other.mapId !== s.mapId) return;
      if (chebyshev(s.position, other.position) > 10) return;

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

      // Aplicamos todas las remociones sobre COPIAS y solo comprometemos si
      // TODAS tienen éxito. Nunca hacer `removeItem(...) ?? inv`: si una
      // remoción fallara, el dueño conservaría el item y el otro igual lo
      // recibiría (duplicación). Ante cualquier fallo, se cancela sin transferir.
      let invA = sA.inventory;
      let invB = sB.inventory;
      for (const slot of trade.offerA.items) {
        const removed = removeItem(invA, slot.item, slot.qty);
        if (!removed) { cancelTrade(trade.id, "OFFER_INVALID"); return; }
        // El receptor tiene que tener espacio (stack 10k / 24 slots): addItem
        // clampea y el excedente se ESFUMARÍA — mejor cancelar.
        if (carryCapacity(invB, slot.item) < slot.qty) { cancelTrade(trade.id, "OFFER_INVALID"); return; }
        invA = removed;
        invB = addItem(invB, slot.item, slot.qty);
      }
      for (const slot of trade.offerB.items) {
        const removed = removeItem(invB, slot.item, slot.qty);
        if (!removed) { cancelTrade(trade.id, "OFFER_INVALID"); return; }
        if (carryCapacity(invA, slot.item) < slot.qty) { cancelTrade(trade.id, "OFFER_INVALID"); return; }
        invB = removed;
        invA = addItem(invA, slot.item, slot.qty);
      }
      sA.inventory = invA;
      sB.inventory = invB;
      sA.gold -= trade.offerA.gold;
      addGold(sB, trade.offerA.gold);
      sB.gold -= trade.offerB.gold;
      addGold(sA, trade.offerB.gold);

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

    // Lanzar un hechizo del libro (Hechizos.dat real) sobre un jugador o NPC.
    const SPELL_RANGE = 10;

    // Bonus de daño/curación del AO: +3% por nivel del lanzador
    // (modHechizos.bas L1922: dano += Porcentaje(dano, 3*ELV)).
    function spellRoll(spell: { minHp: number; maxHp: number }, casterLevel: number): number {
      let v = spell.minHp + Math.floor(Math.random() * (spell.maxHp - spell.minHp + 1));
      v += Math.trunc((v * 3 * casterLevel) / 100);
      return v;
    }

    // Multiplicador de báculo (modHechizos.bas): solo el Mago con hechizo
    // StaffAffected. Con báculo: ×(StaffDamageBonus+70)/100. Sin báculo: ×0.7.
    function staffMult(s: Session, spell: { staffAffected?: boolean }): number {
      if (!spell.staffAffected || s.classId !== 2) return 1;
      if (s.equippedWeapon !== null) {
        const w = getItem(s.equippedWeapon);
        if (w?.staffDamageBonus) return (w.staffDamageBonus + 70) / 100;
      }
      return 0.7; // mago sin báculo
    }

    // Defensa mágica del objetivo (casco antimagia): resta RandomNumber(min,max).
    function magicDefenseOf(target: Session): number {
      if (target.equippedHelmet === null) return 0;
      const h = getItem(target.equippedHelmet);
      if (!h?.magicDefMax) return 0;
      const lo = h.magicDefMin ?? 0;
      return lo + Math.floor(Math.random() * (h.magicDefMax - lo + 1));
    }

    // Daño mágico completo del AO: (roll + 3%/nivel) × báculo − defensa mágica.
    function spellDamage(s: Session, spell: { minHp: number; maxHp: number; staffAffected?: boolean }, target: Session | null): number {
      const base = Math.trunc(spellRoll(spell, s.level) * staffMult(s, spell));
      const magDef = target ? magicDefenseOf(target) : 0;
      return Math.max(0, base - magDef);
    }

    function handleCastSpell(s: Session, pkt: CastSpellRequest): void {
      if (s.deadUntil !== 0) return;
      const spell = getAoSpell(pkt.spellId);
      if (!spell) return;
      // Solo se puede lanzar un hechizo aprendido (pergamino usado), no derivado
      // del nivel.
      if (!s.knownSpells.includes(pkt.spellId)) return;

      const now = Date.now();
      // IntervaloLanzaHechizo (1400ms) + castear tras golpear (GolpeMagia).
      if (now - s.lastCastAt < INTERVALS.spell) return;
      if (now - s.lastAttackAt < INTERVALS.golpeMagia) return;
      // Con AVISO (como el AO): fallar en silencio hacía creer que el juego
      // se rompía ("tengo maná y no lanza" — era la ENERGÍA agotada).
      if (s.mana < spell.manaCost) {
        consoleMsg(s, "No tienes suficiente maná.", "combate");
        return;
      }
      // La energía NO limita ni se consume al lanzar hechizos (decisión de diseño:
      // que no moleste). Solo el maná y los intervalos gatean el casteo.

      const targetId = pkt.targetId as unknown as number;
      stopMeditating(s);

      // Resolver objetivo: NPC o jugador, en el mismo mapa y en rango.
      if (isNpcId(targetId)) {
        // Target=1 es "solo usuarios" — no aplica a NPCs.
        if (spell.target === 1) return;
        const npc = npcs.get(targetId);
        if (!npc || npc.mapId !== s.mapId || npc.deadUntil !== 0) return;
        if (!npc.type.attackable || npc.type.merchant || npc.type.banker) return;
        if (chebyshev(s.position, npc.position) > SPELL_RANGE) {
          consoleMsg(s, "Estás muy lejos para lanzar ese hechizo.", "combate");
          return;
        }

        // Validar el EFECTO antes de cobrar: clickear una criatura con una
        // cura/buff (target "ambos") quemaba maná + cooldown en silencio.
        const hasNpcEffect = spell.subeHp === 2 || spell.paraliza || spell.inmoviliza || spell.envenena;
        if (!hasNpcEffect) return;

        s.lastCastAt = now;
        s.mana -= spell.manaCost;
        trainSkill(s, "magia", true);
        breakInvisibility(s);

        if (spell.subeHp === 2) {
          // Daño mágico (roll + 3%/nivel + báculo). El NPC no tiene defM en
          // nuestro catálogo — usamos la defensa física como proxy.
          const amount = spellDamage(s, spell, null);
          damageNpc(s, npc, Math.max(1, amount - npc.type.defense), now, false, undefined, true);
        } else if (spell.paraliza || spell.inmoviliza) {
          // Paralizar/Inmovilizar criaturas: el control clásico del mago.
          npc.paralyzedUntil = now + (spell.paraliza ? PARALYSIS_MS : IMMOBILIZE_MS);
          broadcastEffect(s.mapId, npc.id, "paralyzed", true, spell.paraliza ? PARALYSIS_MS : IMMOBILIZE_MS);
        } else {
          // Envenenar: sin sistema de veneno para NPCs todavía — daño directo.
          damageNpc(s, npc, 5, now, false, undefined, true);
        }

        const fx: SkillEffect = {
          op: ServerToClientOp.SkillEffect,
          skillId: pkt.spellId,
          casterId: s.characterId as EntityId,
          targetId: npc.id as EntityId,
          newCasterMana: s.mana,
        };
        broadcastToMap(s.mapId, fx);
        sendStatsUpdate(s);
        return;
      }

      // Objetivo jugador (incluido uno mismo para curas/buffs).
      if (spell.target === 2) return; // "solo NPCs"
      const target = sessions.getByCharacterId(targetId);
      if (!target || target.mapId !== s.mapId) return;
      // Los muertos solo son objetivo válido de Resucitar.
      if (target.deadUntil !== 0 && !spell.revivir) return;
      if (chebyshev(s.position, target.position) > SPELL_RANGE) {
        consoleMsg(s, "Estás muy lejos para lanzar ese hechizo.", "combate");
        return;
      }

      let amount: number | undefined;
      if (spell.revivir) {
        // Resucitar (Clérigo): revive a un jugador muerto con la vida completa.
        // Antes NO tenía rama: el hechizo insignia no hacía nada jamás.
        if (target.deadUntil === 0) return; // sobre vivos no hace nada
        revivePlayer(target);
        sendInventoryUpdate(target);
        sendStatsUpdate(target);
        consoleMsg(target, `¡${s.characterName} te ha resucitado!`, "global");
        consoleMsg(s, `Has resucitado a ${target.characterName}.`, "global");
      } else if (spell.subeHp === 1) {
        // Cura con +3%/nivel del lanzador.
        amount = spellRoll(spell, s.level);
        target.hp = Math.min(target.maxHp, target.hp + amount);
      } else if (spell.subeHp === 2) {
        // Daño PvP: respeta zonas seguras y party.
        if (target.characterId === s.characterId) return;
        if (s.partyId !== null && s.partyId === target.partyId) return;
        if (!canAttackPlayer(s.mapId, target.mapId)) return;
        // Daño PvP con báculo y defensa mágica del casco del objetivo.
        amount = spellDamage(s, spell, target);
        target.hp = Math.max(0, target.hp - amount);
      cancelExitCountdown(target); // recibir daño PvP cancela la salida
        stopMeditating(target);
      } else if ((spell.agiBoostMax ?? spell.agiBoost ?? 0) > 0 || (spell.strBoostMax ?? spell.strBoost ?? 0) > 0) {
        // Celeridad / Fuerza sobre un aliado (o uno mismo): +RandomNumber(Min,Max).
        // ACUMULATIVO como las pociones: cada casteo SUMA el roll al bonus ya
        // existente, no re-tira de cero. Mismo house rule que las pociones: el
        // buff (bonus) topa en +21 sobre el atributo base.
        const rint = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (Math.max(lo, hi) - lo + 1));
        const BUFF_MAX = 21;
        const agiMax = spell.agiBoostMax ?? spell.agiBoost ?? 0;
        const strMax = spell.strBoostMax ?? spell.strBoost ?? 0;
        if (agiMax > 0) {
          const roll = rint(spell.agiBoostMin ?? spell.agiBoost ?? agiMax, agiMax);
          target.agiBonus = Math.min(target.agiBonus + roll, BUFF_MAX);
        }
        if (strMax > 0) {
          const roll = rint(spell.strBoostMin ?? spell.strBoost ?? strMax, strMax);
          target.strBonus = Math.min(target.strBonus + roll, BUFF_MAX);
        }
        // House rule: duración 100s, igual que las pociones verde/amarilla (no
        // los ~48s de spell.buffSeconds del AO), para que poción y hechizo duren lo mismo.
        target.buffUntil = Date.now() + 100 * 1000;
      } else if (spell.paraliza || spell.inmoviliza) {
        // Control PvP: respeta zonas seguras y party.
        if (target.characterId === s.characterId) return;
        if (s.partyId !== null && s.partyId === target.partyId) return;
        if (!canAttackPlayer(s.mapId, target.mapId)) return;
        const dur = spell.paraliza ? PARALYSIS_MS : IMMOBILIZE_MS;
        if (spell.paraliza) target.paralyzedUntil = now + dur;
        else target.immobilizedUntil = now + dur;
        stopMeditating(target);
        broadcastEffect(s.mapId, target.characterId, spell.paraliza ? "paralyzed" : "immobilized", true, dur);
      } else if (spell.removerParalisis) {
        // Devolver Movilidad: limpia parálisis e inmovilización (aliado o uno mismo).
        if (target.paralyzedUntil > now || target.immobilizedUntil > now) {
          target.paralyzedUntil = 0;
          target.immobilizedUntil = 0;
          broadcastEffect(s.mapId, target.characterId, "paralyzed", false);
          broadcastEffect(s.mapId, target.characterId, "immobilized", false);
        }
      } else if (spell.invisibilidad) {
        // Invisibilidad: desaparece para los demás; se rompe al atacar/castear.
        target.invisibleUntil = now + INVISIBILITY_MS;
        broadcastEffect(s.mapId, target.characterId, "invisible", true, INVISIBILITY_MS);
      } else if (spell.ceguera || spell.estupidez) {
        if (target.characterId === s.characterId) return;
        if (s.partyId !== null && s.partyId === target.partyId) return;
        if (!canAttackPlayer(s.mapId, target.mapId)) return;
        if (spell.ceguera) {
          target.blindUntil = now + BLINDNESS_MS;
          const pkt: EntityEffect = {
            op: ServerToClientOp.EntityEffect,
            id: target.characterId as EntityId,
            effect: "blind",
            active: true,
            durationMs: BLINDNESS_MS,
          };
          send(target.socket, pkt);
        } else {
          target.dumbUntil = now + DUMB_MS;
          const pkt: EntityEffect = {
            op: ServerToClientOp.EntityEffect,
            id: target.characterId as EntityId,
            effect: "dumb",
            active: true,
            durationMs: DUMB_MS,
          };
          send(target.socket, pkt);
        }
      } else if (spell.envenena) {
        if (target.characterId === s.characterId) return;
        if (s.partyId !== null && s.partyId === target.partyId) return;
        if (!canAttackPlayer(s.mapId, target.mapId)) return;
        // Veneno del AO: 1-5 por tick, hasta curarse (Antídoto/Poción Violeta).
        const existing = activeDots.get(target.characterId) ?? [];
        if (!existing.some((d) => d.poison)) {
          existing.push({ damage: 3, ticksLeft: 1, casterId: s.characterId, poison: true });
          activeDots.set(target.characterId, existing);
        }
      } else if (spell.curaVeneno) {
        // Solo quita el VENENO (como la Poción Violeta) — no otros DoTs.
        const dots = activeDots.get(target.characterId);
        if (dots) activeDots.set(target.characterId, dots.filter((d) => !d.poison));
      } else {
        return; // efecto no implementado todavía (paralizar, invisibilidad...)
      }

      s.lastCastAt = now;
      s.mana -= spell.manaCost;
      trainSkill(s, "magia", true);
      // Castear rompe la invisibilidad propia — salvo que el hechizo sea
      // la propia invisibilidad sobre uno mismo.
      if (!(spell.invisibilidad && target.characterId === s.characterId)) {
        breakInvisibility(s);
      }

      const fx: SkillEffect = {
        op: ServerToClientOp.SkillEffect,
        skillId: pkt.spellId,
        casterId: s.characterId as EntityId,
        targetId: target.characterId as EntityId,
        amount,
        newCasterMana: s.mana,
        newTargetHp: target.hp,
        newTargetMaxHp: target.maxHp,
        dotApplied: spell.envenena === true,
      };
      broadcastToMap(s.mapId, fx);
      sendStatsUpdate(s);
      if (target.characterId !== s.characterId) sendStatsUpdate(target);
      syncPartyStats(target);

      if (target.hp === 0) {
        resolvePlayerDeath(target, s);
      }
    }

    function consoleMsg(s: Session, text: string, kind: ConsoleMsg["kind"], wav?: number): void {
      const pkt: ConsoleMsg = {
        op: ServerToClientOp.ConsoleMsg,
        text,
        kind,
        ...(wav !== undefined ? { wav } : {}),
      };
      send(s.socket, pkt);
    }

    // ── Trabajos (Trabajo.bas) ───────────────────────────────────────────────

    function handleWork(s: Session, pkt: WorkRequest): void {
      if (s.deadUntil !== 0) return;
      const now = Date.now();
      if (now - s.lastWorkAt < WORK_INTERVAL_MS) return;
      if (countItem(s.inventory, pkt.item) === 0) return;
      const kind = toolKind(pkt.item);
      if (!kind) return;
      const map = getMap(s.mapId);
      if (!map) return;
      if (chebyshev(s.position, { x: pkt.x, y: pkt.y }) > 2) return;
      if (s.sta < 6) {
        consoleMsg(s, "Estás muy cansado para trabajar.", "global");
        return;
      }

      s.lastWorkAt = now;
      s.resting = false;
      stopMeditating(s);
      const idx = pkt.y * map.width + pkt.x;
      const obj = map.objects.get(idx);
      const objDef = obj ? getItem(obj.item) : undefined;

      if (kind === "talar") {
        const isElfico = objDef?.objType === OBJTYPE.arbolElfico;
        if (objDef?.objType !== OBJTYPE.arbol && !isElfico) {
          consoleMsg(s, "No hay ningún árbol ahí.", "global");
          return;
        }
        s.sta = Math.max(0, s.sta - 6);
        const ok = rollWorkSuccess(s.skills.talar);
        trainSkill(s, "talar", ok);
        if (ok) {
          s.inventory = addItem(s.inventory, isElfico ? PRODUCTS.lenaElfica : PRODUCTS.lena, 1);
          consoleMsg(s, "¡Has conseguido algo de leña!", "global", WORK_WAV.talar);
          sendInventoryUpdate(s);
        } else {
          consoleMsg(s, "No has obtenido leña.", "global", WORK_WAV.talar);
        }
        sendStatsUpdate(s);
        return;
      }

      if (kind === "minar") {
        if (objDef?.objType !== OBJTYPE.yacimiento) {
          consoleMsg(s, "Ahí no hay ningún yacimiento.", "global");
          return;
        }
        s.sta = Math.max(0, s.sta - 6);
        const ok = rollWorkSuccess(s.skills.mineria);
        trainSkill(s, "mineria", ok);
        if (ok) {
          const mineral = objDef.mineralIndex ?? PRODUCTS.hierroCrudo;
          s.inventory = addItem(s.inventory, mineral, 1);
          consoleMsg(s, "¡Has extraído algunos minerales!", "global", WORK_WAV.minar);
          sendInventoryUpdate(s);
        } else {
          consoleMsg(s, "No has conseguido nada.", "global", WORK_WAV.minar);
        }
        sendStatsUpdate(s);
        return;
      }

      // Pescar: el tile objetivo debe ser agua.
      const g = map.graphic[idx] ?? 0;
      if (!isWaterGraphic(g)) {
        consoleMsg(s, "No hay agua donde pescar ahí.", "global");
        return;
      }
      s.sta = Math.max(0, s.sta - 3);
      const ok = rollWorkSuccess(s.skills.pesca);
      trainSkill(s, "pesca", ok);
      if (ok) {
        s.inventory = addItem(s.inventory, PRODUCTS.pescado, 1);
        consoleMsg(s, "¡Has pescado un lindo pez!", "global", WORK_WAV.pescar);
        sendInventoryUpdate(s);
      } else {
        consoleMsg(s, "No has pescado nada.", "global", WORK_WAV.pescar);
      }
      sendStatsUpdate(s);
    }

    function handleCraft(s: Session, pkt: CraftRequest): void {
      if (s.deadUntil !== 0) return;
      const def = getItem(pkt.item);
      if (!def) return;
      const now = Date.now();
      if (now - s.lastWorkAt < WORK_INTERVAL_MS) return;
      const map = getMap(s.mapId);
      if (!map) return;
      s.lastWorkAt = now;

      // Fundición: lingotes junto a una fragua, 5 minerales → 1 lingote.
      const rawMineral = SMELT_MAP[pkt.item];
      if (rawMineral !== undefined) {
        if (!objTypeNear(map.objects, map.width, s.position.x, s.position.y, OBJTYPE.fragua, 3)) {
          consoleMsg(s, "Necesitás estar junto a una fragua para fundir.", "global");
          return;
        }
        const removed = removeItem(s.inventory, rawMineral, MINERALS_PER_INGOT);
        if (!removed) {
          consoleMsg(s, `Necesitás ${MINERALS_PER_INGOT.toString()} minerales para fundir un lingote.`, "global");
          return;
        }
        s.inventory = addItem(removed, pkt.item, 1);
        trainSkill(s, "mineria", true);
        consoleMsg(s, "¡Has fundido un lingote!", "global", WORK_WAV.herreria);
        sendInventoryUpdate(s);
        return;
      }

      // Herrería: junto al yunque, con martillo, lingotes y skill suficiente.
      if ((def.skHerreria ?? 0) > 0) {
        const hasHammer = TOOLS.martillos.some((t) => countItem(s.inventory, t) > 0);
        if (!hasHammer) {
          consoleMsg(s, "Necesitás un martillo de herrero.", "global");
          return;
        }
        if (!objTypeNear(map.objects, map.width, s.position.x, s.position.y, OBJTYPE.yunque, 3)) {
          consoleMsg(s, "Necesitás estar junto a un yunque.", "global");
          return;
        }
        if (s.skills.herreria < (def.skHerreria ?? 0)) {
          consoleMsg(s, `Necesitás ${(def.skHerreria ?? 0).toString()} de herrería para construir eso.`, "global");
          return;
        }
        const costs: Array<[number, number]> = [
          [PRODUCTS.lingoteHierro, def.lingH ?? 0],
          [PRODUCTS.lingotePlata, def.lingP ?? 0],
          [PRODUCTS.lingoteOro, def.lingO ?? 0],
        ];
        for (const [ingot, qty] of costs) {
          if (qty > 0 && countItem(s.inventory, ingot) < qty) {
            consoleMsg(s, "No tenés los lingotes necesarios.", "global");
            return;
          }
        }
        let inv = s.inventory;
        for (const [ingot, qty] of costs) {
          if (qty > 0) inv = removeItem(inv, ingot, qty) ?? inv;
        }
        s.inventory = addItem(inv, pkt.item, 1);
        trainSkill(s, "herreria", true);
        consoleMsg(s, `¡Has construido ${def.name}!`, "global", WORK_WAV.herreria);
        sendInventoryUpdate(s);
        return;
      }

      // Carpintería: con serrucho y madera (leña).
      if ((def.madera ?? 0) > 0) {
        const hasSaw = TOOLS.serruchos.some((t) => countItem(s.inventory, t) > 0);
        if (!hasSaw) {
          consoleMsg(s, "Necesitás un serrucho de carpintero.", "global");
          return;
        }
        if (s.skills.carpinteria < (def.skCarpinteria ?? 0)) {
          consoleMsg(s, `Necesitás ${(def.skCarpinteria ?? 0).toString()} de carpintería para eso.`, "global");
          return;
        }
        const removed = removeItem(s.inventory, PRODUCTS.lena, def.madera ?? 0);
        if (!removed) {
          consoleMsg(s, `Necesitás ${(def.madera ?? 0).toString()} de leña.`, "global");
          return;
        }
        s.inventory = addItem(removed, pkt.item, 1);
        trainSkill(s, "carpinteria", true);
        consoleMsg(s, `¡Has construido ${def.name}!`, "global", WORK_WAV.carpinteria);
        sendInventoryUpdate(s);
      }
    }

    // ── Misiones (Quests.DAT) ────────────────────────────────────────────────

    const MAX_ACTIVE_QUESTS = 15; // MAXUSERQUESTS del AO

    function sendQuestState(s: Session): void {
      const pkt: QuestState = {
        op: ServerToClientOp.QuestState,
        active: s.quests.map((aq) => ({ id: aq.id, kills: aq.kills })),
        done: s.questsDone,
      };
      send(s.socket, pkt);
    }

    // ¿Cumplió todos los requisitos de la quest activa?
    function questComplete(s: Session, aq: { id: number; kills: number[] }): boolean {
      const def = QUESTS[aq.id];
      if (!def) return false;
      for (let i = 0; i < def.npcs.length; i += 1) {
        if ((aq.kills[i] ?? 0) < def.npcs[i]!.amount) return false;
      }
      for (const req of def.objs) {
        if (countItem(s.inventory, req.item) < req.amount) return false;
      }
      return true;
    }

    function handleQuestNpc(s: Session, questNumber: number): void {
      const def = QUESTS[questNumber];
      if (!def) return;
      if (s.questsDone.includes(questNumber)) {
        consoleMsg(s, `${def.nombre}: ya me ayudaste con esto. ¡Gracias, aventurero!`, "global");
        return;
      }
      const active = s.quests.find((aq) => aq.id === questNumber);
      if (!active) {
        // Ofrecer la misión (el cliente muestra el diálogo).
        const offer: QuestOffer = { op: ServerToClientOp.QuestOffer, questId: questNumber };
        send(s.socket, offer);
        return;
      }
      if (!questComplete(s, active)) {
        const progress = def.npcs
          .map((req, i) => `${(active.kills[i] ?? 0).toString()}/${req.amount.toString()}`)
          .join(", ");
        consoleMsg(s, `${def.nombre}: todavía te falta (${progress}${def.objs.length > 0 ? " + objetos" : ""}).`, "global");
        return;
      }
      // Entregar: quitar objetos requeridos, dar recompensas.
      let inv = s.inventory;
      for (const req of def.objs) {
        inv = removeItem(inv, req.item, req.amount) ?? inv;
      }
      for (const rew of def.rewardObjs) {
        inv = addItem(inv, rew.item, rew.amount);
      }
      s.inventory = inv;
      addGold(s, def.rewardGld);
      s.quests = s.quests.filter((aq) => aq.id !== questNumber);
      s.questsDone.push(questNumber);

      if (def.rewardExp > 0) {
        const prevLevel = s.level;
        const gain = applyXpGain(s.level, s.xp, def.rewardExp);
        s.xp = gain.totalXp;
        if (gain.leveledUp) {
          s.level = gain.level;
          // Skills suben con el nivel (100 al nivel 34).
          s.skills = skillsForLevel(s.level);
          // AO Libre: los atributos son fijos; no se otorgan puntos de atributo por nivel.
          const classDef = getClass(s.classId);
          if (classDef) s.maxSta = calcMaxSta(classDef, s.level);
          if (classDef) s.maxMana = calcMaxMp(classDef, s.level, s.int_);
          recomputeMaxHp(s);
          s.hp = s.maxHp;
          s.mana = s.maxMana;
          sendSpellsKnown(s);
          if (prevLevel <= NEWBIE_MAX_LEVEL && s.level > NEWBIE_MAX_LEVEL) graduateNewbie(s);
        }
      }
      consoleMsg(s, `¡Misión completada: ${def.nombre}! Recompensa: ${def.rewardGld.toString()} de oro y ${def.rewardExp.toString()} de experiencia.`, "global", 6);
      sendQuestState(s);
      sendStatsUpdate(s);
      sendInventoryUpdate(s);
    }

    function handleQuestAccept(s: Session, pkt: QuestAcceptRequest): void {
      const def = QUESTS[pkt.questId];
      if (!def) return;
      if (s.questsDone.includes(pkt.questId)) return;
      if (s.quests.some((aq) => aq.id === pkt.questId)) return;
      if (s.quests.length >= MAX_ACTIVE_QUESTS) {
        consoleMsg(s, "No podés aceptar más misiones (máximo 15).", "global");
        return;
      }
      if (s.level < def.requiredLevel) {
        consoleMsg(s, `Necesitás nivel ${def.requiredLevel.toString()} para esa misión.`, "global");
        return;
      }
      s.quests.push({ id: pkt.questId, kills: def.npcs.map(() => 0) });
      consoleMsg(s, `Misión aceptada: ${def.nombre}.`, "global");
      sendQuestState(s);
    }

    function handleQuestAbandon(s: Session, pkt: QuestAbandonRequest): void {
      const before = s.quests.length;
      s.quests = s.quests.filter((aq) => aq.id !== pkt.questId);
      if (s.quests.length !== before) {
        consoleMsg(s, "Misión abandonada.", "global");
        sendQuestState(s);
      }
    }

    // Al matar un NPC: avanzar los contadores de las misiones activas.
    function questKillProgress(s: Session, npcNumber: number): void {
      let changed = false;
      for (const aq of s.quests) {
        const def = QUESTS[aq.id];
        if (!def) continue;
        for (let i = 0; i < def.npcs.length; i += 1) {
          const req = def.npcs[i]!;
          if (req.npc === npcNumber && (aq.kills[i] ?? 0) < req.amount) {
            aq.kills[i] = (aq.kills[i] ?? 0) + 1;
            changed = true;
            consoleMsg(s, `${def.nombre}: ${aq.kills[i]!.toString()}/${req.amount.toString()}.`, "global");
          }
        }
      }
      if (changed) sendQuestState(s);
    }

    // ── Descansar (fogata) y seguro /SEG ────────────────────────────────────

    function fogataNear(s: Session): boolean {
      const map = getMap(s.mapId);
      if (!map) return false;
      if (objTypeNear(map.objects, map.width, s.position.x, s.position.y, OBJTYPE.fogata, 3)) return true;
      for (const g of groundItems.inMap(s.mapId)) {
        if (getItem(g.item)?.objType === OBJTYPE.fogata &&
            chebyshev(s.position, g.position) <= 3) return true;
      }
      return false;
    }

    function handleRest(s: Session): void {
      if (s.deadUntil !== 0) return;
      if (!s.resting && !fogataNear(s)) {
        consoleMsg(s, "Necesitás estar junto a una fogata para descansar.", "global");
        return;
      }
      s.resting = !s.resting;
      consoleMsg(s, s.resting ? "Comenzás a descansar junto al fuego." : "Dejás de descansar.", "global");
    }

    function handleSafeToggle(s: Session): void {
      s.safeOn = !s.safeOn;
      consoleMsg(s, s.safeOn ? "Seguro ACTIVADO — no atacarás ciudadanos." : "Seguro DESACTIVADO — cuidado, podés volverte criminal.", "global");
    }

    // /hogar del AO (goHome): solo muerto; tras el tiempo de viaje aparece
    // en el spawn de su ciudad (Ullathorpe). El sacerdote de la ciudad —
    // o la llegada misma — lo revive.
    function handleGoHome(s: Session): void {
      if (s.deadUntil === 0) return; // "Debes estar muerto..."
      if (s.homeTravelUntil > 0) return; // ya viajando
      // Viaje al hogar: 3s (ágil). Se puede cancelar para esperar a que otro
      // personaje/sacerdote te reviva donde estás.
      s.homeTravelUntil = Date.now() + HOME_TRAVEL_MS;
    }

    // Cancelar el viaje al hogar en curso (seguís muerto donde estás).
    function handleCancelGoHome(s: Session): void {
      if (s.homeTravelUntil > 0) s.homeTravelUntil = 0;
    }

    function handleMeditate(s: Session): void {
      if (s.deadUntil !== 0) return;
      if (s.maxMana <= 0) return; // clases sin maná no meditan
      s.meditating = !s.meditating;
      const pkt: MeditateUpdate = {
        op: ServerToClientOp.MeditateUpdate,
        id: s.characterId as EntityId,
        meditating: s.meditating,
      };
      broadcastToMap(s.mapId, pkt);
    }

    function handleUseSkill(s: Session, pkt: UseSkillRequest): void {
      if (s.deadUntil !== 0) return;
      const def = getSkill(pkt.skillId);
      if (!def) return;
      // Solo la skill de TU clase (antes cualquier clase usaba cualquier skill).
      if (def.classId !== s.classId) return;
      stopMeditating(s);
      const targetId = pkt.targetId as unknown as number | undefined;
      const target = targetId ? (sessions.getByCharacterId(targetId) ?? null) : null;
      const hostile = def.type === "damage" || def.type === "dot";
      if (target) {
        // Mismo mapa SIEMPRE (el rango comparaba coords crudas cross-mapa) y
        // nunca sobre muertos.
        if (target.mapId !== s.mapId || target.deadUntil !== 0) return;
        if (hostile) {
          // Reglas PvP completas: ni a vos mismo, ni a tu party, ni en zona segura.
          if (target === s) return;
          if (s.partyId !== null && s.partyId === target.partyId) return;
          if (!canAttackPlayer(s.mapId, target.mapId)) return;
        }
      }
      const result = executeSkill(s, target, pkt.skillId);
      if (!result.ok) return;

      const effect: SkillEffect = {
        op: ServerToClientOp.SkillEffect,
        skillId: pkt.skillId,
        casterId: s.characterId as EntityId,
        targetId: target ? (target.characterId as EntityId) : undefined,
        amount: result.amount,
        newCasterMana: result.newCasterMana,
        newTargetHp: result.newTargetHp,
        newTargetMaxHp: result.newTargetMaxHp,
        dotApplied: result.dotApplied,
      };
      broadcastToMap(s.mapId, effect);
      sendStatsUpdate(s);
      // El objetivo también se entera (antes solo el caster recibía stats) y
      // la muerte por skill se RESUELVE (antes quedaba "vivo con 0 HP").
      if (target && target !== s) {
        sendStatsUpdate(target);
        syncPartyStats(target);
        if (target.hp === 0 && target.deadUntil === 0) resolvePlayerDeath(target, s);
      }
    }

    function handleWhisper(s: Session, pkt: WhisperSendRequest): void {
      if (s.deadUntil !== 0) return;
      if (typeof pkt.targetName !== "string") return;
      const now = Date.now();
      // Mismo anti-flood que el chat de mapa: cooldown + saneo + filtro. El
      // susurro compartía cero validación (reenviaba texto crudo) — se corrige.
      if (isOnChatCooldown(s.lastChatAt, now)) {
        send(s.socket, { op: ServerToClientOp.ChatError, reason: "RATE_LIMITED" });
        return;
      }
      const validation = validateChatText(pkt.text);
      if (!validation.ok) {
        send(s.socket, { op: ServerToClientOp.ChatError, reason: validation.reason });
        return;
      }
      // Consume el cooldown ya (aunque el destino no exista) para cortar el
      // spam de búsquedas O(n) por nombre.
      s.lastChatAt = now;

      const targetName = pkt.targetName.toLowerCase();
      let targetSession: Session | undefined;
      for (const sess of sessions.all()) {
        if (sess.characterName.toLowerCase() === targetName) {
          targetSession = sess;
          break;
        }
      }
      if (!targetSession) {
        const err: ChatError = { op: ServerToClientOp.ChatError, reason: "PLAYER_NOT_FOUND" };
        send(s.socket, err);
        return;
      }
      const text = validation.text;
      const outgoing: WhisperReceived = {
        op: ServerToClientOp.WhisperReceived,
        fromName: s.characterName,
        toName: targetSession.characterName,
        text,
        outgoing: true,
        timestamp: now,
      };
      send(s.socket, outgoing);
      const incoming: WhisperReceived = {
        op: ServerToClientOp.WhisperReceived,
        fromName: s.characterName,
        toName: targetSession.characterName,
        text,
        outgoing: false,
        timestamp: now,
      };
      send(targetSession.socket, incoming);
    }

    // ── Clanes (modGuilds.bas — núcleo) ──────────────────────────────────

    function broadcastGuildTag(s: Session): void {
      const pkt: GuildTagUpdate = {
        op: ServerToClientOp.GuildTagUpdate,
        id: s.characterId as EntityId,
        guild: s.guildName,
      };
      broadcastToMap(s.mapId, pkt);
    }

    function guildMembersOnline(guildId: number): Session[] {
      const out: Session[] = [];
      for (const sess of sessions.all()) {
        if (sess.guildId === guildId) out.push(sess);
      }
      return out;
    }

    async function handleGuildCreate(s: Session, pkt: GuildCreateRequest): Promise<void> {
      const reason = canFoundGuild(s);
      if (reason) {
        consoleMsg(s, reason, "global");
        return;
      }
      if (!validGuildName(pkt.name)) {
        consoleMsg(s, "Nombre de clan inválido (3 a 30 letras, números o espacios).", "global");
        return;
      }
      // La facción del clan queda fijada según el estado del fundador.
      const faction = sessionFaction(s);
      const g = await createGuild(pkt.name, s, faction);
      if (!g) {
        consoleMsg(s, "Ya existe un clan con ese nombre.", "global");
        return;
      }
      // Cobrar el costo de fundación (canFoundGuild ya verificó que alcanza).
      addGold(s, -GUILD_COST);
      sendStatsUpdate(s);
      s.guildId = g.id;
      s.guildName = g.name;
      s.guildRank = 0; // el líder se identifica por guilds.leaderId, no por rango
      await clearRequestsForCharacter(s.characterId); // ya tiene clan
      consoleMsg(
        s,
        `¡Has fundado el clan ${g.name} (${factionName(faction)})! Invita miembros con /invitarclan <nombre>.`,
        "global",
      );
      broadcastGuildTag(s);
    }

    // Arma la respuesta de info del clan y se la manda al que la pidió.
    async function sendGuildInfo(s: Session): Promise<void> {
      if (!s.guildId) {
        consoleMsg(s, "No perteneces a ningún clan.", "global");
        return;
      }
      const g = await getGuild(s.guildId);
      if (!g) return;
      const rows = await getGuildMembers(s.guildId);
      const onlineIds = new Set<number>();
      for (const sess of sessions.all()) {
        if (sess.guildId === s.guildId) onlineIds.add(sess.characterId);
      }
      const members: GuildMemberInfo[] = rows.map((m) => ({
        characterId: m.id,
        name: m.name,
        level: m.level,
        classId: m.classId,
        online: onlineIds.has(m.id),
        leader: m.id === g.leaderId,
        rank: m.rank,
      }));
      // Solicitudes pendientes: solo se cargan si el que pide puede gestionar.
      const manage = canManageGuild(s, g);
      const requests: GuildRequestInfo[] = manage
        ? (await listJoinRequests(s.guildId)).map((r) => ({
            characterId: r.characterId,
            name: r.name,
            level: r.level,
            classId: r.classId,
          }))
        : [];
      const pkt: GuildInfoResponse = {
        op: ServerToClientOp.GuildInfoResponse,
        name: g.name,
        faction: g.faction,
        description: g.description,
        rules: g.rules,
        isLeader: g.leaderId === s.characterId,
        canManage: manage,
        maxMembers: GUILD_MAX_MEMBERS,
        members,
        requests,
      };
      send(s.socket, pkt);
    }

    async function handleGuildInfo(s: Session): Promise<void> {
      // Un solo punto de entrada (botón Clanes / tecla G): si tenés clan mostramos
      // su info; si no, el directorio de clanes para explorar y solicitar.
      if (s.guildId) await sendGuildInfo(s);
      else await handleGuildList(s);
    }

    async function handleGuildEdit(s: Session, pkt: GuildEditRequest): Promise<void> {
      if (!s.guildId) {
        consoleMsg(s, "No perteneces a ningún clan.", "global");
        return;
      }
      if (!(await isGuildLeader(s))) {
        consoleMsg(s, "Solo el líder del clan puede editar la descripción y las reglas.", "global");
        return;
      }
      await setGuildText(s.guildId, pkt.description ?? "", pkt.rules ?? "");
      consoleMsg(s, "Descripción y reglas del clan actualizadas.", "global");
      await sendGuildInfo(s);
    }

    // ── Directorio de clanes + solicitudes de ingreso ────────────────────
    async function handleGuildList(s: Session): Promise<void> {
      const myFaction = sessionFaction(s);
      const summaries = await listGuilds();
      const requestedIds = new Set(await guildIdsRequestedBy(s.characterId));
      const entries: GuildDirectoryEntry[] = summaries.map((g) => ({
        id: g.id,
        name: g.name,
        faction: g.faction,
        leaderName: g.leaderName,
        memberCount: g.memberCount,
        maxMembers: GUILD_MAX_MEMBERS,
        description: g.description,
        requested: requestedIds.has(g.id),
        // Puede unirse si no tiene clan, coincide la facción y hay cupo.
        canJoin: !s.guildId && g.faction === myFaction && g.memberCount < GUILD_MAX_MEMBERS,
      }));
      const pkt: GuildListResponse = {
        op: ServerToClientOp.GuildListResponse,
        myFaction,
        guilds: entries,
      };
      send(s.socket, pkt);
    }

    async function handleGuildJoinRequest(s: Session, pkt: GuildJoinRequestReq): Promise<void> {
      const reason = await createJoinRequest(pkt.guildId, s);
      if (reason) {
        consoleMsg(s, reason, "global");
        return;
      }
      const g = await getGuild(pkt.guildId);
      consoleMsg(s, `Solicitud enviada al clan ${g?.name ?? ""}.`, "global");
      // Avisar a los gestores online del clan (líder + oficiales).
      if (g) {
        for (const member of guildMembersOnline(pkt.guildId)) {
          if (canManageGuild(member, g)) {
            consoleMsg(member, `${s.characterName} solicitó unirse al clan. Revisá las solicitudes (tecla G).`, "global");
          }
        }
      }
    }

    async function handleGuildRequestAccept(s: Session, pkt: GuildRequestAcceptReq): Promise<void> {
      if (!s.guildId) return;
      const g = await getGuild(s.guildId);
      if (!g || !canManageGuild(s, g)) {
        consoleMsg(s, "No tenés permiso para gestionar solicitudes.", "global");
        return;
      }
      const target = sessions.getByCharacterId(pkt.characterId);
      // Debe seguir teniendo una solicitud a ESTE clan y poder unirse.
      const reqs = await listJoinRequests(s.guildId);
      if (!reqs.some((r) => r.characterId === pkt.characterId)) {
        consoleMsg(s, "Esa solicitud ya no existe.", "global");
        return;
      }
      await deleteJoinRequest(s.guildId, pkt.characterId);
      if (target) {
        // Aplicante online: validar cupo/facción actuales y sumarlo.
        const joinReason = await canJoinGuild(s.guildId, target);
        if (joinReason) { consoleMsg(s, joinReason, "global"); return; }
        await joinGuild(s.guildId, target);
        await clearRequestsForCharacter(pkt.characterId);
        target.guildId = s.guildId;
        target.guildName = g.name;
        target.guildRank = 0;
        for (const member of guildMembersOnline(s.guildId)) {
          consoleMsg(member, `${target.characterName} se unió al clan.`, "global");
        }
        broadcastGuildTag(target);
      } else {
        // Aplicante offline: lo sumamos en la DB; toma el clan al loguear.
        await joinGuildById(s.guildId, pkt.characterId);
        await clearRequestsForCharacter(pkt.characterId);
        consoleMsg(s, "Solicitud aceptada (el jugador está offline).", "global");
      }
      await sendGuildInfo(s);
    }

    async function handleGuildRequestReject(s: Session, pkt: GuildRequestRejectReq): Promise<void> {
      if (!s.guildId) return;
      const g = await getGuild(s.guildId);
      if (!g || !canManageGuild(s, g)) {
        consoleMsg(s, "No tenés permiso para gestionar solicitudes.", "global");
        return;
      }
      await deleteJoinRequest(s.guildId, pkt.characterId);
      const target = sessions.getByCharacterId(pkt.characterId);
      if (target) consoleMsg(target, `Tu solicitud al clan ${g.name} fue rechazada.`, "global");
      await sendGuildInfo(s);
    }

    async function handleGuildSetRank(s: Session, pkt: GuildSetRankReq): Promise<void> {
      if (!s.guildId) return;
      if (!(await isGuildLeader(s))) {
        consoleMsg(s, "Solo el líder puede otorgar rangos.", "global");
        return;
      }
      if (pkt.characterId === s.characterId) return; // el líder no se cambia el rango
      const rank = pkt.rank >= 1 ? 1 : 0;
      // El objetivo debe ser miembro del mismo clan.
      const members = await getGuildMembers(s.guildId);
      if (!members.some((m) => m.id === pkt.characterId)) return;
      await setGuildRank(pkt.characterId, rank);
      const target = sessions.getByCharacterId(pkt.characterId);
      if (target) {
        target.guildRank = rank;
        consoleMsg(target, rank ? "Ahora sos oficial del clan (podés gestionar solicitudes)." : "Ya no sos oficial del clan.", "global");
      }
      await sendGuildInfo(s);
    }

    async function handleGuildInvite(s: Session, pkt: GuildInviteRequest): Promise<void> {
      if (!s.guildId || !s.guildName) {
        consoleMsg(s, "No perteneces a ningún clan.", "global");
        return;
      }
      if (!(await isGuildLeader(s))) {
        consoleMsg(s, "Solo el líder del clan puede invitar miembros.", "global");
        return;
      }
      let target: Session | undefined;
      for (const sess of sessions.all()) {
        if (sess.characterName.toLowerCase() === pkt.targetName.trim().toLowerCase()) {
          target = sess;
          break;
        }
      }
      if (!target) {
        consoleMsg(s, "Ese personaje no está online.", "global");
        return;
      }
      const joinReason = await canJoinGuild(s.guildId, target);
      if (joinReason) {
        consoleMsg(s, joinReason.replace(/^Ya perteneces/, `${target.characterName} ya pertenece`), "global");
        return;
      }
      target.guildInvite = { guildId: s.guildId, guildName: s.guildName, from: s.characterName };
      consoleMsg(s, `Invitación enviada a ${target.characterName}.`, "global");
      consoleMsg(
        target,
        `${s.characterName} te invita a unirte al clan ${s.guildName}. Escribe /aceptarclan para unirte.`,
        "global",
      );
    }

    async function handleGuildAccept(s: Session): Promise<void> {
      const invite = s.guildInvite;
      if (!invite) {
        consoleMsg(s, "No tienes ninguna invitación de clan pendiente.", "global");
        return;
      }
      s.guildInvite = null;
      // Revalidar al aceptar (el cupo o la facción pudieron cambiar desde la invitación).
      const joinReason = await canJoinGuild(invite.guildId, s);
      if (joinReason) {
        consoleMsg(s, joinReason, "global");
        return;
      }
      await joinGuild(invite.guildId, s);
      await clearRequestsForCharacter(s.characterId); // ya tiene clan
      s.guildId = invite.guildId;
      s.guildName = invite.guildName;
      s.guildRank = 0;
      for (const member of guildMembersOnline(invite.guildId)) {
        consoleMsg(member, `${s.characterName} se ha unido al clan ${invite.guildName}.`, "global");
      }
      broadcastGuildTag(s);
    }

    async function handleGuildLeave(s: Session): Promise<void> {
      if (!s.guildId || !s.guildName) {
        consoleMsg(s, "No perteneces a ningún clan.", "global");
        return;
      }
      const oldName = s.guildName;
      const oldId = s.guildId;
      const result = await leaveGuild(s);
      await setGuildRank(s.characterId, 0);
      s.guildId = null;
      s.guildName = null;
      s.guildRank = 0;
      consoleMsg(s, `Has abandonado el clan ${oldName}.`, "global");
      broadcastGuildTag(s);
      if (result.disbanded) { await clearRequestsForGuild(oldId); return; }
      for (const member of guildMembersOnline(oldId)) {
        consoleMsg(member, `${s.characterName} ha abandonado el clan.`, "global");
        if (result.newLeaderId === member.characterId) {
          consoleMsg(member, `Ahora eres el líder del clan ${oldName}.`, "global");
        }
      }
    }

    function handleGuildMessage(s: Session, pkt: GuildMessageRequest): void {
      if (!s.guildId) {
        consoleMsg(s, "No perteneces a ningún clan.", "global");
        return;
      }
      const validation = validateChatText(pkt.text);
      if (!validation.ok) return;
      for (const member of guildMembersOnline(s.guildId)) {
        consoleMsg(member, `[Clan] ${s.characterName}: ${validation.text}`, "chat");
      }
    }

    // ── Puertas y carteles (AccionParaPuerta / AccionParaCartel) ─────────

    const SND_PUERTA = 5;
    const SND_BEBER = 46; // glup clásico del AO al tomar pociones/beber

    function handleTileInteract(s: Session, x: number, y: number): void {
      const map = getMap(s.mapId);
      if (!map) return;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
      // El AO exige distancia ≤ 2 para accionar puertas.
      if (Math.max(Math.abs(s.position.x - x), Math.abs(s.position.y - y)) > 2) return;
      const obj = map.objects.get(y * map.width + x);
      if (!obj) return;
      const def = getItem(obj.item);
      if (!def) return;

      if (def.objType === 8) {
        // Cartel: mostrar el texto real del obj.dat.
        if (def.texto) consoleMsg(s, def.texto, "global");
        return;
      }

      if (def.objType === 6) {
        // #6: las puertas están SIEMPRE abiertas (se abren al cargar el mapa,
        // incluso las de llave). No se cierran nunca — pero clickearlas SUENA
        // (el AO reproduce SND_PUERTA aunque la puerta ya esté abierta).
        consoleMsg(s, "", "global", SND_PUERTA);
      }
    }

    // ── Ocultarse (DoOcultarse / Trabajo.bas, fórmulas literales) ────────

    const INTERVALO_OCULTO = 500; // Server.ini:127

    function handleHide(s: Session): void {
      if (s.deadUntil !== 0) return;
      const now = Date.now();
      if (s.invisibleUntil > now) {
        consoleMsg(s, "Ya estás oculto.", "global");
        return;
      }
      if (s.navigating) {
        consoleMsg(s, "No puedes ocultarte mientras navegas.", "global");
        return;
      }
      // Mismo ritmo que las acciones de trabajo (anti-spam).
      if (now - s.lastWorkAt < WORK_INTERVAL_MS) return;
      s.lastWorkAt = now;

      const skill = s.skills.ocultarse ?? 0;
      // Suerte = (((0.000002*s − 0.0002)*s + 0.0064)*s + 0.1124) * 100
      const suerte = (((0.000002 * skill - 0.0002) * skill + 0.0064) * skill + 0.1124) * 100;
      const res = 1 + Math.floor(Math.random() * 100);
      if (res <= suerte) {
        // Duración: polinomio sobre (100 − skill) × IntervaloOculto (en segundos).
        const q = 100 - skill;
        const secs = Math.max(
          10,
          (-0.000001 * q ** 3 + 0.00009229 * q ** 2 - 0.0088 * q + 0.9571) * INTERVALO_OCULTO,
        );
        s.invisibleUntil = now + Math.floor(secs * 1000);
        s.hiding = true; // caminar lo rompe (salvo Asesino con su armadura)
        broadcastEffect(s.mapId, s.characterId, "invisible", true, Math.floor(secs * 1000));
        consoleMsg(s, "¡Te has escondido entre las sombras!", "global");
        trainSkill(s, "ocultarse", true);
      } else {
        consoleMsg(s, "¡No has logrado esconderte!", "global");
        trainSkill(s, "ocultarse", false);
      }
      sendStatsUpdate(s);
    }

    // ── Amigos (lista de 50 como el AO) ──────────────────────────────────

    const FRIENDS_MAX = 50;

    function persistFriends(s: Session): void {
      void db
        .update(characters)
        .set({ friends: s.friends })
        .where(eq(characters.id, s.characterId))
        .catch((err) => req.log.error({ err }, "[friends] error al persistir"));
    }

    function handleFriendAdd(s: Session, name: string): void {
      if (typeof name !== "string") return;
      const trimmed = name.trim().slice(0, 32);
      if (!trimmed) return;
      if (trimmed.toLowerCase() === s.characterName.toLowerCase()) {
        consoleMsg(s, "No puedes agregarte a ti mismo.", "global");
        return;
      }
      if (s.friends.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
        consoleMsg(s, `${trimmed} ya está en tu lista de amigos.`, "global");
        return;
      }
      if (s.friends.length >= FRIENDS_MAX) {
        consoleMsg(s, `Tu lista de amigos está llena (máximo ${FRIENDS_MAX}).`, "global");
        return;
      }
      // Usar el nombre con las mayúsculas reales si está online.
      let canonical = trimmed;
      for (const sess of sessions.all()) {
        if (sess.characterName.toLowerCase() === trimmed.toLowerCase()) {
          canonical = sess.characterName;
          break;
        }
      }
      s.friends.push(canonical);
      persistFriends(s);
      consoleMsg(s, `${canonical} agregado a tu lista de amigos.`, "global");
    }

    function handleFriendRemove(s: Session, name: string): void {
      if (typeof name !== "string") return;
      const lower = name.trim().toLowerCase();
      const idx = s.friends.findIndex((f) => f.toLowerCase() === lower);
      if (idx === -1) {
        consoleMsg(s, "Ese personaje no está en tu lista de amigos.", "global");
        return;
      }
      const [removed] = s.friends.splice(idx, 1);
      persistFriends(s);
      consoleMsg(s, `${removed} eliminado de tu lista de amigos.`, "global");
    }

    function handleFriendList(s: Session): void {
      if (s.friends.length === 0) {
        consoleMsg(s, "Tu lista de amigos está vacía. Usa /addamigo <nombre>.", "global");
        return;
      }
      const online = new Set<string>();
      for (const sess of sessions.all()) online.add(sess.characterName.toLowerCase());
      const lines = s.friends
        .map((f) => `${f} ${online.has(f.toLowerCase()) ? "(online)" : "(offline)"}`)
        .join(", ");
      consoleMsg(s, `Amigos (${s.friends.length}): ${lines}.`, "global");
    }

    function handleGuildOnline(s: Session): void {
      if (!s.guildId || !s.guildName) {
        consoleMsg(s, "No perteneces a ningún clan.", "global");
        return;
      }
      const names = guildMembersOnline(s.guildId).map((m) => m.characterName);
      consoleMsg(s, `Miembros de ${s.guildName} online (${names.length}): ${names.join(", ")}.`, "global");
    }

    // ── Comandos GM (jerarquía del AO — role >= 1) ────────────────────────

    function doGmTeleport(s: Session, mapId: number, x: number, y: number): void {
      const dest = getMap(mapId);
      if (!dest) {
        consoleMsg(s, `El mapa ${mapId.toString()} no está cargado.`, "global");
        return;
      }
      // Clamp al rango del mapa (coords fuera dejaban al GM inmóvil fuera del
      // mundo); doMapTransition además reubica a tierra transitable.
      const cx = Math.max(0, Math.min(Math.floor(x) || 0, dest.width - 1));
      const cy = Math.max(0, Math.min(Math.floor(y) || 0, dest.height - 1));
      const portal: PortalTile = {
        x: s.position.x,
        y: s.position.y,
        toMapId: mapId,
        toX: cx,
        toY: cy,
      };
      doMapTransition(s, portal);
    }

    function handleGmCommand(s: Session, text: string): void {
      // Jerarquía del AO: los comandos que otorgan recursos/poder o alteran el
      // mundo son exclusivos de Dios (rol 3). Consejero (1) y Semidiós (2) solo
      // acceden a utilidades de comunicación/moderación (/gmsg, /lluvia, /morir).
      if (s.role < 3 && /^\/(oro|item|nivel|invocar|sumtodos|sum|telepto|telealltodos|telep|teleport|delteleport|blockpiso|matarnpc|eliminarnpc|echar|carcel|silenciar|banip|unbanip|ban|unban|donde|curar|revivir|masskill|limpiar|quienes|info|setfaccion|darexp|renombrar)\b/i.test(text)) {
        consoleMsg(s, "Ese comando requiere rango Dios (rol 3).", "global");
        return;
      }
      // /GMSG: mensaje global de GM a todos los conectados.
      const gmsg = /^\/gmsg\s+(.+)$/i.exec(text);
      if (gmsg) {
        for (const t of sessions.all()) {
          consoleMsg(t, `<GM ${s.characterName}> ${gmsg[1]!}`, "global");
        }
        return;
      }
      // /MORIR: matarse (herramienta de QA para probar muerte/hogar/sacerdote).
      if (/^\/morir$/i.test(text)) {
        if (s.deadUntil === 0) {
          killPlayer(s);
          sendInventoryUpdate(s);
          sendStatsUpdate(s);
        }
        return;
      }
      // /ORO n: darse oro (herramienta de QA para probar tiendas/banco).
      const oro = /^\/oro\s+(\d+)$/i.exec(text);
      if (oro) {
        // Clamp al tope seguro (evita overflow del entero de Postgres).
        s.gold = Math.min(MAX_GOLD, s.gold + parseInt(oro[1]!, 10));
        sendStatsUpdate(s);
        sendInventoryUpdate(s);
        return;
      }
      // /MATARNPC: QA — insta-mata la criatura atacable más cercana.
      if (/^\/matarnpc$/i.test(text)) {
        const now = Date.now();
        let best: NpcInstance | null = null;
        let bestD = Infinity;
        for (const npc of npcs.inMap(s.mapId)) {
          if (npc.deadUntil !== 0 || !npc.type.attackable) continue;
          const d = Math.max(Math.abs(npc.position.x - s.position.x), Math.abs(npc.position.y - s.position.y));
          if (d < bestD) { best = npc; bestD = d; }
        }
        if (best) {
          // Pasa por el MISMO camino que el combate real (damageNpc) → así el
          // test verifica el broadcast de Death del combate, no un atajo.
          damageNpc(s, best, best.hp + 1000, now);
          consoleMsg(s, `Mataste ${best.type.name} (#${best.type.number.toString()}).`, "combate");
        } else {
          consoleMsg(s, "No hay criaturas atacables cerca.", "global");
        }
        return;
      }
      // /ELIMINARNPC: arma el modo eliminar. El próximo click sobre un vendedor
      // o banquero lo borra del mundo de forma permanente (persiste el redeploy).
      // Toggle: si ya estaba armado, lo cancela.
      if (/^\/eliminarnpc$/i.test(text)) {
        s.armedDeleteNpc = !s.armedDeleteNpc;
        consoleMsg(
          s,
          s.armedDeleteNpc
            ? "Eliminar NPC ARMADO: hacé click en el vendedor/banquero a eliminar. (/eliminarnpc de nuevo para cancelar)"
            : "Eliminar NPC cancelado.",
          "global",
        );
        return;
      }
      // /BLOCKPISO: bloquea (toggle) el tile donde está parado el GM para que
      // ningún jugador pueda pisarlo. El GM sí puede volver con /telep (no valida
      // walkability). Persiste el redeploy (blocked-tiles.json). El grh3 se manda
      // con el gráfico ACTUAL del tile para no borrar nada.
      if (/^\/blockpiso$/i.test(text)) {
        const map = getMap(s.mapId);
        if (!map) return;
        const { x, y } = s.position;
        const grh3 = map.layer3[y * map.width + x] ?? 0;
        let blockedNow: boolean;
        if (isBlockStored(s.mapId, x, y)) {
          removeBlock(s.mapId, x, y);
          blockedNow = false;
        } else {
          addBlock(s.mapId, x, y);
          blockedNow = true;
        }
        const pkt: MapTileUpdate = { op: ServerToClientOp.MapTileUpdate, x, y, grh3, blocked: blockedNow };
        broadcastToMap(s.mapId, pkt);
        consoleMsg(
          s,
          blockedNow
            ? `Piso BLOQUEADO en (${x.toString()}, ${y.toString()}). Ningún jugador puede pisarlo (vos volvés con /telep). /blockpiso de nuevo para liberar.`
            : `Piso liberado en (${x.toString()}, ${y.toString()}).`,
          "global",
        );
        return;
      }
      // /LLUVIA: toggle global (Lloviendo del AO).
      if (/^\/lluvia$/i.test(text)) {
        weather.raining = !weather.raining;
        const pkt: RainToggle = { op: ServerToClientOp.RainToggle, raining: weather.raining };
        for (const t of sessions.all()) send(t.socket, pkt);
        return;
      }
      // /INVISIBLE: toggle de invisibilidad del GM (observar sin ser visto).
      if (/^\/invisible$/i.test(text)) {
        const now = Date.now();
        if (s.invisibleUntil > now) {
          s.invisibleUntil = 0;
          broadcastEffect(s.mapId, s.characterId, "invisible", false);
          consoleMsg(s, "Sos visible de nuevo.", "global");
        } else {
          const dur = 3650 * 24 * 3600 * 1000; // ~10 años = permanente hasta togglear.
          s.invisibleUntil = now + dur;
          broadcastEffect(s.mapId, s.characterId, "invisible", true, dur);
          consoleMsg(s, "Ahora sos invisible. Escribí /invisible otra vez para verte.", "global");
        }
        return;
      }
      // /TELEP mapa x y: teletransportarse.
      const telep = /^\/telep\s+(\d+)\s+(\d+)\s+(\d+)$/i.exec(text);
      if (telep) {
        doGmTeleport(s, parseInt(telep[1]!, 10), parseInt(telep[2]!, 10), parseInt(telep[3]!, 10));
        return;
      }
      // /TELEPORT mapa x y: crea un portal FRENTE al GM que lleva a (mapa, x, y).
      const tpCreate = /^\/teleport\s+(\d+)\s+(\d+)\s+(\d+)$/i.exec(text);
      if (tpCreate) {
        const toMapId = parseInt(tpCreate[1]!, 10);
        const toX = parseInt(tpCreate[2]!, 10);
        const toY = parseInt(tpCreate[3]!, 10);
        const destMap = getMap(toMapId);
        if (!destMap || !isWalkable(destMap, toX, toY)) {
          consoleMsg(s, "Destino inválido (mapa inexistente o coordenada no caminable).", "global");
          return;
        }
        const map = getMap(s.mapId);
        if (!map) return;
        // Tile de enfrente según hacia dónde mira el GM.
        const fx = s.position.x + (s.direction === "east" ? 1 : s.direction === "west" ? -1 : 0);
        const fy = s.position.y + (s.direction === "south" ? 1 : s.direction === "north" ? -1 : 0);
        if (!isWalkable(map, fx, fy)) {
          consoleMsg(s, "No hay lugar libre adelante para poner el teleport.", "global");
          return;
        }
        // Portal + gráfico del teleport, PERSISTIDO (sobrevive al reinicio).
        const grh = addCustomTeleport({ mapId: s.mapId, x: fx, y: fy, toMapId, toX, toY });
        const pkt: MapTileUpdate = {
          op: ServerToClientOp.MapTileUpdate, x: fx, y: fy, grh3: grh, blocked: false, wav: 3,
        };
        broadcastToMap(s.mapId, pkt);
        consoleMsg(s, `Teleport creado adelante → mapa ${toMapId.toString()} (${toX.toString()}, ${toY.toString()}).`, "global");
        return;
      }
      // /DELTELEPORT: borra el teleport del tile de adelante (o el propio).
      if (/^\/delteleport\b/i.test(text)) {
        const fx = s.position.x + (s.direction === "east" ? 1 : s.direction === "west" ? -1 : 0);
        const fy = s.position.y + (s.direction === "south" ? 1 : s.direction === "north" ? -1 : 0);
        // Probar el tile de enfrente (donde se crean) y, si no, el propio.
        const target =
          removeCustomTeleport(s.mapId, fx, fy) ? { x: fx, y: fy }
          : removeCustomTeleport(s.mapId, s.position.x, s.position.y) ? { x: s.position.x, y: s.position.y }
          : null;
        if (!target) {
          consoleMsg(s, "No hay ningún teleport de GM adelante ni bajo tus pies.", "global");
          return;
        }
        const pkt: MapTileUpdate = {
          op: ServerToClientOp.MapTileUpdate, x: target.x, y: target.y, grh3: 0, blocked: false,
        };
        broadcastToMap(s.mapId, pkt);
        consoleMsg(s, "Teleport borrado.", "global");
        return;
      }

      // ── Comandos GM extra (moderación / eventos / info / ajustes) ────────────
      const gnow = Date.now();
      // /ECHAR nombre — desconectar a un jugador.
      const echar = /^\/echar\s+(.+)$/i.exec(text);
      if (echar) {
        const t = findOnlineByName(echar[1]!);
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        consoleMsg(t, "Un GM te desconectó.", "global");
        t.socket.close(CLOSE_NORMAL, "KICKED");
        consoleMsg(s, `Echaste a ${t.characterName}.`, "global");
        return;
      }
      // /CARCEL nombre [min] — inmoviliza (cárcel) por X minutos (def 5).
      const carcel = /^\/carcel\s+(\S+)(?:\s+(\d+))?$/i.exec(text);
      if (carcel) {
        const t = findOnlineByName(carcel[1]!);
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        const min = Math.max(1, Math.min(parseInt(carcel[2] ?? "5", 10) || 5, 1440));
        t.immobilizedUntil = gnow + min * 60_000;
        consoleMsg(t, `Fuiste encarcelado por ${min.toString()} minutos.`, "global");
        consoleMsg(s, `Encarcelaste a ${t.characterName} por ${min.toString()} min.`, "global");
        return;
      }
      // /SILENCIAR nombre [min] — mutea del chat (def 10).
      const sil = /^\/silenciar\s+(\S+)(?:\s+(\d+))?$/i.exec(text);
      if (sil) {
        const t = findOnlineByName(sil[1]!);
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        const min = Math.max(1, Math.min(parseInt(sil[2] ?? "10", 10) || 10, 1440));
        t.silencedUntil = gnow + min * 60_000;
        consoleMsg(t, `Fuiste silenciado por ${min.toString()} minutos.`, "global");
        consoleMsg(s, `Silenciaste a ${t.characterName} por ${min.toString()} min.`, "global");
        return;
      }
      // /BAN nombre · /UNBAN nombre — banea/desbanea la cuenta (por personaje).
      const ban = /^\/(ban|unban)\s+(.+)$/i.exec(text);
      if (ban) {
        const banning = ban[1]!.toLowerCase() === "ban";
        const name = ban[2]!.trim();
        void (async () => {
          const [ch] = await db
            .select({ accountId: characters.accountId })
            .from(characters)
            .where(eq(sql`lower(${characters.name})`, name.toLowerCase()))
            .limit(1);
          if (!ch) { consoleMsg(s, "No existe ese personaje.", "global"); return; }
          await db.update(accounts).set({ banned: banning }).where(eq(accounts.id, ch.accountId));
          if (banning) {
            const t = findOnlineByName(name);
            if (t) { consoleMsg(t, "Fuiste baneado.", "global"); t.socket.close(CLOSE_NORMAL, "BANNED"); }
          }
          consoleMsg(s, `${banning ? "Baneaste" : "Desbaneaste"} la cuenta de ${name}.`, "global");
        })();
        return;
      }
      // /BANIP nombre|ip — banea la IP (de un jugador online o una IP directa) y
      // lo desconecta. La IP no puede volver a conectarse.
      const banip = /^\/banip\s+(.+)$/i.exec(text);
      if (banip) {
        const arg = banip[1]!.trim();
        // Si el argumento parece una IP, se banea directo; si no, se busca al jugador.
        const looksIp = /^[0-9a-f:.]+$/i.test(arg) && (arg.includes(".") || arg.includes(":"));
        const t = looksIp ? undefined : findOnlineByName(arg);
        const ip = t ? t.ip : looksIp ? arg : "";
        if (!ip) { consoleMsg(s, "No encontré ese jugador online (o IP inválida).", "global"); return; }
        if (!banIp(ip)) { consoleMsg(s, `La IP ${ip} ya estaba baneada.`, "global"); return; }
        // Echar a TODOS los conectados desde esa IP.
        for (const o of sessions.all()) {
          if (o.ip === ip) { consoleMsg(o, "Tu IP fue baneada.", "global"); o.socket.close(CLOSE_NORMAL, "IP_BANNED"); }
        }
        consoleMsg(s, `IP ${ip} baneada${t ? ` (${t.characterName})` : ""}.`, "global");
        return;
      }
      // /UNBANIP ip — quita el baneo de una IP.
      const unbanip = /^\/unbanip\s+(\S+)$/i.exec(text);
      if (unbanip) {
        const ok = unbanIp(unbanip[1]!.trim());
        consoleMsg(s, ok ? `IP ${unbanip[1]!.trim()} desbaneada.` : "Esa IP no estaba baneada.", "global");
        return;
      }
      // /DONDE nombre — ubicación de un jugador.
      const donde = /^\/donde\s+(.+)$/i.exec(text);
      if (donde) {
        const t = findOnlineByName(donde[1]!);
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        consoleMsg(s, `${t.characterName} está en mapa ${t.mapId.toString()} (${t.position.x.toString()}, ${t.position.y.toString()}).`, "global");
        return;
      }
      // /SUMTODOS — traer a TODOS los online a tu posición.
      if (/^\/sumtodos\b/i.test(text)) {
        let n = 0;
        for (const t of sessions.all()) {
          if (t.characterId === s.characterId) continue;
          doGmTeleport(t, s.mapId, s.position.x, s.position.y);
          n += 1;
        }
        consoleMsg(s, `Trajiste a ${n.toString()} jugador(es).`, "global");
        return;
      }
      // /TELEALLTODOS mapa x y — teletransportar a TODOS a un lugar.
      const teleall = /^\/telealltodos\s+(\d+)\s+(\d+)\s+(\d+)$/i.exec(text);
      if (teleall) {
        const m = parseInt(teleall[1]!, 10), tx = parseInt(teleall[2]!, 10), ty = parseInt(teleall[3]!, 10);
        if (!getMap(m)) { consoleMsg(s, "Mapa inexistente.", "global"); return; }
        let n = 0;
        for (const t of sessions.all()) { doGmTeleport(t, m, tx, ty); n += 1; }
        consoleMsg(s, `Teletransportaste a ${n.toString()} jugador(es) a mapa ${m.toString()}.`, "global");
        return;
      }
      // /CURAR [nombre] — HP/maná/energía al máximo (a vos o a un jugador).
      const curar = /^\/curar(?:\s+(\S+))?$/i.exec(text);
      if (curar) {
        const t = curar[1] ? findOnlineByName(curar[1]) : s;
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        t.hp = t.maxHp; t.mana = t.maxMana; t.sta = t.maxSta;
        sendStatsUpdate(t);
        consoleMsg(s, `Curaste a ${t.characterName}.`, "global");
        if (t !== s) consoleMsg(t, "Un GM te curó.", "global");
        return;
      }
      // /REVIVIR nombre — revivir a un muerto.
      const revivir = /^\/revivir\s+(.+)$/i.exec(text);
      if (revivir) {
        const t = findOnlineByName(revivir[1]!);
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        if (t.deadUntil === 0) { consoleMsg(s, "Ese jugador no está muerto.", "global"); return; }
        revivePlayer(t);
        consoleMsg(t, "Un GM te revivió.", "global");
        consoleMsg(s, `Reviviste a ${t.characterName}.`, "global");
        return;
      }
      // /MASSKILL — matar todas las criaturas del mapa actual.
      if (/^\/masskill\b/i.test(text)) {
        let n = 0;
        for (const npc of npcs.inMap(s.mapId)) {
          if (npc.deadUntil !== 0) continue;
          if (!npc.type.attackable || npc.type.merchant || npc.type.banker) continue;
          npc.hp = 0;
          npc.deadUntil = gnow + npc.type.respawnMs;
          npc.targetCharacterId = null;
          broadcastToMap(npc.mapId, { op: ServerToClientOp.Death, id: npc.id as EntityId, wav: npcDeathSound(npc.type) });
          n += 1;
        }
        consoleMsg(s, `Mataste ${n.toString()} criatura(s) del mapa.`, "global");
        return;
      }
      // /LIMPIAR — borrar todos los items tirados del mapa.
      if (/^\/limpiar\b/i.test(text)) {
        let n = 0;
        for (const g of groundItems.inMap(s.mapId)) {
          groundItems.remove(g.id);
          broadcastToMap(s.mapId, { op: ServerToClientOp.GroundItemDespawn, id: g.id as EntityId });
          n += 1;
        }
        consoleMsg(s, `Limpiaste ${n.toString()} item(s) del piso.`, "global");
        return;
      }
      // /QUIENES — lista de online con nivel, clase y mapa.
      if (/^\/quienes\b/i.test(text)) {
        const all = [...sessions.all()];
        consoleMsg(s, `Online (${all.length.toString()}):`, "global");
        for (const t of all) {
          const cls = getClass(t.classId)?.name ?? "";
          consoleMsg(s, `• ${t.characterName} — Lv.${t.level.toString()} ${cls} — mapa ${t.mapId.toString()} (${t.position.x.toString()},${t.position.y.toString()})`, "global");
        }
        return;
      }
      // /INFO nombre — ficha de un jugador.
      const info = /^\/info\s+(.+)$/i.exec(text);
      if (info) {
        const t = findOnlineByName(info[1]!);
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        const cls = getClass(t.classId)?.name ?? "";
        consoleMsg(s, `${t.characterName}: Lv.${t.level.toString()} ${cls} · Oro ${t.gold.toString()} · Facción ${t.faction.toString()} · ${isCriminal(t) ? "Criminal" : "Ciudadano"} · mapa ${t.mapId.toString()} (${t.position.x.toString()},${t.position.y.toString()}) · HP ${t.hp.toString()}/${t.maxHp.toString()}`, "global");
        return;
      }
      // /SETFACCION nombre ciudadano|armada|caos — cambiar facción.
      const setf = /^\/setfaccion\s+(\S+)\s+(ciudadano|armada|caos)$/i.exec(text);
      if (setf) {
        const t = findOnlineByName(setf[1]!);
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        const f = setf[2]!.toLowerCase();
        t.faction = f === "armada" ? FACTION_ARMADA : f === "caos" ? FACTION_CAOS : 0;
        sendStatsUpdate(t);
        // Actualiza el color del nombre (criminal/ciudadano) para los que lo ven.
        broadcastToMap(t.mapId, { op: ServerToClientOp.CriminalUpdate, id: t.characterId as EntityId, criminal: isCriminal(t), expiresAt: 0 });
        consoleMsg(s, `${t.characterName} ahora es ${f}.`, "global");
        consoleMsg(t, `Un GM cambió tu facción a ${f}.`, "global");
        return;
      }
      // /DAREXP nombre n — dar experiencia.
      const darexp = /^\/darexp\s+(\S+)\s+(\d+)$/i.exec(text);
      if (darexp) {
        const t = findOnlineByName(darexp[1]!);
        if (!t) { consoleMsg(s, "Ese personaje no está online.", "global"); return; }
        const amt = Math.min(parseInt(darexp[2]!, 10) || 0, 2_000_000_000);
        grantXp(t, amt);
        consoleMsg(s, `Diste ${amt.toString()} exp a ${t.characterName}.`, "global");
        consoleMsg(t, `Un GM te dio ${amt.toString()} de experiencia.`, "global");
        return;
      }
      // /RENOMBRAR viejo nuevo — renombrar un personaje (se ve al reloguear).
      const ren = /^\/renombrar\s+(\S+)\s+(\S+)$/i.exec(text);
      if (ren) {
        const oldName = ren[1]!, newName = ren[2]!.trim().slice(0, 32);
        void (async () => {
          const [taken] = await db
            .select({ id: characters.id })
            .from(characters)
            .where(eq(sql`lower(${characters.name})`, newName.toLowerCase()))
            .limit(1);
          if (taken) { consoleMsg(s, "Ese nombre ya está en uso.", "global"); return; }
          const res = await db
            .update(characters)
            .set({ name: newName })
            .where(eq(sql`lower(${characters.name})`, oldName.toLowerCase()))
            .returning({ id: characters.id });
          if (res.length === 0) { consoleMsg(s, "No existe ese personaje.", "global"); return; }
          consoleMsg(s, `Renombraste ${oldName} → ${newName}. (El jugador lo verá al reloguear.)`, "global");
        })();
        return;
      }

      // /SUM nombre: traer a un jugador a mi posición.
      const sum = /^\/sum\s+(\S+)$/i.exec(text);
      if (sum) {
        let target: Session | undefined;
        for (const t of sessions.all()) {
          if (t.characterName.toLowerCase() === sum[1]!.toLowerCase()) {
            target = t;
            break;
          }
        }
        if (!target) {
          consoleMsg(s, "Ese personaje no está online.", "global");
          return;
        }
        doGmTeleport(target, s.mapId, s.position.x, s.position.y);
        consoleMsg(target, `${s.characterName} te ha trasladado.`, "global");
        return;
      }
      // /TELEPTO nombre: teletransportarme JUNTO a un jugador online.
      const telepto = /^\/telepto\s+(\S+)$/i.exec(text);
      if (telepto) {
        let target: Session | undefined;
        for (const t of sessions.all()) {
          if (t.characterName.toLowerCase() === telepto[1]!.toLowerCase()) { target = t; break; }
        }
        if (!target) {
          consoleMsg(s, "Ese personaje no está online.", "global");
          return;
        }
        doGmTeleport(s, target.mapId, target.position.x, target.position.y);
        consoleMsg(s, `Te trasladaste junto a ${target.characterName}.`, "global");
        return;
      }
      // /NIVEL n: fijar el nivel (recalcula vida/maná y cura al máximo).
      const nivel = /^\/nivel\s+(\d+)$/i.exec(text);
      if (nivel) {
        const prevLevel = s.level;
        s.level = Math.max(1, Math.min(parseInt(nivel[1]!, 10), MAX_LEVEL));
        s.skills = skillsForLevel(s.level);
        const classDef = getClass(s.classId);
        if (classDef) {
          s.maxMana = calcMaxMp(classDef, s.level, s.int_);
          s.maxSta = calcMaxSta(classDef, s.level);
        }
        recomputeMaxHp(s);
        s.hp = s.maxHp;
        s.mana = s.maxMana;
        s.sta = s.maxSta;
        sendStatsUpdate(s);
        if (prevLevel <= NEWBIE_MAX_LEVEL && s.level > NEWBIE_MAX_LEVEL) graduateNewbie(s);
        return;
      }
      // /ITEM id [cantidad]: darse un item por su código.
      const itemCmd = /^\/item\s+(\d+)(?:\s+(\d+))?$/i.exec(text);
      if (itemCmd) {
        const id = parseInt(itemCmd[1]!, 10);
        const qty = Math.max(1, Math.min(itemCmd[2] ? parseInt(itemCmd[2], 10) : 1, 10_000));
        if (!getItem(id)) {
          consoleMsg(s, `No existe el item ${id.toString()}.`, "global");
          return;
        }
        s.inventory = addItem(s.inventory, id, qty);
        sendInventoryUpdate(s);
        return;
      }
      // /INVOCAR n: spawnear la criatura/NPC número n en mi posición.
      const invocar = /^\/invocar\s+(\d+)$/i.exec(text);
      if (invocar) {
        const num = parseInt(invocar[1]!, 10);
        const npc = npcs.spawnAt(num, s.mapId, s.position, true);
        if (!npc) {
          consoleMsg(s, `No existe el NPC número ${num.toString()}.`, "global");
          return;
        }
        // Persistimos la invocación para que el NPC sobreviva a un reinicio/redeploy.
        addGmNpc(s.mapId, num, npc.spawn.x, npc.spawn.y);
        const spawn: EntitySpawn = {
          op: ServerToClientOp.EntitySpawn,
          id: npc.id as EntityId,
          position: { x: npc.position.x, y: npc.position.y },
          direction: npc.direction,
          name: npc.type.name,
          hp: npc.hp,
          maxHp: npc.type.maxHp,
          kind: npc.type.merchant ? "merchant" : npc.type.banker ? "banker" : "npc",
          bodyId: npc.type.bodyId,
          headId: npc.type.headId,
          graphic: 0,
        };
        broadcastToMap(s.mapId, spawn);
        consoleMsg(s, `Invocado: ${npc.type.name} (#${num.toString()}).`, "global");
        return;
      }
      consoleMsg(s, "Comandos GM: /gmsg <texto> · /invisible · /teleport <mapa> <x> <y> · /delteleport · /telep <mapa> <x> <y> · /telepto <nombre> · /lluvia · /sum <nombre> · /nivel <n> · /oro <n> · /item <id> [cant] · /invocar <npc> · /matarnpc · /eliminarnpc · /blockpiso · /morir\n" +
        "Extra: /echar <nombre> · /carcel <nombre> [min] · /silenciar <nombre> [min] · /ban <nombre> · /unban <nombre> · /banip <nombre|ip> · /unbanip <ip> · /donde <nombre> · /sumtodos · /telealltodos <mapa> <x> <y> · /curar [nombre] · /revivir <nombre> · /masskill · /limpiar · /quienes · /info <nombre> · /setfaccion <nombre> <ciudadano|armada|caos> · /darexp <nombre> <n> · /renombrar <viejo> <nuevo>", "global");
    }

    // /EST de AO Libre (SendUserStatsTxt): desglose completo en la consola.
    async function sendUserStats(s: Session): Promise<void> {
      const clsName = getClass(s.classId)?.name ?? "";
      const prog = levelProgress(s.level, s.xp);
      const golpe = golpeUsuario(s.classId, s.level);
      const weapon = s.equippedWeapon !== null ? getItem(s.equippedWeapon) : undefined;
      const armor = s.equippedArmor !== null ? getItem(s.equippedArmor) : undefined;
      const shield = s.equippedShield !== null ? getItem(s.equippedShield) : undefined;
      const casco = s.equippedHelmet !== null ? getItem(s.equippedHelmet) : undefined;
      const cuerpoMin = (armor?.defenseMin ?? 0) + (shield?.defenseMin ?? 0);
      const cuerpoMax = (armor?.defenseMax ?? 0) + (shield?.defenseMax ?? 0);

      consoleMsg(s, `Estadísticas de: ${s.characterName}${clsName ? ` (${clsName})` : ""}`, "global");
      consoleMsg(s, `Nivel: ${s.level.toString()}  EXP: ${prog.xpIntoLevel.toString()}/${prog.xpForNextLevel.toString()}`, "global");
      consoleMsg(s, `Salud: ${s.hp.toString()}/${s.maxHp.toString()}  Maná: ${s.mana.toString()}/${s.maxMana.toString()}  Energía: ${s.sta.toString()}/${s.maxSta.toString()}`, "global");
      consoleMsg(
        s,
        `Menor Golpe/Mayor Golpe: ${golpe.min.toString()}/${golpe.max.toString()}` +
          (weapon ? ` (${(weapon.minHit ?? 0).toString()}/${(weapon.maxHit ?? 0).toString()})` : ""),
        "global",
      );
      consoleMsg(s, `(CUERPO) Min Def/Max Def: ${cuerpoMin.toString()}/${cuerpoMax.toString()}`, "global");
      consoleMsg(s, `(CABEZA) Min Def/Max Def: ${(casco?.defenseMin ?? 0).toString()}/${(casco?.defenseMax ?? 0).toString()}`, "global");
      if (s.guildName) {
        consoleMsg(s, `Clan: ${s.guildName}`, "global");
        if (await isGuildLeader(s)) consoleMsg(s, "Status: Líder", "global");
      }
      if (s.faction !== 0) {
        consoleMsg(s, `Facción: ${FACTION_NAMES[s.faction] ?? ""} · ${factionRankName(s.faction, s.factionRank)} · ${s.factionPoints.toString()} puntos`, "global");
      }
      if (isCriminal(s)) consoleMsg(s, "Estado: Criminal", "combate");
      consoleMsg(s, `Oro: ${s.gold.toLocaleString("es")}  Posición: ${s.position.x.toString()},${s.position.y.toString()} en mapa ${s.mapId.toString()}`, "global");
      consoleMsg(s, `Dados: FUE ${s.str.toString()}, AGI ${s.agi.toString()}, INT ${s.int_.toString()}, CAR ${s.car.toString()}, CON ${s.con.toString()}`, "global");
    }

    function handleChat(s: Session, chat: ChatSend): void {
      if (typeof chat.text !== "string" || chat.text.length > 500) return;
      // /desc <texto>: setear la descripción del personaje (todos los jugadores).
      // ── Facciones: /enlistar y /recompensa (cerca del NPC enlistador) ──────
      const enlisterFactionNear = (): number | null => {
        for (const n of npcs.inMap(s.mapId)) {
          const f = ENLISTER_FACTION[n.type.number];
          if (f !== undefined && chebyshev(s.position, n.position) <= 5) return f;
        }
        return null;
      };
      function handleEnlistar(sess: Session): void {
        const near = enlisterFactionNear();
        if (near === null) {
          consoleMsg(sess, "Acercate al enlistador de una facción (Tancredo en Banderbill / el Demonio Legionario) para enlistarte.", "global");
          return;
        }
        const reason = near === FACTION_ARMADA ? canEnlistArmada(sess) : canEnlistCaos(sess);
        if (reason !== null) { consoleMsg(sess, reason, "global"); return; }
        sess.faction = near;
        sess.factionRank = 0;
        consoleMsg(sess, `¡Bienvenido a la ${FACTION_NAMES[near]!}! Escribí /recompensa para reclamar tu rango.`, "global", 6);
        broadcastToMap(sess.mapId, {
          op: ServerToClientOp.FactionUpdate,
          id: sess.characterId as EntityId,
          faction: sess.faction,
        } satisfies FactionUpdate);
        sendStatsUpdate(sess);
      }
      function handleRecompensa(sess: Session): void {
        if (sess.faction === FACTION_NONE) {
          consoleMsg(sess, "No perteneces a ninguna facción. Enlistate con /enlistar.", "global");
          return;
        }
        if (enlisterFactionNear() !== sess.faction) {
          consoleMsg(sess, "Acercate al enlistador de tu facción para ascender.", "global");
          return;
        }
        const next = nextRank(sess.faction, sess.factionRank);
        if (!next) {
          consoleMsg(sess, `Ya alcanzaste el rango máximo: ${factionRankName(sess.faction, sess.factionRank)}.`, "global");
          return;
        }
        if (sess.level < next.level || sess.factionPoints < next.points) {
          const faltaLvl = Math.max(0, next.level - sess.level);
          const faltaPts = Math.max(0, next.points - sess.factionPoints);
          const partes: string[] = [];
          if (faltaLvl > 0) partes.push(`${faltaLvl.toString()} nivel(es)`);
          if (faltaPts > 0) partes.push(`${faltaPts.toString()} puntos de facción`);
          consoleMsg(sess, `Para ascender a ${next.name} te falta: ${partes.join(" y ")}.`, "global");
          return;
        }
        sess.factionRank += 1;
        addGold(sess, next.gold);
        const armor = factionRankArmor(sess.faction, sess.factionRank, sess.classId);
        let armorMsg = "";
        if (armor !== undefined && carryCapacity(sess.inventory, armor) >= 1) {
          sess.inventory = addItem(sess.inventory, armor, 1);
          armorMsg = " y una armadura de tu rango";
          sendInventoryUpdate(sess);
        }
        consoleMsg(sess, `¡Ascendiste a ${next.name}! Recibís ${next.gold.toLocaleString("es")} de oro${armorMsg}.`, "global", 6);
        sendStatsUpdate(sess);
      }

      if (/^\/desc(\s|$)/i.test(chat.text)) {
        // Con cooldown de chat: cada /desc escribe a la DB (spam = DoS de DB).
        const dnow = Date.now();
        if (isOnChatCooldown(s.lastChatAt, dnow)) return;
        s.lastChatAt = dnow;
        const desc = chat.text.replace(/^\/desc\s?/i, "").trim().slice(0, 200);
        s.description = desc;
        void db.update(characters).set({ description: desc }).where(eq(characters.id, s.characterId));
        consoleMsg(s, desc ? `Descripción actualizada: "${desc}"` : "Descripción borrada.", "global");
        return;
      }
      // Comandos de acción de jugador (para macros): meditar, descansar, seguro.
      const cmd = chat.text.trim().toLowerCase();
      if (cmd === "/meditar" || cmd === "/med") { handleMeditate(s); return; }
      if (cmd === "/descansar" || cmd === "/rest") { handleRest(s); return; }
      if (cmd === "/seguro" || cmd === "/seg") { handleSafeToggle(s); return; }
      if (cmd === "/enlistar") { handleEnlistar(s); return; }
      if (cmd === "/recompensa") { handleRecompensa(s); return; }
      // /est · /stats: estadísticas completas del personaje (SendUserStatsTxt de AO Libre).
      if (cmd === "/est" || cmd === "/stats") { void sendUserStats(s); return; }
      // Comandos informativos del AO clásico.
      if (cmd === "/online") {
        consoleMsg(s, `Hay ${sessions.size().toString()} jugador(es) conectado(s).`, "global");
        return;
      }
      if (cmd === "/uptime") {
        const secs = Math.floor(process.uptime());
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        consoleMsg(s, `El servidor lleva ${h.toString()}h ${m.toString()}m en línea.`, "global");
        return;
      }
      if (cmd === "/motd") {
        consoleMsg(s, "AoTum — beta. ¡Bienvenido! Reportá bugs y disfrutá. Que la Diosa te acompañe.", "global");
        return;
      }
      // /gm [texto]: pedido de ayuda a los GMs conectados.
      if (/^\/gm(\s|$)/i.test(chat.text)) {
        const msg = chat.text.replace(/^\/gm\s?/i, "").trim().slice(0, 200);
        let gms = 0;
        for (const g of sessions.all()) {
          if (g.role > 0) {
            consoleMsg(g, `[Pedido GM] ${s.characterName}: ${msg || "(sin detalle)"}`, "global");
            gms += 1;
          }
        }
        consoleMsg(s, gms > 0 ? "Tu pedido fue enviado a los GMs en línea." : "No hay GMs en línea ahora mismo.", "global");
        return;
      }
      // /gritar <texto> (Yell): grito a todo el mapa, en mayúsculas.
      // Con el MISMO anti-flood y filtro que el chat normal (antes lo salteaba:
      // spam ilimitado al mapa entero sin blocklist).
      const yellMatch = /^\/(?:gritar|grito)\s+(.+)$/i.exec(chat.text);
      if (yellMatch) {
        const ynow = Date.now();
        if (isOnChatCooldown(s.lastChatAt, ynow)) {
          send(s.socket, { op: ServerToClientOp.ChatError, reason: "RATE_LIMITED" } satisfies ChatError);
          return;
        }
        const yv = validateChatText(yellMatch[1]!.trim());
        if (!yv.ok) {
          send(s.socket, { op: ServerToClientOp.ChatError, reason: yv.reason } satisfies ChatError);
          return;
        }
        s.lastChatAt = ynow;
        const yell: ChatBroadcast = {
          op: ServerToClientOp.ChatBroadcast,
          fromId: s.characterId as EntityId,
          fromName: s.characterName,
          text: yv.text.slice(0, 200).toUpperCase(),
          timestamp: ynow,
          yell: true,
        };
        broadcastToMap(s.mapId, yell);
        return;
      }
      // Comandos GM: cualquier texto que empiece con "/" de un GM.
      if (s.role > 0 && chat.text.startsWith("/")) {
        handleGmCommand(s, chat.text.trim());
        return;
      }
      const now = Date.now();
      if (isOnChatCooldown(s.lastChatAt, now)) {
        const err: ChatError = { op: ServerToClientOp.ChatError, reason: "RATE_LIMITED" };
        send(s.socket, err);
        return;
      }

      // Silenciado por un GM (/silenciar): no puede hablar en público.
      if (s.silencedUntil > now) {
        const secs = Math.ceil((s.silencedUntil - now) / 1000);
        consoleMsg(s, `Estás silenciado por ${secs.toString()}s y no podés hablar.`, "combate");
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

      // Si el personaje YA tiene una sesión viva (relogin/segunda pestaña),
      // persistir su estado ANTES de leer la DB. Sin esto, el SELECT leía un
      // snapshot stale (el estado vivo solo se guardaba al cerrar el socket,
      // más tarde) → rollback de progreso y dupes de oro/items reproducibles.
      {
        const prev = sessions.getByCharacterId(loginReq.characterId as number);
        if (prev) {
          try {
            await persistPosition(prev);
          } catch (err) {
            req.log.error({ err }, "[ws] error persistiendo sesión previa en relogin");
          }
        }
      }

      const [character] = await db
        .select({
          id: characters.id,
          name: characters.name,
          classId: characters.classId,
          race: characters.race,
          gender: characters.gender,
          description: characters.description,
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
          hunger: characters.hunger,
          thirst: characters.thirst,
          skills: characters.skills,
          skillsXp: characters.skillsXp,
          knownSpells: characters.knownSpells,
          quests: characters.quests,
          questsDone: characters.questsDone,
          faction: characters.faction,
          citizensKilled: characters.citizensKilled,
          criminalsKilled: characters.criminalsKilled,
          guildId: characters.guildId,
          guildRank: characters.guildRank,
          friends: characters.friends,
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
          dead: characters.dead,
          navigating: characters.navigating,
          boatBody: characters.boatBody,
          pardonedKills: characters.pardonedKills,
          bailsPaid: characters.bailsPaid,
          factionRewards: characters.factionRewards,
          factionPoints: characters.factionPoints,
          factionRank: characters.factionRank,
          equippedArrow: characters.equippedArrow,
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

      // Cuenta baneada por un GM (/ban): no puede entrar.
      const [acct] = await db
        .select({ banned: accounts.banned })
        .from(accounts)
        .where(eq(accounts.id, payload.accountId))
        .limit(1);
      if (acct?.banned) {
        sendLoginResponse(socket, false, "BANNED");
        socket.close(CLOSE_AUTH_FAILED, "BANNED");
        return;
      }

      let spawnInfo: { map: MapState; position: Vector2 };
      try {
        spawnInfo = resolveSpawn(
          character.mapId,
          { x: character.posX, y: character.posY },
          character.navigating,
        );
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
      session.ip = clientIp; // para /banip

      session.direction = parseDirection(character.direction);
      session.classId = character.classId;
      session.race = character.race;
      session.gender = character.gender;
      session.description = character.description ?? "";
      session.level = character.level;
      session.xp = character.xp;
      session.str = character.str;
      session.agi = character.agi;
      session.int_ = character.int_;
      session.con = character.con;
      session.car = character.car;
      session.statPoints = character.statPoints;
      session.hunger = character.hunger;
      session.thirst = character.thirst;
      // Skills derivadas del NIVEL: todas suben con el nivel y llegan a 100 en
      // el nivel 34 (no por uso).
      session.skills = skillsForLevel(session.level);
      session.skillsXp = { ...(character.skillsXp as Partial<Record<string, number>>) };
      // Hechizos: si el personaje es previo al sistema de pergaminos
      // (known_spells NULL) hereda su libro por nivel; si ya migró, usa el
      // aprendido (aunque esté vacío = arrancó sin hechizos).
      session.knownSpells = character.knownSpells ?? knownSpellsFor(session.classId, session.level);
      session.quests = character.quests.map((aq) => ({ id: aq.id, kills: [...aq.kills] }));
      session.questsDone = [...character.questsDone];
      session.faction = character.faction;
      session.citizensKilled = character.citizensKilled;
      session.criminalsKilled = character.criminalsKilled;
      session.pardonedKills = character.pardonedKills;
      session.bailsPaid = character.bailsPaid;
      session.factionRewards = character.factionRewards;
      session.factionPoints = character.factionPoints;
      session.factionRank = character.factionRank;
      session.friends = [...character.friends];
      // Privilegios frescos de la cuenta (GMs — panel /admin).
      const [acc] = await db
        .select({ role: accounts.role })
        .from(accounts)
        .where(eq(accounts.id, session.accountId));
      session.role = acc?.role ?? 0;
      if (character.guildId) {
        session.guildId = character.guildId;
        session.guildRank = character.guildRank;
        const [g] = await db
          .select({ name: guilds.name })
          .from(guilds)
          .where(eq(guilds.id, character.guildId));
        session.guildName = g?.name ?? null;
        if (!session.guildName) session.guildId = null;
      }

      // Recalcular HP/MP máximos desde la clase (fuente de verdad) + bonus de equipo.
      const classDef = getClass(session.classId);
      if (classDef) {
        session.maxMana = calcMaxMp(classDef, session.level, session.int_);
        session.maxSta = calcMaxSta(classDef, session.level);
      } else {
        session.maxMana = 0;
      }
      recomputeMaxHp(session);
      // Muerto persistido: sigue fantasma al reconectar (antes un F5 revivía
      // gratis con vida completa en el mismo tile).
      if (character.dead) {
        session.deadUntil = DEAD_FOREVER;
        session.hp = 0;
        session.mana = Math.min(character.mana, session.maxMana);
        session.sta = 0;
      } else {
        session.hp = character.hp > 0 ? Math.min(character.hp, session.maxHp) : session.maxHp;
        session.mana = Math.min(character.mana, session.maxMana);
        session.sta = session.maxSta;
      }

      session.gold = character.gold;
      session.inventory = character.inventory.map((sl) => ({ ...sl }));
      session.equippedWeapon = character.equippedWeapon;
      session.equippedArmor = character.equippedArmor;
      session.equippedHelmet = character.equippedHelmet;
      session.equippedShield = character.equippedShield;
      session.equippedArrow = character.equippedArrow;
      session.bodyId = character.bodyId;
      session.headId = character.headId;
      session.bankInventory = character.bankInventory.map((sl) => ({ ...sl }));
      session.bankGold = character.bankGold;
      // Restaurar navegación (se persiste): reconectar en el agua mantiene el
      // barco en vez de teletransportar a Ullathorpe.
      session.navigating = character.navigating;
      session.boatBody = character.boatBody;
      recomputeEquipment(session);
      // Ropaje: si entra con armadura equipada, mostrar ese body desde el
      // inicio. Igual con los overlays de equipo — así el primer
      // sendInventoryUpdate no dispara un EntityAppearance espurio.
      session.visibleBodyId = computeVisibleBody(session);
      const initialEquip = computeVisibleEquip(session);
      session.visibleWeaponAnim = initialEquip.weaponAnim;
      session.visibleShieldAnim = initialEquip.shieldAnim;
      session.visibleHelmetAnim = initialEquip.helmetAnim;

      // Si está lloviendo, el que entra lo ve llover.
      if (weather.raining) {
        const rainPkt: RainToggle = { op: ServerToClientOp.RainToggle, raining: true };
        send(socket, rainPkt);
      }

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
        bodyId: session.deadUntil !== 0 ? CASPER_BODY : session.visibleBodyId,
        headId: computeVisibleHead(session),
        graphic: 0,
        criminal: isCriminal(session),
        faction: session.faction,
        guild: session.guildName ?? undefined,
        role: session.role,
        level: session.level,
        classId: session.classId,
        dead: session.deadUntil !== 0 || undefined,
        invisible: session.invisibleUntil > Date.now() || undefined,
        meditating: session.meditating || undefined,
        ...computeVisibleEquip(session),
      };
      broadcastToMap(map.id, spawn, session.id);

      sendStatsUpdate(session);
      sendGameConfig(session); // sincroniza cooldowns del cliente con el panel
      sendInventoryUpdate(session);
      sendSpellsKnown(session);
      sendQuestState(session);

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
