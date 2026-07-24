// Genera packages/shared/src/armor-stature.ts a partir de data/dat/obj.dat.
// Talla de armaduras del AO: las variantes "(E/G)" (RazaEnana=1) usan el body
// corto de Enano/Gnomo; el resto el body "alto". Un personaje solo equipa
// armaduras de su estatura. Uso: node packages/server/scripts/gen-armor-stature.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const objDat = path.join(here, "..", "data", "dat", "obj.dat");
const outFile = path.join(here, "..", "..", "shared", "src", "armor-stature.ts");

const txt = fs.readFileSync(objDat, "latin1");
const blocks = txt.split(/\r?\n(?=\[OBJ)/);
const enano = [];
for (const b of blocks) {
  const idm = b.match(/\[OBJ(\d+)\]/);
  if (!idm) continue;
  const get = (k) => {
    const m = b.match(new RegExp("^" + k + "=(.+)$", "im"));
    return m ? m[1].trim() : null;
  };
  if (get("ObjType") !== "3") continue; // solo armaduras (ropaje)
  if ((get("RazaEnana") || "") !== "1") continue; // solo variantes E/G
  enano.push(+idm[1]);
}
enano.sort((a, b) => a - b);

const rows = [];
for (let i = 0; i < enano.length; i += 12) rows.push("  " + enano.slice(i, i + 12).join(", ") + ",");

const out =
  "// GENERADO desde data/dat/obj.dat (armaduras ObjType=3 con RazaEnana=1).\n" +
  "// Estatura de armaduras: en el AO original las armaduras vienen en dos tallas.\n" +
  '// Las variantes "(E/G)" (RazaEnana=1) tienen el body corto de Enano/Gnomo; el\n' +
  '// resto usa el body "alto" (Humano/Elfo/Elfo Oscuro). Un personaje solo puede\n' +
  "// equipar armaduras de SU estatura (regla del AO: RazaEnana gatea la raza).\n" +
  "// Regenerar: node packages/server/scripts/gen-armor-stature.mjs\n\n" +
  "export const ENANO_ARMOR_IDS: ReadonlySet<number> = new Set([\n" +
  rows.join("\n") + "\n]);\n\n" +
  "/** true si la armadura es de estatura Enano/Gnomo (variante E/G del AO). */\n" +
  "export function isEnanoArmor(itemId: number): boolean {\n" +
  "  return ENANO_ARMOR_IDS.has(itemId);\n}\n";

fs.writeFileSync(outFile, out);
console.log(`✓ armor-stature.ts: ${enano.length} armaduras E/G`);
