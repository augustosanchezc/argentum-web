import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";
import { npcs } from "./world/npcs.js";
import { createGameLoop } from "./ws/loop.js";

async function main(): Promise<void> {
  const app = await buildApp();

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
