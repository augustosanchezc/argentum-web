import {
  ClientToServerOp,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AnyPacket,
  type EntityId,
  type LoginRequest,
  type LoginResponse,
} from "@ao/shared";
import { decode, encode } from "./codec";

export interface SessionCharacter {
  id: number;
  name: string;
  level: number;
}

const HANDSHAKE_TIMEOUT_MS = 6_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000];

export interface ConnectionResult {
  socket: WebSocket;
  character: NonNullable<LoginResponse["character"]>;
}

export interface ConnectOptions {
  token: string;
  characterId: number;
  onPacket: (packet: AnyPacket) => void;
  onClose: (event: CloseEvent) => void;
  url?: string;
}

export class WsClientError extends Error {
  constructor(
    public reason: string,
    public code?: number,
  ) {
    super(reason);
  }
}

function makeUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function connectWs(opts: ConnectOptions): Promise<ConnectionResult> {
  return new Promise((resolve, reject) => {
    const url = opts.url ?? makeUrl();
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    let settled = false;
    let handshakeDone = false;

    const handshakeTimer = window.setTimeout(() => {
      if (!handshakeDone) {
        settled = true;
        try {
          socket.close();
        } catch {
          // ignore
        }
        reject(new WsClientError("HANDSHAKE_TIMEOUT"));
      }
    }, HANDSHAKE_TIMEOUT_MS);

    socket.addEventListener("open", () => {
      const loginPacket: LoginRequest = {
        op: ClientToServerOp.LoginRequest,
        token: opts.token,
        characterId: opts.characterId as EntityId,
        clientVersion: PROTOCOL_VERSION,
      };
      socket.send(encode(loginPacket));
    });

    socket.addEventListener("message", (ev: MessageEvent<ArrayBuffer | Uint8Array>) => {
      let packet: AnyPacket;
      try {
        const data = ev.data instanceof ArrayBuffer ? ev.data : (ev.data as Uint8Array);
        packet = decode<AnyPacket>(data);
      } catch {
        return; // ignoramos paquetes malformados
      }

      if (!handshakeDone) {
        if (packet.op !== ServerToClientOp.LoginResponse) {
          return;
        }
        const resp = packet;
        if (!resp.ok || !resp.character) {
          handshakeDone = true;
          settled = true;
          window.clearTimeout(handshakeTimer);
          try {
            socket.close();
          } catch {
            // ignore
          }
          reject(new WsClientError(resp.reason ?? "LOGIN_REJECTED"));
          return;
        }
        handshakeDone = true;
        settled = true;
        window.clearTimeout(handshakeTimer);
        resolve({ socket, character: resp.character });
        return;
      }

      opts.onPacket(packet);
    });

    socket.addEventListener("close", (ev) => {
      window.clearTimeout(handshakeTimer);
      if (!settled) {
        settled = true;
        reject(new WsClientError(ev.reason || "CLOSED", ev.code));
        return;
      }
      opts.onClose(ev);
    });

    socket.addEventListener("error", () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(handshakeTimer);
        reject(new WsClientError("CONNECTION_ERROR"));
      }
    });
  });
}

export interface ReconnectingClientOptions {
  token: string;
  characterId: number;
  onPacket: (packet: AnyPacket) => void;
  onStatus: (status: ClientStatus) => void;
}

export type ClientStatus =
  | { kind: "connecting" }
  | { kind: "connected"; character: SessionCharacter }
  | { kind: "reconnecting"; attempt: number; nextDelayMs: number }
  | { kind: "failed"; reason: string };

export class ReconnectingClient {
  private socket: WebSocket | null = null;
  private attempts = 0;
  private destroyed = false;

  constructor(private readonly opts: ReconnectingClientOptions) {}

  async start(): Promise<void> {
    this.attempts = 0;
    await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return;
    this.opts.onStatus({ kind: "connecting" });
    try {
      const result = await connectWs({
        token: this.opts.token,
        characterId: this.opts.characterId,
        onPacket: this.opts.onPacket,
        onClose: (ev) => {
          this.handleClose(ev);
        },
      });
      this.socket = result.socket;
      const sessionChar: SessionCharacter = {
        id: result.character.id,
        name: result.character.name,
        level: result.character.level,
      };
      this.attempts = 0;
      this.opts.onStatus({ kind: "connected", character: sessionChar });
    } catch (err) {
      const reason = err instanceof WsClientError ? err.reason : "UNKNOWN_ERROR";
      // No reintentamos en errores de auth/permiso — son terminales.
      if (
        reason === "INVALID_TOKEN" ||
        reason === "OUTDATED_CLIENT" ||
        reason === "CHARACTER_NOT_FOUND" ||
        reason === "LOGIN_REJECTED" ||
        reason === "REPLACED_BY_NEWER_SESSION"
      ) {
        this.opts.onStatus({ kind: "failed", reason });
        return;
      }
      this.scheduleReconnect(reason);
    }
  }

  private handleClose(ev?: CloseEvent): void {
    this.socket = null;
    if (this.destroyed) return;
    // 4008 = otra pestaña/login tomó el personaje. NO reconectar: si no, las
    // dos pestañas se expulsan mutuamente en loop (ping-pong de kicks).
    if (ev?.code === 4008) {
      this.opts.onStatus({ kind: "failed", reason: "REPLACED_BY_NEWER_SESSION" });
      return;
    }
    this.scheduleReconnect("DISCONNECTED");
  }

  private scheduleReconnect(reason: string): void {
    if (this.destroyed) return;
    if (this.attempts >= RECONNECT_DELAYS_MS.length) {
      this.opts.onStatus({ kind: "failed", reason });
      return;
    }
    const delay = RECONNECT_DELAYS_MS[this.attempts] ?? 4_000;
    this.attempts += 1;
    this.opts.onStatus({ kind: "reconnecting", attempt: this.attempts, nextDelayMs: delay });
    window.setTimeout(() => {
      void this.connect();
    }, delay);
  }

  send(packet: AnyPacket): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(encode(packet));
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.socket) {
      try {
        this.socket.close(1000, "CLIENT_LEAVING");
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }
}
