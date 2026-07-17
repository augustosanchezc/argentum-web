// AO Libre: los atributos son fijos, no hay puntos de atributo por nivel.
// Ponemos en 0 los stat_points sobrantes de personajes previos.
import { db } from "../src/db/index.js";
import { characters } from "../src/db/schema/characters.js";
import { ne } from "drizzle-orm";
const res = await db.update(characters).set({ statPoints: 0 }).where(ne(characters.statPoints, 0)).returning({ id: characters.id });
console.log(`ZEROED stat_points en ${res.length} personajes`);
process.exit(0);
