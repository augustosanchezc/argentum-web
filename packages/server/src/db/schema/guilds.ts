import { integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Clanes (modGuilds.bas — núcleo: fundar, miembros, chat, tag).
export const guilds = pgTable(
  "guilds",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 32 }).notNull(),
    leaderId: integer("leader_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameLowerUniq: uniqueIndex("guilds_name_lower_uniq").on(sql`lower(${table.name})`),
  }),
);

export type Guild = typeof guilds.$inferSelect;
