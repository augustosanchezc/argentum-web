// ¿Los tiles "negros" del mapa 1 son un bug de render o son negros en el
// arte original? Muestrea GRHs de capa 1, recorta su región del PNG y mide
// el brillo promedio. Usa PNG decode manual mínimo via sharp?? No — usamos
// la técnica simple: contar frecuencia de GRHs y mapear a archivo+rect para
// inspección, y medir brillo con el decodificador PNG de PixiJS no disponible
// en Node → usamos 'pngjs'? Tampoco está. Solución: leer el PNG crudo no es
// trivial sin deps; en su lugar reportamos los GRH más frecuentes y sus
// archivos para inspección visual directa.
// Uso: npx tsx packages/server/scripts/diag-pixels.mts
import { readFileSync } from "node:fs";
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

// Frecuencia de GRHs en capa 1
const freq = new Map<number, number>();
for (const g of map.graphic) {
  if (g) freq.set(g, (freq.get(g) ?? 0) + 1);
}
const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log("GRHs más frecuentes en capa 1 del mapa 1:");
for (const [g, c] of top) {
  const e = graficos[g.toString()];
  console.log(`  GRH ${g.toString()} ×${c.toString()} → ${e ? `${e.f.toString()}.png @${e.x.toString()},${e.y.toString()} ${e.w.toString()}x${e.h.toString()}` : "SIN ENTRADA"}`);
}

// Muestra la zona alrededor del spawn (50,50) — qué GRH tiene cada tile
console.log("\nVista 12x6 alrededor del spawn (50,50) — GRH de capa 1:");
for (let y = 47; y < 53; y++) {
  const row: string[] = [];
  for (let x = 44; x < 56; x++) {
    row.push((map.graphic[y * 100 + x] ?? 0).toString().padStart(5));
  }
  console.log(`  y=${y.toString()}: ${row.join(" ")}`);
}
