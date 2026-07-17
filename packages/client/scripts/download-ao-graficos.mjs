/**
 * download-ao-graficos.mjs
 *
 * Descarga los PNG de gráficos de AO Libre desde:
 *   https://raw.githubusercontent.com/ao-libre/ao-cliente/master/Graficos/
 *
 * Solo descarga los archivos referenciados en Graficos.ind que no estén
 * ya presentes en public/ao-assets/graficos/
 *
 * Uso: node packages/client/scripts/download-ao-graficos.mjs
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, "../public/ao-assets");
const GRAFICOS_DIR = resolve(ASSETS, "graficos");
const RAW_BASE = "https://raw.githubusercontent.com/ao-libre/ao-cliente/master/Graficos";

// ─── Parsear Graficos.ind para obtener todos los fileNums referenciados ──────
function getNeededFileNums(filePath) {
  const buf = readFileSync(filePath);
  let offset = 0;

  const readI16 = () => { const v = buf.readInt16LE(offset); offset += 2; return v; };
  const readI32 = () => { const v = buf.readInt32LE(offset); offset += 4; return v; };

  const version = readI32();
  const numGrhs = readI32();
  console.log(`Graficos.ind: version=${version}, numGrhs=${numGrhs}`);

  const fileNums = new Set();

  for (let i = 0; i < numGrhs; i++) {
    if (offset + 6 > buf.length) break;

    const grhId = readI32();
    const numFrames = readI16();

    if (numFrames === 0) {
      // vacío, nada que hacer
    } else if (numFrames === 1) {
      if (offset + 12 > buf.length) break;
      const fileNum = readI32();
      const x = readI16();
      const y = readI16();
      const w = readI16();
      const h = readI16();
      fileNums.add(fileNum);
    } else {
      if (offset + numFrames * 4 + 4 > buf.length) break;
      for (let j = 0; j < numFrames; j++) readI32(); // frame IDs (son GRH IDs, no file nums)
      readI32(); // speed (Float32)
    }
  }

  return fileNums;
}

const allFileNums = getNeededFileNums(resolve(ASSETS, "Graficos.ind"));
console.log(`Total file numbers en Graficos.ind: ${allFileNums.size}`);

// Filtrar los que ya tenemos
const needed = [...allFileNums].filter(n => !existsSync(resolve(GRAFICOS_DIR, `${n}.png`)));
console.log(`Ya descargados: ${allFileNums.size - needed.length}`);
console.log(`Por descargar: ${needed.length}`);

if (needed.length === 0) {
  console.log("✓ Todos los archivos ya están presentes.");
  process.exit(0);
}

// ─── Descargar con concurrencia limitada ─────────────────────────────────────
const CONCURRENCY = 8;
let downloaded = 0;
let failed = 0;
const failedList = [];

async function downloadFile(fileNum) {
  const url = `${RAW_BASE}/${fileNum}.png`;
  const destPath = resolve(GRAFICOS_DIR, `${fileNum}.png`);

  try {
    const res = await fetch(url);
    if (res.status === 404) {
      // Archivo no existe en el repo (normal para algunos fileNums)
      return false;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buf);
    return true;
  } catch (err) {
    failedList.push({ fileNum, err: err.message });
    return false;
  }
}

// Procesar en lotes con concurrencia limitada
const startTime = Date.now();
let i = 0;

while (i < needed.length) {
  const batch = needed.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(downloadFile));

  for (const ok of results) {
    if (ok) downloaded++;
    else failed++;
  }

  i += CONCURRENCY;

  if (i % 80 === 0 || i >= needed.length) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = Math.round((i / needed.length) * 100);
    console.log(`  [${pct}%] ${i}/${needed.length} procesados — descargados: ${downloaded}, no encontrados: ${failed} (${elapsed}s)`);
  }
}

console.log(`\n✓ Descarga completada:`);
console.log(`  Descargados: ${downloaded}`);
console.log(`  No encontrados en repo (normal): ${failed}`);
if (failedList.length > 0 && failedList.length <= 20) {
  console.log(`  Errores: ${failedList.map(f => `${f.fileNum}(${f.err})`).join(", ")}`);
}
console.log(`\nAhora ejecutá (en orden):`);
console.log(`  1. node packages/client/scripts/apply-color-key.mjs   (negro puro → transparente, como el motor original)`);
console.log(`  2. node packages/client/scripts/parse-ao-assets.mjs`);
