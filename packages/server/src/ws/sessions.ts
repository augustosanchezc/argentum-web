import type { Direction, InventorySlot, Vector2 } from "@ao/shared";
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
  joinedAt: number;
  lastSeenAt: number;
  // Clase y stats primarios
  classId: number;
  str: number;
  agi: number;
  int_: number;
  con: number;
  car: number;
  statPoints: number;
  // HP / MP
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  lastAttackAt: number;
  deadUntil: number;
  // Economía e inventario
  gold: number;
  inventory: InventorySlot[];
  equippedWeapon: number | null;
  equippedArmor: number | null;
  equippedHelmet: number | null;
  equippedShield: number | null;
  // Derivados del equipo (se recalculan al equipar/loguear)
  weaponBonus: number;
  armorDefense: number;
  helmetDefense: number;
  shieldDefense: number;
  // Sprite (Personajes.ind / Cabezas.ind del AO)
  bodyId: number;
  headId: number;
  // Banco (E-4.2)
  bankInventory: InventorySlot[];
  bankGold: number;
  // Party (E-4.3)
  partyId: string | null;
  // Trade (E-4.4)
  tradeId: string | null;
}

class SessionRegistry {
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
      joinedAt: now,
      lastSeenAt: now,
      classId: 1,
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
      lastAttackAt: 0,
      deadUntil: 0,
      gold: 0,
      inventory: [],
      equippedWeapon: null,
      equippedArmor: null,
      equippedHelmet: null,
      equippedShield: null,
      weaponBonus: 0,
      armorDefense: 0,
      helmetDefense: 0,
      shieldDefense: 0,
      bodyId: 1,
      headId: 1,
      bankInventory: [],
      bankGold: 0,
      partyId: null,
      tradeId: null,
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
