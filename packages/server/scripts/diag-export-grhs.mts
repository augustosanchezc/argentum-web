// Exporta los GRHs distintos de capa 1 del mapa 1 (con coords de crop)
// para el análisis de píxeles en PowerShell.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getMap } from "../src/world/maps.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const graficos = JSON.parse(
  readFileSync(resolve(__dirname, "../../client/public/ao-assets/graficos.json"), "utf8"),
) as Record<string, { f: number; x: number; y: number; w: number; h: number }>;

const map = getMap(1);
if (!map) throw new Error("mapa 1 no cargó");

const freq = new Map<number, number>();
for (const g of map.graphic) if (g) freq.set(g, (freq.get(g) ?? 0) + 1);

const out: object[] = [];
for (const [g, c] of freq) {
  const e = graficos[g.toString()];
  if (e) out.push({ grh: g, count: c, f: e.f, x: e.x, y: e.y, w: e.w, h: e.h });
}
const dest = process.argv[2];
writeFileSync(dest, JSON.stringify(out));
console.log(`exportados ${out.length.toString()} GRHs distintos a ${dest}`);
