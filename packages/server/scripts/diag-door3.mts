import { getMap } from "../src/world/maps.js";
import { getItem } from "@ao/shared";
const map = getMap(1)!;
const W = map.width;
// Simula la lógica ARREGLADA de handleTileInteract sobre la puerta (61,30).
function interact(x: number, y: number) {
  const obj = map.objects.get(y * W + x)!;
  const def = getItem(obj.item)!;
  const isClosed = map.blocked[y * W + x] === 1;
  const counterpartId = isClosed ? (def.indexAbierta ?? 0) : (def.indexCerrada ?? 0);
  const counterpart = getItem(counterpartId)!;
  const nowBlocked = !isClosed;
  return { antes: { item: obj.item, blocked: map.blocked[y*W+x] }, isClosed, counterpartId, grh: counterpart.graphic, nowBlocked };
}
const r1 = interact(61, 30);
console.log("1er accionar (cerrada→abrir):", JSON.stringify(r1));
console.log(r1.isClosed && r1.counterpartId === 7 && r1.nowBlocked === false ? "  ✅ ABRE correctamente" : "  ❌ FALLA");
