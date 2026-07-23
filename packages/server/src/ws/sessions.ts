import { emptySkills, type Direction, type InventorySlot, type SkillKey, type SkillSet, type Vector2 } from "@ao/shared";
import type { WebSocket } from "ws";
import { connectedPlayers } from "../metrics.js";

export interface Session {
  readonly id: string;
  readonly accountId: number;
  readonly characterId: number;
  readonly characterName: string;
  readonly socket: WebSocket;
  mapId: number;
  position: Vector2;
  direction: Direction;
  lastMoveAt: number;
  lastChatAt: number;
  // Rate-limit de SaveMacros (escrituras jsonb a la DB).
  lastMacroSaveAt: number;
  // true = esta sesión fue reemplazada por un relogin del mismo personaje:
  // su handler de close NO debe despawnear/persistir (la nueva es la dueña).
  superseded: boolean;
  joinedAt: number;
  lastSeenAt: number;
  // Clase, raza, género y stats primarios
  classId: number;
  race: number;
  gender: number;
  // Descripción del personaje (se ve al hacer click sobre él; se setea con /desc).
  description: string;
  // Skills por uso (21 skills del AO, 0-100) + XP parcial hacia el próximo punto.
  skills: SkillSet;
  skillsXp: Partial<Record<SkillKey, number>>;
  // Hechizos aprendidos (ids de AO_SPELLS). Se aprenden usando pergaminos
  // (objType 24) y quedan persistidos en el personaje.
  knownSpells: number[];
  str: number;
  agi: number;
  int_: number;
  con: number;
  car: number;
  statPoints: number;
  // HP / MP / Energía (stamina del AO)
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  sta: number;
  maxSta: number;
  lastAttackAt: number;
  // Momento del último casteo (para los intervalos golpe-magia del AO).
  lastCastAt: number;
  // Momento del último uso de item (IntervaloUserPuedeUsar, 125ms).
  lastUseAt: number;
  // Momento en que se tomó la última poción. En el AO el cooldown de pociones
  // (IntervaloGolpeUsar 1200ms) es un timer compartido: se refresca al golpear
  // Y al tomar cada poción → 1 poción cada 1200ms (no 125ms).
  lastPotionAt: number;
  // Trabajos: último golpe de trabajo (IntervaloTrabajo 850ms).
  lastWorkAt: number;
  // Descansando junto a una fogata (regen acelerada; moverse lo corta).
  resting: boolean;
  // Seguro /SEG: con true no se puede atacar ciudadanos.
  safeOn: boolean;
  // GM: /eliminarnpc armado — el próximo click a un vendedor lo elimina.
  armedDeleteNpc: boolean;
  // Navegación: en barco (body = barco, solo se mueve por agua).
  navigating: boolean;
  boatBody: number;
  // Muerto: 0 = vivo. Los jugadores NO auto-reviven (fantasma del AO):
  // reviven por sacerdote o llegando al hogar.
  deadUntil: number;
  // Fianzas: crímenes perdonados (criminal = citizensKilled > pardonedKills)
  // y fianzas pagadas (el precio crece por Fibonacci).
  pardonedKills: number;
  bailsPaid: number;
  // Recompensas de facción ya cobradas (índice en FACTION_REWARDS).
  factionRewards: number;
  // Ocultarse (skill): true mientras está escondido — caminar lo rompe
  // (salvo Asesino con armadura de Asesino). Distinto de la invisibilidad
  // por hechizo (que no se rompe al caminar).
  hiding: boolean;
  // Viaje al hogar (goHome): epoch ms de llegada (0 = sin viaje).
  homeTravelUntil: number;
  // Salir del juego (/salir): epoch ms en que se completa la salida (0 = no está
  // saliendo). En zona insegura hay una cuenta regresiva; se cancela si se mueve,
  // ataca o recibe daño (anti combat-log del AO).
  quitAt: number;
  // Silenciado por un GM (/silenciar): epoch ms hasta cuándo no puede hablar.
  silencedUntil: number;
  // IP del cliente (para /banip). Se setea al crear la sesión desde req.ip.
  ip: string;
  // Economía e inventario
  gold: number;
  inventory: InventorySlot[];
  equippedWeapon: number | null;
  equippedArmor: number | null;
  equippedHelmet: number | null;
  equippedShield: number | null;
  // Tipo de flecha "equipado" (munición elegida). null = usar la primera.
  equippedArrow: number | null;
  // Derivados del equipo (se recalculan al equipar/loguear)
  weaponBonus: number;
  armorDefense: number;
  helmetDefense: number;
  shieldDefense: number;
  // Sprite (Personajes.ind / Cabezas.ind del AO)
  bodyId: number;   // body base del personaje (sin ropa)
  headId: number;
  // Body visible: el NumRopaje de la armadura equipada, o bodyId si está
  // desnudo. Se recalcula al equipar/desequipar y se broadcastea el cambio.
  visibleBodyId: number;
  // Banco (E-4.2)
  bankInventory: InventorySlot[];
  bankGold: number;
  // Party (E-4.3)
  partyId: string | null;
  // Trade (E-4.4)
  tradeId: string | null;
  // Habilidades
  lastSkillAt: number;
  // Meditación (recupera maná acelerado; se corta al moverse/atacar/recibir daño)
  meditating: boolean;
  // Estados alterados (epoch ms de expiración, 0 = inactivo):
  // paralizado: no camina ni pega (puede castear — Remover Parálisis).
  // inmovilizado: no camina. invisible: los demás no lo ven.
  paralyzedUntil: number;
  immobilizedUntil: number;
  invisibleUntil: number;
  blindUntil: number;
  dumbUntil: number;
  // Hambre y sed (0-100). En 0 se corta la regeneración (AO original).
  hunger: number;
  thirst: number;
  // Acumuladores de regeneración (ms), modelo del AO: cada efecto tiene su
  // propio contador que dispara al superar su intervalo (Sanar/RecStamina/
  // HambreYSed/Meditar). Ver world/regen.ts.
  regenCounters: { hp: number; sta: number; agua: number; com: number; med: number };
  // Drogas / hechizos de buff: bonus temporal de STR (Fuerza / Poción Verde)
  // y AGI (Celeridad / Poción Amarilla). buffUntil = epoch ms de expiración.
  strBonus: number;
  agiBonus: number;
  buffUntil: number;
  // Misiones (Quests.DAT): activas con progreso + completadas.
  quests: Array<{ id: number; kills: number[] }>;
  questsDone: number[];
  // Facciones: 0 ninguna · 1 Armada Real · 2 Legión Oscura.
  faction: number;
  citizensKilled: number;
  criminalsKilled: number;
  // Clan (modGuilds.bas — núcleo): id y nombre, más invitación pendiente.
  guildId: number | null;
  guildName: string | null;
  // Rango en el clan: 0 = miembro · 1 = oficial (otorgado por el líder).
  guildRank: number;
  guildInvite: { guildId: number; guildName: string; from: string } | null;
  // Amigos (nombres, máx. 50 como el AO).
  friends: string[];
  // Privilegios de la cuenta (0 jugador · 1 Consejero · 2 Semidiós · 3 Dios).
  role: number;
  // Equitación (DoEquita): montado + body de la montura + espera tras desmontar.
  mounted: boolean;
  mountBody: number;
  mountCooldownUntil: number;
  // Overlays de equipo visibles (Armas/Escudos/Cascos — 0 = ninguno).
  visibleWeaponAnim: number;
  visibleShieldAnim: number;
  visibleHelmetAnim: number;
  // Sistema criminal
  criminalUntil: number;
}

export class SessionRegistry {
  private readonly bySessionId = new Map<string, Session>();
  private readonly byCharacterId = new Map<number, Session>();
  private nextId = 1;

  create(
    accountId: number,
    characterId: number,
    characterName: string,
    socket: WebSocket,
    mapId: number,
    position: Vector2,
  ): Session {
    const existing = this.byCharacterId.get(characterId);
    if (existing) {
      // La sesión vieja queda "superseded": su close NO despawnea (borraría la
      // entidad del personaje recién logueado) ni persiste (pisaría con estado
      // stale lo que el handshake ya persistió/leyó).
      existing.superseded = true;
      this.remove(existing.id);
      try {
        existing.socket.close(4008, "REPLACED_BY_NEWER_SESSION");
      } catch {
        // ignore
      }
    }

    const id = `s${this.nextId++}_${Date.now().toString(36)}`;
    const now = Date.now();
    const session: Session = {
      id,
      accountId,
      characterId,
      characterName,
      socket,
      mapId,
      position: { x: position.x, y: position.y },
      direction: "south",
      lastMoveAt: 0,
      lastChatAt: 0,
      lastMacroSaveAt: 0,
      superseded: false,
      joinedAt: now,
      lastSeenAt: now,
      classId: 1,
      race: 1,
      gender: 1,
      description: "",
      skills: emptySkills(),
      skillsXp: {},
      knownSpells: [],
      str: 18,
      agi: 13,
      int_: 12,
      con: 17,
      car: 8,
      statPoints: 0,
      level: 1,
      xp: 0,
      hp: 30,
      maxHp: 30,
      mana: 0,
      maxMana: 0,
      sta: 100,
      maxSta: 100,
      lastAttackAt: 0,
      lastCastAt: 0,
      lastUseAt: 0,
      lastPotionAt: 0,
      lastWorkAt: 0,
      resting: false,
      safeOn: true,
      armedDeleteNpc: false,
      navigating: false,
      boatBody: 0,
      deadUntil: 0,
      pardonedKills: 0,
      bailsPaid: 0,
      factionRewards: 0,
      hiding: false,
      homeTravelUntil: 0,
      quitAt: 0,
      silencedUntil: 0,
      ip: "",
      gold: 0,
      inventory: [],
      equippedWeapon: null,
      equippedArmor: null,
      equippedHelmet: null,
      equippedShield: null,
      equippedArrow: null,
      weaponBonus: 0,
      armorDefense: 0,
      helmetDefense: 0,
      shieldDefense: 0,
      bodyId: 1,
      headId: 1,
      visibleBodyId: 1,
      bankInventory: [],
      bankGold: 0,
      partyId: null,
      tradeId: null,
      lastSkillAt: 0,
      meditating: false,
      paralyzedUntil: 0,
      immobilizedUntil: 0,
      invisibleUntil: 0,
      blindUntil: 0,
      dumbUntil: 0,
      hunger: 100,
      thirst: 100,
      regenCounters: { hp: 0, sta: 0, agua: 0, com: 0, med: 0 },
      strBonus: 0,
      agiBonus: 0,
      buffUntil: 0,
      quests: [],
      questsDone: [],
      faction: 0,
      citizensKilled: 0,
      criminalsKilled: 0,
      guildId: null,
      guildName: null,
      guildRank: 0,
      guildInvite: null,
      friends: [],
      role: 0,
      mounted: false,
      mountBody: 0,
      mountCooldownUntil: 0,
      visibleWeaponAnim: 0,
      visibleShieldAnim: 0,
      visibleHelmetAnim: 0,
      criminalUntil: 0,
    };
    this.bySessionId.set(id, session);
    this.byCharacterId.set(characterId, session);
    connectedPlayers.inc();
    return session;
  }

  remove(sessionId: string): void {
    const s = this.bySessionId.get(sessionId);
    if (!s) return;
    this.bySessionId.delete(sessionId);
    this.byCharacterId.delete(s.characterId);
    connectedPlayers.dec();
  }

  touch(sessionId: string): void {
    const s = this.bySessionId.get(sessionId);
    if (s) s.lastSeenAt = Date.now();
  }

  get(sessionId: string): Session | undefined {
    return this.bySessionId.get(sessionId);
  }

  getByCharacterId(characterId: number): Session | undefined {
    return this.byCharacterId.get(characterId);
  }

  all(): IterableIterator<Session> {
    return this.bySessionId.values();
  }

  inMap(mapId: number): Session[] {
    const out: Session[] = [];
    for (const s of this.bySessionId.values()) {
      if (s.mapId === mapId) out.push(s);
    }
    return out;
  }

  size(): number {
    return this.bySessionId.size;
  }
}

export const sessions = new SessionRegistry();
