#!/usr/bin/env node
// Convierte los gráficos del cliente AO original a PNG individuales y genera
// el índice grh-index.json que usa el cliente web.
//
// Uso:
//   node scripts/convert-ao-graphics.mjs --ao-path /ruta/al/cliente/ao
//
// Requisitos:
//   - Node.js 18+
//   - El paquete `sharp` instalado (npm install -g sharp / pnpm add -D sharp)
//     Si no está disponible, genera solo grh-index.json sin las imágenes.
//
// Qué hace:
//   1. Lee Graficos/Graficos.ind (índice binario de GRHs del AO)
//   2. Para cada GRH 1-250: determina archivo BMP + coordenadas del frame
//   3. Extrae el recorte del BMP y lo guarda como PNG en public/graficos/
//   4. Genera public/grh-index.json con el mapping completo
//
// Formato binario de Graficos.ind (Argentum Online 20):
//   Header: uint16 LE = total de GRHs
//   Por cada GRH (1-indexed):
//     numFrames: uint16 LE
//     if numFrames > 1: frames[numFrames]: uint32 LE (refs a otros GRHs)
//     pixelX: uint16 LE
//     pixelY: uint16 LE
//     width:  uint16 LE
//     height: uint16 LE
//     bmpFile: uint8 (número: 1 = Graficos1.bmp, etc.)
//     speed: uint16 LE (ms por frame, ignorado si numFrames==1)

import { createReadStream, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = resolve(ROOT, "packages/client/public/graficos");
const INDEX_PATH = resolve(ROOT, "packages/client/public/grh-index.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const aoPathIdx = args.indexOf("--ao-path");
  if (aoPathIdx === -1 || !args[aoPathIdx + 1]) {
    console.error("Uso: node scripts/convert-ao-graphics.mjs --ao-path /ruta/al/cliente/ao");
    process.exit(1);
  }
  return { aoPath: args[aoPathIdx + 1] };
}

async function parseGraficosInd(indPath) {
  const buf = await readFile(indPath);
  let offset = 0;

  const numGrhs = buf.readUInt16LE(offset);
  offset += 2;
  console.log(`[convert] Graficos.ind: ${numGrhs} GRHs`);

  const grhs = [];
  for (let i = 1; i <= numGrhs; i++) {
    if (offset + 2 > buf.length) break;
    const numFrames = buf.readUInt16LE(offset);
    offset += 2;

    const frames = [];
    if (numFrames > 1) {
      for (let f = 0; f < numFrames; f++) {
        if (offset + 4 > buf.length) break;
        frames.push(buf.readUInt32LE(offset));
        offset += 4;
      }
    }

    if (offset + 9 > buf.length) break;
    const pixelX = buf.readUInt16LE(offset); offset += 2;
    const pixelY = buf.readUInt16LE(offset); offset += 2;
    const width  = buf.readUInt16LE(offset); offset += 2;
    const height = buf.readUInt16LE(offset); offset += 2;
    const bmpFile = buf.readUInt8(offset);   offset += 1;
    // speed field (2 bytes)
    if (offset + 2 <= buf.length) offset += 2;

    grhs.push({ id: i, numFrames, frames, pixelX, pixelY, width, height, bmpFile });
  }
  return grhs;
}

async function tryLoadSharp() {
  try {
    const m = await import("sharp");
    return m.default || m;
  } catch {
    return null;
  }
}

async function main() {
  const { aoPath } = parseArgs();
  const indPath = resolve(aoPath, "Graficos", "Graficos.ind");

  if (!existsSync(indPath)) {
    console.error(`No se encontró ${indPath}`);
    console.error("Asegurate de que --ao-path apunte a la carpeta raíz del cliente AO");
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  console.log("[convert] Leyendo Graficos.ind...");
  const grhs = await parseGraficosInd(indPath);

  // Limitar a los primeros 250 GRHs para el MVP (cuerpos y cabezas)
  const TARGET_COUNT = 250;
  const targetGrhs = grhs.slice(0, TARGET_COUNT);

  // Generar siempre el índice JSON
  const index = {};
  for (const g of targetGrhs) {
    index[g.id] = {
      bmpFile: g.bmpFile,
      x: g.pixelX,
      y: g.pixelY,
      w: g.width,
      h: g.height,
      animated: g.numFrames > 1,
      frames: g.frames,
    };
  }
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`[convert] grh-index.json generado con ${Object.keys(index).length} entradas`);

  // Intentar conversión de BMP a PNG con sharp
  const sharp = await tryLoadSharp();
  if (!sharp) {
    console.warn("[convert] 'sharp' no disponible — se generó solo el índice JSON.");
    console.warn("[convert] Para generar los PNGs: pnpm add -D sharp && reejecutar");
    return;
  }

  // Agrupar por archivo BMP para no abrir el mismo archivo múltiples veces
  const byBmp = new Map();
  for (const g of targetGrhs) {
    if (!byBmp.has(g.bmpFile)) byBmp.set(g.bmpFile, []);
    byBmp.get(g.bmpFile).push(g);
  }

  let converted = 0;
  let skipped = 0;

  for (const [bmpNum, grhList] of byBmp) {
    const bmpPath = resolve(aoPath, "Graficos", `Graficos${bmpNum}.bmp`);
    if (!existsSync(bmpPath)) {
      console.warn(`[convert] No se encontró: ${bmpPath} — saltando ${grhList.length} GRHs`);
      skipped += grhList.length;
      continue;
    }

    for (const g of grhList) {
      if (g.width <= 0 || g.height <= 0) { skipped++; continue; }
      const outPath = join(OUT_DIR, `${g.id}.png`);
      try {
        await sharp(bmpPath)
          .extract({ left: g.pixelX, top: g.pixelY, width: g.width, height: g.height })
          .png()
          .toFile(outPath);
        converted++;
        if (converted % 50 === 0) console.log(`[convert] ${converted.toString()} PNGs generados...`);
      } catch (err) {
        skipped++;
        // Silenciar errores individuales (coordenadas fuera de rango, etc.)
      }
    }
  }

  console.log(`\n[convert] Listo: ${converted.toString()} PNGs en ${OUT_DIR}`);
  console.log(`[convert] Saltados: ${skipped.toString()} (sin BMP o dimensión inválida)`);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
