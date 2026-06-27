// Script de un solo uso: identifica los graficos que necesita Mapa1 (Ullathorpe)
// y baja solo los PNGs correspondientes desde ao-libre/ao-cliente.
//
// Uso: node scripts/fetch-ulla-assets.mjs
//
// Lee:
//   packages/server/data/maps/Mapa1.map  (ya en el repo)
//   packages/client/public/ao-assets/Graficos.ind (descargado aparte)
//
// Escribe:
//   packages/client/public/ao-assets/graficos.json   (mini-index para el cliente)
//   packages/client/public/ao-assets/graficos/N.png  (los PNGs necesarios)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const MAP_PATH = resolve(ROOT, "packages/server/data/maps/Mapa1.map");
const IND_PATH = resolve(ROOT, "packages/client/public/ao-assets/Graficos.ind");
const OUT_DIR = resolve(ROOT, "packages/client/public/ao-assets/graficos");
const OUT_INDEX = resolve(ROOT, "packages/client/public/ao-assets/graficos.json");
const CLIENT_REPO_RAW = "https://raw.githubusercontent.com/ao-libre/ao-cliente/master/Graficos";

const AO_W = 100;
const AO_H = 100;
const MAP_HEADER_BYTES = 273;

// --- parse Mapa1.map (replica del loader del server) ---
function uniqueGraphicsFromMap(buf) {
  const result = new Set();
  let off = MAP_HEADER_BYTES;
  for (let y = 0; y < AO_H; y += 1) {
    for (let x = 0; x < AO_W; x += 1) {
      const flags = buf.readUInt8(off); off += 1;
      const g1 = buf.readUInt32LE(off); off += 4;
      result.add(g1);
      if (flags & 2) { result.add(buf.readUInt32LE(off)); off += 4; }
      if (flags & 4) { result.add(buf.readUInt32LE(off)); off += 4; }
      if (flags & 8) { result.add(buf.readUInt32LE(off)); off += 4; }
      if (flags & 16) off += 2; // trigger u16
    }
  }
  result.delete(0); // graphic 0 = tile vacio, lo skipeamos
  return [...result].sort((a, b) => a - b);
}

// --- parse Graficos.ind (formato VB6) ---
//   Header: fileVersion u32 LE + grhCount u32 LE
//   Body por Grh:
//     Grh u32 LE + NumFrames u16 LE
//     si NumFrames > 1: Frames[NumFrames] u32 LE + speed f32 LE
//     si NumFrames == 1: FileNum u32 LE + sX u16 + sY u16 + pixelWidth u16 + pixelHeight u16
function parseGraficosInd(buf) {
  const fileVersion = buf.readUInt32LE(0);
  const grhCount = buf.readUInt32LE(4);
  let off = 8;
  // Map<grh, {numFrames, frames?[], speed?, fileNum?, sX, sY, w, h}>
  const grhData = new Map();
  while (off < buf.length) {
    const grh = buf.readUInt32LE(off); off += 4;
    const numFrames = buf.readUInt16LE(off); off += 2;
    if (numFrames > 1) {
      const frames = [];
      for (let f = 0; f < numFrames; f += 1) {
        frames.push(buf.readUInt32LE(off));
        off += 4;
      }
      const speed = buf.readFloatLE(off); off += 4;
      grhData.set(grh, { numFrames, frames, speed });
    } else {
      const fileNum = buf.readUInt32LE(off); off += 4;
      const sX = buf.readUInt16LE(off); off += 2;
      const sY = buf.readUInt16LE(off); off += 2;
      const w = buf.readUInt16LE(off); off += 2;
      const h = buf.readUInt16LE(off); off += 2;
      grhData.set(grh, { numFrames: 1, fileNum, sX, sY, w, h });
    }
  }
  return { fileVersion, grhCount, grhData };
}

// --- resolver fileNums recursivamente (un graph animado apunta a frames estaticos) ---
function resolveFileNums(grhData, neededGrhs) {
  const fileNums = new Set();
  const grhResolved = new Map();
  function visit(grh) {
    if (grhResolved.has(grh)) return grhResolved.get(grh);
    const data = grhData.get(grh);
    if (!data) return null;
    if (data.numFrames === 1) {
      fileNums.add(data.fileNum);
      const r = { ...data };
      grhResolved.set(grh, r);
      return r;
    }
    // Animado: resolvemos solo el primer frame para el render estatico
    // (el server por ahora solo mira el graphic1 del tile; las animaciones
    // tipo agua entran cuando agreguemos ticker de frames).
    const first = visit(data.frames[0]);
    const r = { numFrames: data.numFrames, frames: data.frames, speed: data.speed, firstFrame: first };
    grhResolved.set(grh, r);
    return r;
  }
  for (const grh of neededGrhs) visit(grh);
  return { fileNums, grhResolved };
}

async function downloadPng(fileNum, outPath) {
  if (existsSync(outPath)) return;
  const url = `${CLIENT_REPO_RAW}/${fileNum}.png`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[skip] ${fileNum}.png -> ${res.status}`);
    return;
  }
  const arr = new Uint8Array(await res.arrayBuffer());
  writeFileSync(outPath, arr);
  process.stdout.write(`.`);
}

async function main() {
  console.log("Parsing Mapa1.map...");
  const mapBuf = readFileSync(MAP_PATH);
  const grhsNeeded = uniqueGraphicsFromMap(mapBuf);
  console.log(`  → ${grhsNeeded.length} graphics unicos`);

  console.log("Parsing Graficos.ind...");
  const indBuf = readFileSync(IND_PATH);
  const { fileVersion, grhCount, grhData } = parseGraficosInd(indBuf);
  console.log(`  → fileVersion=${fileVersion}, ${grhData.size}/${grhCount} grhs cargados`);

  const { fileNums, grhResolved } = resolveFileNums(grhData, grhsNeeded);
  console.log(`Resolved ${grhResolved.size} grhs → ${fileNums.size} PNGs requeridos`);

  // Pequeno indice para el cliente: por cada graphic id que el server puede mandar,
  // su fileNum + offset + size dentro del png. Resolvemos animados a su primer frame.
  const out = {};
  for (const [grh, info] of grhResolved.entries()) {
    if (info.numFrames === 1) {
      out[grh] = { f: info.fileNum, x: info.sX, y: info.sY, w: info.w, h: info.h };
    } else if (info.firstFrame) {
      const f = info.firstFrame;
      out[grh] = { f: f.fileNum, x: f.sX, y: f.sY, w: f.w, h: f.h };
    }
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_INDEX, JSON.stringify(out));
  console.log(`Wrote ${OUT_INDEX} (${Object.keys(out).length} entries)`);

  console.log(`Downloading ${fileNums.size} PNGs...`);
  let i = 0;
  for (const fn of fileNums) {
    await downloadPng(fn, resolve(OUT_DIR, `${fn}.png`));
    i += 1;
    if (i % 20 === 0) process.stdout.write(` ${i}/${fileNums.size}\n`);
  }
  console.log(`\nDone.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
