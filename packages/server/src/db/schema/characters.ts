import {
  pgTable,
  serial,
  varchar,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { InventorySlot } from "@ao/shared";
import { accounts } from "./accounts";

export const characters = pgTable(
  "characters",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 32 }).notNull(),
    // Clase del personaje (1=Guerrero, 2=Mago, 3=Clérigo, 4=Arquero, 5=Asesino, 6=Druida)
    classId: integer("class_id").notNull().default(1),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    // HP / MP
    hp: integer("hp").notNull().default(30),
    maxHp: integer("max_hp").notNull().default(30),
    mana: integer("mana").notNull().default(0),
    maxMana: integer("max_mana").notNull().default(0),
    // Stats primarios (inicializados según la clase al crear)
    str: integer("str").notNull().default(18),
    agi: integer("agi").notNull().default(13),
    int_: integer("int").notNull().default(12),
    con: integer("con").notNull().default(17),
    car: integer("car").notNull().default(8),
    // Puntos de stat sin asignar (3 por nivel)
    statPoints: integer("stat_points").notNull().default(0),
    // Economía e inventario
    gold: integer("gold").notNull().default(100),
    inventory: jsonb("inventory")
      .$type<InventorySlot[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Slots de equipo: arma, armadura, casco, escudo
    equippedWeapon: integer("equipped_weapon"),
    equippedArmor: integer("equipped_armor"),
    equippedHelmet: integer("equipped_helmet"),
    equippedShield: integer("equipped_shield"),
    mapId: integer("map_id").notNull().default(1),
    posX: integer("pos_x").notNull().default(25),
    posY: integer("pos_y").notNull().default(25),
    direction: varchar("direction", { length: 8 }).notNull().default("south"),
    // Sprite del personaje (Personajes.ind / Cabezas.ind del AO original)
    bodyId: integer("body_id").notNull().default(1),
    headId: integer("head_id").notNull().default(1),
    // Banco (E-4.2)
    bankInventory: jsonb("bank_inventory")
      .$type<InventorySlot[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    bankGold: integer("bank_gold").notNull().default(0),
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
