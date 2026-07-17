import { getMap } from "../src/world/maps.js";
import { getItem } from "@ao/shared";
const map = getMap(1)!;
const W = map.width;
// Puertas sin llave (item 8 y 253): ver bloqueo del tile y vecinos.
for (const [ti, obj] of map.objects) {
  const d = getItem(obj.item);
  if (d?.objType !== 6) continue;
  if ((d.llave ?? 0) !== 0) continue; // solo sin llave
  const x = ti % W, y = Math.floor(ti / W);
  const b = (xx: number, yy: number) => map.blocked[yy * W + xx];
  console.log(`puerta (${x},${y}) item${obj.item}: tile=${b(x,y)} O=${b(x-1,y)} E=${b(x+1,y)} N=${b(x,y-1)} S=${b(x,y+1)}`);
}
