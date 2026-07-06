import type { Direction, InventorySlot, Vector2 } from "@ao/shared";
import type { WebSocket } from "ws";

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
  // Combate (E-2.2). hp/maxHp se cargan de la DB en el handshake.
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  lastAttackAt: number;
  // 0 = vivo. Si > 0, es el epoch ms en que el personaje debe reaparecer.
  deadUntil: number;
  // Economía e inventario (E-3.2/3.4).
  gold: number;
  inventory: InventorySlot[];
  equippedWeapon: number | null;
  equippedArmor: number | null;
  // Derivados del equipo (se recalculan al equipar/loguear).
  weaponBonus: number;
  armorDefense: number;
  // Sprite del personaje (Personajes.ind / Cabezas.ind del AO). Se persisten
  // en characters.body_id / head_id; hasta que haya customización visual,
  // todos los personajes usan body 1 y head 1 (aventurero humano clásico).
  bodyId: number;
  headId: number;
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
    // Si el mismo personaje ya tenia sesion, la cerramos antes de abrir la nueva.
    // Politica: una sesion activa por personaje. La conexion anterior queda
    // huerfana — el cliente vera el close 4008 y debera reconectar.
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
      level: 1,
      xp: 0,
      hp: 30,
      maxHp: 30,
      lastAttackAt: 0,
      deadUntil: 0,
      gold: 0,
      inventory: [],
      equippedWeapon: null,
      equippedArmor: null,
      weaponBonus: 0,
      armorDefense: 0,
      bodyId: 1,
      headId: 1,
    };
    this.bySessionId.set(id, session);
    this.byCharacterId.set(characterId, session);
    return session;
  }

  remove(sessionId: string): void {
    const s = this.bySessionId.get(sessionId);
    if (!s) return;
    this.bySessionId.delete(sessionId);
    this.byCharacterId.delete(s.characterId);
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
