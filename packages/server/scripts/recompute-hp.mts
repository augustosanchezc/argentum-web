// Recalcula maxHp/maxMana de todos los personajes con la fórmula real de AO Libre
// (ModVida por nivel). El HP viejo estaba guardado con la fórmula lineal anterior.
import { db } from "../src/db/index.js";
import { characters } from "../src/db/schema/characters.js";
import { getClass, calcMaxHp, calcMaxMp } from "@ao/shared";
import { eq } from "drizzle-orm";
const rows = await db.select().from(characters);
let n = 0;
for (const c of rows) {
  const cls = getClass(c.classId);
  if (!cls) continue;
  const maxHp = calcMaxHp(cls, c.level, c.con);
  const maxMana = calcMaxMp(cls, c.level, c.int_);
  await db.update(characters)
    .set({ maxHp, maxMana, hp: Math.min(c.hp, maxHp), mana: Math.min(c.mana, maxMana) })
    .where(eq(characters.id, c.id));
  n++;
}
console.log(`RECOMPUTED maxHp/maxMana en ${n} personajes`);
process.exit(0);
