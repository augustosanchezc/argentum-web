import { ServerToClientOp, type EntityId, type Respawn } from "@ao/shared";
import { getMap } from "../world/maps.js";
import { broadcastToMap } from "./broadcast.js";
import { sessions } from "./sessions.js";

const TICK_MS = 100;

export interface GameLoop {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  ticks: () => number;
}

// Procesa las reapariciones (T-042): todo personaje muerto cuyo deadUntil
// ya venció revive en el spawn del mapa con HP al máximo, y se anuncia al
// resto con un paquete RESPAWN.
function processRespawns(now: number): void {
  for (const s of sessions.all()) {
    if (s.deadUntil === 0 || now < s.deadUntil) continue;

    const map = getMap(s.mapId);
    const spawn = map ? map.spawn : s.position;
    s.position = { x: spawn.x, y: spawn.y };
    s.hp = s.maxHp;
    s.deadUntil = 0;
    s.lastMoveAt = now;

    const respawn: Respawn = {
      op: ServerToClientOp.Respawn,
      id: s.characterId as EntityId,
      position: { x: s.position.x, y: s.position.y },
      hp: s.hp,
      maxHp: s.maxHp,
    };
    broadcastToMap(s.mapId, respawn);
  }
}

export function createGameLoop(logger: { info: (msg: string) => void }): GameLoop {
  let timer: NodeJS.Timeout | null = null;
  let tickCount = 0;
  let lastReport = 0;

  function tick(): void {
    tickCount += 1;
    const now = Date.now();

    processRespawns(now);

    if (now - lastReport > 10_000) {
      logger.info(`[loop] tick ${tickCount} | sesiones activas: ${sessions.size()}`);
      lastReport = now;
    }
  }

  return {
    start: () => {
      if (timer) return;
      lastReport = Date.now();
      timer = setInterval(tick, TICK_MS);
      logger.info(`[loop] arrancado a tick fijo ${TICK_MS}ms (10 Hz)`);
    },
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    isRunning: () => timer !== null,
    ticks: () => tickCount,
  };
}
