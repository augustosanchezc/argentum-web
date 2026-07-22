import { integer, pgTable, serial, smallint, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Clanes (modGuilds.bas — núcleo: fundar, miembros, chat, tag).
export const guilds = pgTable(
  "guilds",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 32 }).notNull(),
    leaderId: integer("leader_id").notNull(),
    // Facción del clan, fijada al fundar (según el estado del fundador): no se
    // pueden mezclar ciudadanos y criminales. 0 = ciudadano · 1 = criminal.
    faction: smallint("faction").notNull().default(0),
    // Descripción y reglas editables por el líder (se muestran en el popup).
    description: text("description").notNull().default(""),
    rules: text("rules").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameLowerUniq: uniqueIndex("guilds_name_lower_uniq").on(sql`lower(${table.name})`),
  }),
);

export type Guild = typeof guilds.$inferSelect;
