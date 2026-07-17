import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

async function main(): Promise<void> {
  // Ruta relativa al archivo (no al CWD): funciona igual en dev (src/db) y en
  // el contenedor (dist/db), donde el CWD puede ser /app.
  const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle");
  console.log(`[migrate] aplicando migraciones de ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] OK");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] fallo:", err);
  process.exit(1);
});
