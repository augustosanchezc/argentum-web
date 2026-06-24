import type { AnyPacket } from "@ao/shared";
import { encode } from "./codec.js";
import { sessions, type Session } from "./sessions.js";

// Envia un paquete a todas las sesiones del mapa indicado.
// Si se pasa `exceptSessionId`, se omite esa sesion (tipico:
// broadcast de un movimiento al resto, no al que se movio).
export function broadcastToMap(
  mapId: number,
  packet: AnyPacket,
  exceptSessionId?: string,
): void {
  const buf = encode(packet);
  for (const s of sessions.inMap(mapId)) {
    if (exceptSessionId !== undefined && s.id === exceptSessionId) continue;
    sendBuf(s, buf);
  }
}

function sendBuf(session: Session, buf: Buffer): void {
  try {
    session.socket.send(buf);
  } catch {
    // El cleanup en 'close' se ocupa de removerlo del registro.
  }
}
