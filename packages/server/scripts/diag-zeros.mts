// Cuenta tiles con graphic1=0 en el mapa 1 y muestra un minimapa ASCII
// (# = tile con gráfico, . = vacío/negro) para comparar contra la captura.
import { getMap } from "../src/world/maps.js";

const map = getMap(1);
if (!map) throw new Error("mapa 1 no cargó");

let zeros = 0;
for (const g of map.graphic) if (!g) zeros++;
console.log(`Mapa 1: ${zeros.toString()}/10000 tiles con graphic1=0 (negros también en el AO original)`);

// Minimapa 100x50 (cada celda = 1 tile, muestreando cada 2 filas)
for (let y = 0; y < 100; y += 2) {
  let row = "";
  for (let x = 0; x < 100; x += 1) {
    row += map.graphic[y * 100 + x] ? "#" : ".";
  }
  console.log(row);
}
