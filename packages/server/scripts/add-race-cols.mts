import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";
await db.execute(sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS race integer NOT NULL DEFAULT 1`);
await db.execute(sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS gender integer NOT NULL DEFAULT 1`);
const r = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='characters' AND column_name IN ('race','gender') ORDER BY column_name`);
console.log("COLS=" + r.rows.map((x: {column_name: string}) => x.column_name).join(","));
process.exit(0);
