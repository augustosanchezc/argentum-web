import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { loadedMapIds } from "./world/maps.js";
import { npcs } from "./world/npcs.js";
import { createGameLoop } from "./ws/loop.js";

async function main(): Promise<void> {
  const app = await buildApp();

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
