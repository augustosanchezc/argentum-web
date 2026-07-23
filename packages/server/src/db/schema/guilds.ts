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

// Solicitudes de ingreso a un clan (el jugador pide, el líder/oficial aprueba).
// Persistentes: sobreviven reinicios. Una por (clan, personaje).
export const guildRequests = pgTable(
  "guild_requests",
  {
    id: serial("id").primaryKey(),
    guildId: integer("guild_id").notNull(),
    characterId: integer("character_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniq: uniqueIndex("guild_requests_guild_char_uniq").on(table.guildId, table.characterId),
  }),
);

export type GuildRequest = typeof guildRequests.$inferSelect;
