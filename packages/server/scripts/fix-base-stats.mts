// Normaliza los atributos base de los personajes a las bases REALES de AO Libre
// (18 + MODRAZA por raza), reemplazando los defaults viejos "inventados"
// (str18/agi13/int12/con17/car8, que venían de la clase, no de la raza).
// Sólo toca personajes que aún tienen ESA firma exacta -> no pisa progresión
// (chars con puntos asignados como Clok id4 no matchean y quedan intactos).
import { db } from "../src/db/index.js";
import { characters } from "../src/db/schema/characters.js";
import { raceAttributes } from "@ao/shared";
import { and, eq } from "drizzle-orm";

const OLD = { str: 18, agi: 13, int_: 12, con: 17, car: 8 };
const rows = await db.select({ id: characters.id, name: characters.name, race: characters.race }).from(characters);
let fixed = 0;
for (const c of rows) {
  const a = raceAttributes(c.race);
  const res = await db.update(characters)
    .set({ str: a.str, agi: a.agi, int_: a.int, con: a.con, car: a.car })
    .where(and(
      eq(characters.id, c.id),
      eq(characters.str, OLD.str), eq(characters.agi, OLD.agi),
      eq(characters.int_, OLD.int_), eq(characters.con, OLD.con), eq(characters.car, OLD.car),
    ))
    .returning({ id: characters.id });
  if (res.length > 0) { fixed++; }
}
console.log(`FIXED=${fixed}/${rows.length} (bases AO Libre por raza)`);
process.exit(0);
