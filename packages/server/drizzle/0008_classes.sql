-- Fase 5: clases de personaje, stats primarios, maná, cascos y escudos

ALTER TABLE "characters"
  ADD COLUMN "class_id"        integer NOT NULL DEFAULT 1,
  ADD COLUMN "mana"            integer NOT NULL DEFAULT 0,
  ADD COLUMN "max_mana"        integer NOT NULL DEFAULT 0,
  ADD COLUMN "str"             integer NOT NULL DEFAULT 18,
  ADD COLUMN "agi"             integer NOT NULL DEFAULT 13,
  ADD COLUMN "int"             integer NOT NULL DEFAULT 12,
  ADD COLUMN "con"             integer NOT NULL DEFAULT 17,
  ADD COLUMN "car"             integer NOT NULL DEFAULT 8,
  ADD COLUMN "stat_points"     integer NOT NULL DEFAULT 0,
  ADD COLUMN "equipped_helmet" integer,
  ADD COLUMN "equipped_shield" integer;
