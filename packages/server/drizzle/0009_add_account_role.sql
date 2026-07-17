-- Agrega la columna `role` a `accounts`. Estaba en el esquema (accounts.ts)
-- pero nunca se generó su migración (en desarrollo se aplicó vía
-- `drizzle-kit push`), por lo que en producción —que solo corre migraciones—
-- la columna faltaba y el arranque del server fallaba al promover al admin.
-- `IF NOT EXISTS` la hace idempotente para bases ya parcheadas a mano.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "role" integer DEFAULT 0 NOT NULL;
