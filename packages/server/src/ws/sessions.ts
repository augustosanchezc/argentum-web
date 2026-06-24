import type { Vector2 } from "@ao/shared";
import type { WebSocket } from "ws";

export interface Session {
  readonly id: string;
  readonly accountId: number;
  readonly characterId: number;
  readonly characterName: string;
  readonly socket: WebSocket;
  mapId: number;
  position: Vector2;
  joinedAt: number;
  lastSeenAt: number;
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
      joinedAt: now,
      lastSeenAt: now,
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

  all(): IterableIterator<Session> {
    return this.bySessionId.values();
  }

  size(): number {
    return this.bySessionId.size;
  }
}

export const sessions = new SessionRegistry();
