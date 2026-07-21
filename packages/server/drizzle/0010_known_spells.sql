-- Sistema de pergaminos: hechizos aprendidos por el personaje (ids de AO_SPELLS).
-- NULLABLE a propósito: NULL = personaje anterior al sistema (al loguear hereda
-- su libro por nivel); '[]' = personaje nuevo que arranca sin hechizos y los
-- aprende usando pergaminos (objType 24). IF NOT EXISTS = idempotente.
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "known_spells" jsonb;
