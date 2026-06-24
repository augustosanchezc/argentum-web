ALTER TABLE "characters" ADD COLUMN "map_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "pos_x" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "pos_y" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "direction" varchar(8) DEFAULT 'south' NOT NULL;