import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accounts } from "./accounts";

export const characters = pgTable(
  "characters",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 32 }).notNull(),
    level: integer("level").notNull().default(1),
    // Stats de combate (E-2.2). Valores por defecto de nivel 1.
    hp: integer("hp").notNull().default(30),
    maxHp: integer("max_hp").notNull().default(30),
    mapId: integer("map_id").notNull().default(1),
    posX: integer("pos_x").notNull().default(25),
    posY: integer("pos_y").notNull().default(25),
    direction: varchar("direction", { length: 8 }).notNull().default("south"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameLowerUniq: uniqueIndex("characters_name_lower_uniq").on(sql`lower(${table.name})`),
    accountIdIdx: index("characters_account_id_idx").on(table.accountId),
  }),
);

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
