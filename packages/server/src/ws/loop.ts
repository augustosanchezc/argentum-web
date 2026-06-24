import { sessions } from "./sessions.js";

const TICK_MS = 100;

export interface GameLoop {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  ticks: () => number;
}

export function createGameLoop(logger: { info: (msg: string) => void }): GameLoop {
  let timer: NodeJS.Timeout | null = null;
  let tickCount = 0;
  let lastReport = 0;

  function tick(): void {
    tickCount += 1;
    // Stub de tick: aqui entra la logica de movimiento, combate y broadcast
    // en T-022 completo. Por ahora solo cuenta y loggea cada 10s.
    if (Date.now() - lastReport > 10_000) {
      logger.info(`[loop] tick ${tickCount} | sesiones activas: ${sessions.size()}`);
      lastReport = Date.now();
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
