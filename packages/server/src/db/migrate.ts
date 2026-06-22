import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

async function main(): Promise<void> {
  console.log("[migrate] aplicando migraciones de drizzle/");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] OK");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] fallo:", err);
  process.exit(1);
});
