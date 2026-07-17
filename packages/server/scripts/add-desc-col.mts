import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";
await db.execute(sql`ALTER TABLE characters ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT ''`);
const r = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='characters' AND column_name='description'`);
console.log("COL=" + r.rows.map((x: {column_name: string}) => x.column_name).join(","));
process.exit(0);
