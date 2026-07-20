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

  // Crea las instancias de NPC del mundo antes de arrancar el loop.
  npcs.init();

  const loop = createGameLoop({ info: (msg) => app.log.info(msg) });
  loop.start();

  const close = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "[ao-server] cierre solicitado");
    loop.stop();
    // Guardar el progreso de TODOS los conectados ANTES de cerrar la DB: sin
    // esto, cada deploy (SIGTERM) perdía lo hecho desde el último autosave.
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
