import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { InventorySlot, SkillSet } from "@ao/shared";
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
    // Raza (1=Humano, 2=Elfo, 3=Elfo Oscuro/Drow, 4=Gnomo, 5=Enano) y
    // género (1=Hombre, 2=Mujer). Definen atributos base, cabeza y cuerpo.
    race: integer("race").notNull().default(1),
    gender: integer("gender").notNull().default(1),
    // Descripción del personaje (se ve al hacer click sobre él; se setea con /desc).
    description: text("description").notNull().default(""),
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
    // Hambre y sed (0-100). En 0 se corta la regeneración (AO original).
    hunger: integer("hunger").notNull().default(100),
    thirst: integer("thirst").notNull().default(100),
    // Skills por uso (21 skills del AO, 0-100) + XP parcial de cada una.
    skills: jsonb("skills")
      .$type<Partial<SkillSet>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    skillsXp: jsonb("skills_xp")
      .$type<Partial<Record<string, number>>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Hechizos aprendidos (ids de AO_SPELLS), aprendidos con pergaminos. Es
    // NULLABLE a propósito: NULL = personaje previo al sistema de pergaminos
    // (se hereda su libro por nivel al loguear); [] = personaje nuevo que
    // arranca sin hechizos y los aprende con pergaminos.
    knownSpells: jsonb("known_spells").$type<number[]>(),
    // Misiones activas (con progreso de kills) y completadas.
    quests: jsonb("quests")
      .$type<Array<{ id: number; kills: number[] }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    questsDone: jsonb("quests_done")
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Facciones (ModFacciones.bas): 0 = ninguna, 1 = Armada Real, 2 = Legión
    // Oscura. Los contadores de kills PvP definen el ingreso y los rangos.
    faction: integer("faction").notNull().default(0),
    // Clan al que pertenece (null = sin clan).
    guildId: integer("guild_id"),
    citizensKilled: integer("citizens_killed").notNull().default(0),
    criminalsKilled: integer("criminals_killed").notNull().default(0),
    // Lista de amigos (nombres de personaje, máx. 50 como el AO).
    friends: jsonb("friends")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Config de la barra de macros del cliente (array opaco de slots).
    macros: jsonb("macros")
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
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
    // Muerto (fantasma). Sin esto, un F5 estando muerto revivía gratis con
    // vida completa en el mismo tile (el estado de muerte no se persistía).
    dead: boolean("dead").notNull().default(false),
    // Navegando (en barco) + body del barco. Sin esto, desconectarse en el
    // agua "invalidaba" la posición y te teletransportaba a Ullathorpe.
    navigating: boolean("navigating").notNull().default(false),
    boatBody: integer("boat_body").notNull().default(0),
    // Sistema de fianzas: crímenes perdonados (criminal = citizensKilled >
    // pardonedKills) y cantidad de fianzas pagadas (precio Fibonacci).
    pardonedKills: integer("pardoned_kills").notNull().default(0),
    bailsPaid: integer("bails_paid").notNull().default(0),
    // Recompensas de facción ya cobradas (índice en la tabla de premios).
    factionRewards: integer("faction_rewards").notNull().default(0),
    // Tipo de flecha equipado (munición elegida del arquero).
    equippedArrow: integer("equipped_arrow"),
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
