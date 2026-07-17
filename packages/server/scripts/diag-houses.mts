// Diagnóstico: ¿se puede entrar a las casas de Ullathorpe (mapa 1)?
import { getMap, isWalkable } from "../src/world/maps.js";
import { getNpcType } from "../src/world/npcs.js";
import { getItem } from "@ao/shared";

const map = getMap(1);
if (!map) { console.log("mapa 1 no cargado"); process.exit(1); }
const W = map.width;
const idx = (x: number, y: number) => y * W + x;

// NPCs clave del mapa (banquero, sacerdote, comerciantes).
console.log("=== NPCs en Ullathorpe (mapa 1) ===");
for (const s of map.npcSpawns) {
  const t = getNpcType(s.npcNumber);
  if (!t) continue;
  const role = t.isPriest ? "SACERDOTE" : t.banker ? "BANQUERO" : t.merchant ? "VENDEDOR" : t.isGuard ? "guardia" : t.hostile ? "hostil" : "otro";
  if (["SACERDOTE", "BANQUERO", "VENDEDOR"].includes(role)) {
    const x = s.x, y = s.y;
    // ¿Cuántos de los 8 vecinos son transitables a pie? (0 = encerrado)
    let reach = 0;
    for (const [dx, dy] of [[0,-1],[0,1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] as const) {
      if (isWalkable(map, x + dx, y + dy, false)) reach++;
    }
    console.log(`  ${role} "${t.name}" en (${x},${y}) — vecinos transitables: ${reach}/8${reach === 0 ? "  ⚠ ENCERRADO" : ""}`);
  }
}

// Puertas (objType 6) del mapa: ¿cuántas, cuántas cerradas (bloquean)?
console.log("\n=== Puertas (objType 6) en el mapa ===");
let doors = 0, closed = 0;
for (const [tileIdx, obj] of map.objects) {
  const def = getItem(obj.item);
  if (def?.objType !== 6) continue;
  doors++;
  const x = tileIdx % W, y = Math.floor(tileIdx / W);
  const blk = map.blocked[tileIdx] === 1;
  if (def.cerrada || blk) closed++;
  if (doors <= 10) console.log(`  puerta en (${x},${y}) item ${obj.item} "${def.name}" — cerrada:${def.cerrada ?? false} bloqueada:${blk}`);
}
console.log(`  TOTAL puertas: ${doors} · cerradas/bloqueadas: ${closed}`);

// Muestreo: ¿cuántos tiles del mapa son transitables? (para ver si hay interiores)
let walkable = 0;
for (let y = 0; y < map.height; y++) for (let x = 0; x < W; x++) if (isWalkable(map, x, y, false)) walkable++;
console.log(`\n=== Tiles transitables: ${walkable} de ${W * map.height} ===`);
