ALTER TABLE "characters" ADD COLUMN "gold" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "inventory" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "equipped_weapon" integer;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "equipped_armor" integer;