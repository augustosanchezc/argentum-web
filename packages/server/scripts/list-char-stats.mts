import { db } from "../src/db/index.js";
import { sql } from "drizzle-orm";
const r = await db.execute(sql`SELECT id, name, class_id, race, gender, level, str, agi, int, con, car, stat_points FROM characters ORDER BY id`);
for (const c of r.rows) console.log(JSON.stringify(c));
process.exit(0);
