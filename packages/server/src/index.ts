import { eq, sql } from "drizzle-orm";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { initSentry } from "./sentry.js";
import { db, pool } from "./db/index.js";
import { accounts } from "./db/schema/accounts.js";
import { loadedMapIds } from "./world/maps.js";
import { npcs } from "./world/npcs.js";
import { createGameLoop } from "./ws/loop.js";
import { flushAllSessions } from "./ws/index.js";
import { applyStoredTeleports } from "./world/teleports.js";
import { applyStoredBlocks } from "./world/blocked-tiles.js";

async function main(): Promise<void> {
  // Sentry debe inicializarse antes de construir la app para capturar errores
  // de arranque. Sin DSN configurado, no hace nada.
  initSentry();
  const app = await buildApp();

  // Bootstrap del primer admin: ADMIN_EMAIL se promueve a Dios (role 3).
  if (env.adminEmail) {
    const updated = await db
      .update(accounts)
      .set({ role: 3 })
      .where(eq(sql`lower(${accounts.email})`, env.adminEmail.toLowerCase()))
      .returning({ id: accounts.id });
    if (updated.length > 0) {
      app.log.info({ email: env.adminEmail }, "[ao-server] admin promovido a Dios (role 3)");
    }
  }

  // Log de mapas cargados (útil para saber qué mapas están disponibles y
  // cuáles hay que descargar con scripts/fetch-maps.mjs).
  app.log.info({ maps: loadedMapIds() }, "[ao-server] mapas cargados");

  // Re-aplicar los teleports creados por GM (persistidos en el volumen) sobre los
  // mapas recién cargados, para que sobrevivan a los reinicios.
  const tps = applyStoredTeleports();
  if (tps > 0) app.log.info({ teleports: tps }, "[ao-server] teleports de GM re-aplicados");

  // Re-aplicar los tiles bloqueados por GM (/blockpiso), también persistidos.
  const blks = applyStoredBlocks();
  if (blks > 0) app.log.info({ blocks: blks }, "[ao-server] tiles bloqueados de GM re-aplicados");

  // Crea las instancias de NPC del mundo antes de arrancar el loop.
  npcs.init();

  const loop = createGameLoop({ info: (msg) => app.log.info(msg) });
  loop.start();

  let closing = false;
  const close = async (signal: string): Promise<void> => {
    // Reentrancia: un segundo SIGTERM/SIGINT no debe disparar otro flush ni
    // cerrar la DB dos veces (haría fallar el flush en curso).
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "[ao-server] cierre solicitado");
    // Watchdog: si el flush/cierre se cuelga, salimos igual antes de que el
    // orquestador mande SIGKILL (grace 30s) — así no quedamos colgados. unref()
    // para que este timer no mantenga vivo el proceso si el cierre va bien.
    const watchdog = setTimeout(() => {
      app.log.error("[ao-server] cierre excedió el tiempo límite; saliendo");
      process.exit(1);
    }, 25_000);
    watchdog.unref();
    // Cortar el game loop primero (frena mutaciones del mundo: IA, regen) y
    // guardar el progreso de TODOS los conectados ANTES de cerrar la DB: sin
    // esto, cada deploy (SIGTERM) perdía lo hecho desde el último autosave.
    loop.stop();
    try {
      await flushAllSessions();
      app.log.info("[ao-server] progreso de sesiones guardado");
    } catch (err) {
      app.log.error({ err }, "[ao-server] error guardando sesiones en el cierre");
    }
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void close("SIGINT"));
  process.on("SIGTERM", () => void close("SIGTERM"));

  await app.listen({ host: env.server.host, port: env.server.port });
}

main().catch((err) => {
  console.error("[ao-server] arranque fallido:", err);
  process.exit(1);
});
