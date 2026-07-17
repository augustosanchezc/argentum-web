// Diagnóstico: qué GRHs de las capas del mapa 1 no tienen textura en el
// cliente (falta el GRH en graficos.json o falta el PNG en disco).
// Uso: npx tsx packages/server/scripts/diag-tiles.mts
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getMap } from "../src/world/maps.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, "../../client/public/ao-assets");

const graficos = JSON.parse(readFileSync(resolve(ASSETS, "graficos.json"), "utf8")) as Record<
  string,
  { f: number; x: number; y: number; w: number; h: number }
>;

const map = getMap(1);
if (!map) throw new Error("mapa 1 no cargó");

const layers: Array<[string, readonly number[]]> = [
  ["L1", map.graphic],
  ["L2", map.layer2],
  ["L3", map.layer3],
  ["L4", map.layer4],
];

for (const [label, arr] of layers) {
  const missingGrh = new Map<number, number>(); // grh → count
  const missingPngByFile = new Map<number, number>(); // fileNum → tiles afectados
  let totalTiles = 0;
  let okTiles = 0;

  for (const g of arr) {
    if (!g) continue;
    totalTiles++;
    const entry = graficos[g.toString()];
    if (!entry) {
      missingGrh.set(g, (missingGrh.get(g) ?? 0) + 1);
      continue;
    }
    if (!existsSync(resolve(ASSETS, "graficos", `${entry.f.toString()}.png`))) {
      missingPngByFile.set(entry.f, (missingPngByFile.get(entry.f) ?? 0) + 1);
      continue;
    }
    okTiles++;
  }

  console.log(`\n${label}: ${okTiles.toString()}/${totalTiles.toString()} tiles con textura`);
  if (missingGrh.size > 0) {
    const top = [...missingGrh.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log(`  GRHs sin entrada en graficos.json (${missingGrh.size.toString()} distintos): ${top.map(([g, c]) => `${g.toString()}×${c.toString()}`).join(", ")}`);
  }
  if (missingPngByFile.size > 0) {
    const top = [...missingPngByFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log(`  PNGs faltantes en disco (${missingPngByFile.size.toString()} archivos): ${top.map(([f, c]) => `${f.toString()}.png×${c.toString()}`).join(", ")}`);
  }
}
