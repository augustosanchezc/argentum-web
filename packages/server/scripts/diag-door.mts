import { getItem } from "@ao/shared";
for (const id of [7, 8, 68, 72, 76, 253]) {
  const d = getItem(id);
  if (!d) { console.log(id, "no existe"); continue; }
  console.log(`item ${id} "${d.name}" objType=${d.objType} grh=${d.graphic} cerrada=${d.cerrada} idxAbierta=${d.indexAbierta} idxCerrada=${d.indexCerrada} llave=${d.llave}`);
}
