// Verifica nombres reales y zonas seguras cargadas desde MapaN.dat.
import { getMap, loadedMapIds } from "../src/world/maps.js";

const safe: string[] = [];
for (const id of loadedMapIds()) {
  const m = getMap(id);
  if (m?.safeZone) safe.push(`${id.toString()}:${m.name}`);
}
console.log(`Mapas cargados: ${loadedMapIds().length.toString()}`);
console.log(`Zonas seguras (${safe.length.toString()}): ${safe.slice(0, 20).join(" · ")}`);
for (const id of [1, 2, 34, 59, 40]) {
  const m = getMap(id);
  if (m) console.log(`  Mapa ${id.toString()}: "${m.name}" safe=${m.safeZone.toString()}`);
}
