// Prueba de humo del mundo: carga mapas reales + spawns del .inf + NPCs.dat
// y cruza contra personajes.json del cliente para verificar cobertura de sprites.
// Uso: npx tsx packages/server/scripts/smoke-world.mts
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getMap, loadedMapIds } from "../src/world/maps.js";
import { npcs, getNpcType } from "../src/world/npcs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

npcs.init();

console.log(`Mapas cargados: ${loadedMapIds().join(", ")}`);

const personajes = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../client/public/ao-assets/personajes.json"),
    "utf8",
  ),
) as {
  bodies: Record<string, unknown>;
  heads: Record<string, unknown>;
  monsterBodies: Record<string, unknown>;
};
const hasBody = (id: number): boolean =>
  !!personajes.bodies[id.toString()] || !!personajes.monsterBodies[id.toString()];
const hasHead = (id: number): boolean => !!personajes.heads[id.toString()];

const byMap = new Map<number, Map<string, number>>();
let total = 0;
let bodyMiss = 0;
let headMiss = 0;
const missingBodies = new Set<number>();

for (const n of npcs.all()) {
  total++;
  const m = byMap.get(n.mapId) ?? new Map<string, number>();
  m.set(n.type.name, (m.get(n.type.name) ?? 0) + 1);
  byMap.set(n.mapId, m);
  if (!hasBody(n.type.bodyId)) {
    bodyMiss++;
    missingBodies.add(n.type.bodyId);
  }
  if (n.type.headId > 0 && !hasHead(n.type.headId)) headMiss++;
}

console.log(`\nTotal NPCs spawneados: ${total.toString()}`);
for (const [mapId, m] of [...byMap.entries()].sort((a, b) => a[0] - b[0])) {
  const map = getMap(mapId);
  const list = [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, c]) => `${name}×${c.toString()}`)
    .join(", ");
  console.log(`  Mapa ${mapId.toString()} (${map?.name ?? "?"}): ${[...m.values()].reduce((a, b) => a + b, 0).toString()} NPCs → ${list}`);
}

console.log(`\nSprites: ${(total - bodyMiss).toString()}/${total.toString()} bodies con PNG, heads sin PNG: ${headMiss.toString()}`);
if (missingBodies.size > 0) {
  console.log(`Bodies sin sprite (fallback silueta): ${[...missingBodies].sort((a, b) => a - b).join(", ")}`);
}

// Muestra un par de comerciantes con su inventario real
for (const n of npcs.all()) {
  if (n.type.merchant && n.type.shopOffers.length > 0) {
    console.log(`\nComerciante de muestra: ${n.type.name} (mapa ${n.mapId.toString()}) vende items: ${n.type.shopOffers.slice(0, 10).join(", ")}...`);
    break;
  }
}

// Capas del mapa 1
const m1 = getMap(1);
if (m1) {
  const count = (arr: readonly number[]): number => arr.filter((g) => g > 0).length;
  console.log(`\nMapa 1 capas: L1=${count(m1.graphic).toString()} L2=${count(m1.layer2).toString()} L3=${count(m1.layer3).toString()} L4=${count(m1.layer4).toString()} triggers=${count(m1.trigger).toString()}`);
}
void getNpcType;
