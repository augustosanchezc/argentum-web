-- Banco de personaje (E-4.2): inventario y oro guardados en el banco.
ALTER TABLE "characters" ADD COLUMN "bank_inventory" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "characters" ADD COLUMN "bank_gold" integer NOT NULL DEFAULT 0;
