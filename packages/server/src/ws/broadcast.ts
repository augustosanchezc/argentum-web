import {
  ServerToClientOp,
  type AnyPacket,
  type Death,
  type EntityAppearance,
  type EntityId,
  type MeditateUpdate,
  type Respawn,
} from "@ao/shared";
import { encode } from "./codec.js";
import { sessions, type Session } from "./sessions.js";
import { activeDots } from "../world/skills.js";

// Fantasma del AO (Declares.bas): iCuerpoMuerto = 8, iCabezaMuerto = 500.
export const CASPER_BODY = 8;
export const CASPER_HEAD = 500;
// Los jugadores muertos NO auto-reviven: sacerdote o viaje al hogar.
export const DEAD_FOREVER = Number.MAX_SAFE_INTEGER;

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

// Muerte del jugador (UserDie del AO): queda fantasma (body 8 / head 500),
// puede caminar, y solo revive con un sacerdote o llegando al hogar.
export function killPlayer(s: Session): void {
  s.hp = 0;
  s.sta = 0;
  s.deadUntil = DEAD_FOREVER;
  stopMeditating(s);
  // Al morir se pierde la montura (el fantasma camina a pie) y los
  // overlays de equipo (el casper va sin arma/escudo/casco). También se
  // corta la navegación y el descanso: revivir "navegando" en tierra te
  // dejaba clavado, y `resting` regeneraba a ritmo de fogata sin fogata.
  s.mounted = false;
  s.mountBody = 0;
  s.navigating = false;
  s.boatBody = 0;
  s.resting = false;
  s.visibleWeaponAnim = 0;
  s.visibleShieldAnim = 0;
  s.visibleHelmetAnim = 0;
  // Al morir se limpian todas las alteraciones de estado y buffs temporales
  // (parálisis, inmovilizar, invisibilidad, ceguera, estupidez, drogas) y el
  // veneno activo — como el AO, el muerto no arrastra efectos al revivir.
  s.paralyzedUntil = 0;
  s.immobilizedUntil = 0;
  s.invisibleUntil = 0;
  s.blindUntil = 0;
  s.dumbUntil = 0;
  s.strBonus = 0;
  s.agiBonus = 0;
  s.buffUntil = 0;
  activeDots.delete(s.characterId);
  const death: Death = { op: ServerToClientOp.Death, id: s.characterId as EntityId };
  broadcastToMap(s.mapId, death);
  const casper: EntityAppearance = {
    op: ServerToClientOp.EntityAppearance,
    id: s.characterId as EntityId,
    bodyId: CASPER_BODY,
    headId: CASPER_HEAD,
  };
  broadcastToMap(s.mapId, casper);
}

// Revive al jugador con el 100% de la vida (decisión de diseño; el AO
// original revivía con HP = Constitución), restaura la apariencia y cancela
// el viaje al hogar.
export function revivePlayer(s: Session): void {
  if (s.deadUntil === 0) return;
  s.deadUntil = 0;
  s.homeTravelUntil = 0;
  s.hp = s.maxHp;
  const respawn: Respawn = {
    op: ServerToClientOp.Respawn,
    id: s.characterId as EntityId,
    position: { x: s.position.x, y: s.position.y },
    hp: s.hp,
    maxHp: s.maxHp,
  };
  broadcastToMap(s.mapId, respawn);
  const appearance: EntityAppearance = {
    op: ServerToClientOp.EntityAppearance,
    id: s.characterId as EntityId,
    bodyId: s.visibleBodyId,
    headId: s.headId,
  };
  broadcastToMap(s.mapId, appearance);
}

// Corta la meditación (si estaba activa) y avisa al mapa. Se llama al
// moverse, atacar, recibir daño o lanzar una habilidad — como el AO original.
export function stopMeditating(s: Session): void {
  if (!s.meditating) return;
  s.meditating = false;
  const pkt: MeditateUpdate = {
    op: ServerToClientOp.MeditateUpdate,
    id: s.characterId as EntityId,
    meditating: false,
  };
  broadcastToMap(s.mapId, pkt);
}
