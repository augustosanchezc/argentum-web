// Descarga archivos de mapas del AO desde ao-libre/ao-server (AGPL-3.0).
// Los archivos quedan en packages/server/data/maps/.
//
// Uso:
//   node scripts/fetch-maps.mjs          → descarga todos los mapas del AO (1-300)
//   node scripts/fetch-maps.mjs 2 3 100  → descarga solo esos IDs
//
// Fuente: https://github.com/ao-libre/ao-server, carpeta Mundos/Alkon/
// Licencia: AGPL-3.0 (compatible con la del proyecto)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = resolve(HERE, "..", "packages", "server", "data", "maps");
const BASE_URL =
  "https://raw.githubusercontent.com/ao-libre/ao-server/master/Mundos/Alkon";

// Si se pasan IDs como argumentos se usan; si no, se intenta 1..300.
const args = process.argv.slice(2).map(Number).filter((n) => n > 0);
const TARGET_IDS = args.length > 0 ? args : Array.from({ length: 300 }, (_, i) => i + 1);

mkdirSync(MAPS_DIR, { recursive: true });

async function fetchBinary(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const id of TARGET_IDS) {
  const base = `Mapa${id}`;
  const mapPath = resolve(MAPS_DIR, `${base}.map`);
  const infPath = resolve(MAPS_DIR, `${base}.inf`);

  // Si ya existen ambos archivos, no re-descargamos.
  if (existsSync(mapPath) && existsSync(infPath)) {
    skipped += 1;
    continue;
  }

  const [mapBuf, infBuf] = await Promise.all([
    fetchBinary(`${BASE_URL}/${base}.map`),
    fetchBinary(`${BASE_URL}/${base}.inf`),
  ]);

  if (!mapBuf || !infBuf) {
    // El mapa no existe en el repo o no está disponible — no es un error.
    failed += 1;
    continue;
  }

  writeFileSync(mapPath, mapBuf);
  writeFileSync(infPath, infBuf);
  downloaded += 1;
  process.stdout.write(`  ✓ Mapa${id}\n`);
}

console.log(`\nListo: ${downloaded.toString()} descargados, ${skipped.toString()} ya existían, ${failed.toString()} no disponibles.`);
console.log("Reiniciá el servidor para que cargue los nuevos mapas.");
