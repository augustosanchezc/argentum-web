import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/index.js";

async function main(): Promise<void> {
  const app = await buildApp();

  const close = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "[ao-server] cierre solicitado");
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
