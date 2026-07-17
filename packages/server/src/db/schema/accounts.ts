import { pgTable, serial, varchar, timestamp, index, integer } from "drizzle-orm/pg-core";

export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: varchar("password_hash", { length: 100 }).notNull(),
    // Privilegios (jerarquía del AO): 0 jugador · 1 Consejero · 2 Semidiós ·
    // 3 Dios/Admin. Los GMs (role > 0) tienen comandos in-game; el panel de
    // administración exige role 3 para mutaciones.
    role: integer("role").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("accounts_email_idx").on(table.email),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
