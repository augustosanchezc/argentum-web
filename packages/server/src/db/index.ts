import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import { env } from "../config/env.js";
import * as accounts from "./schema/accounts.js";

const { Pool } = pkg;

const schema = { ...accounts };

export const pool = new Pool({
  connectionString: env.database.url,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Db = typeof db;
export { schema };
