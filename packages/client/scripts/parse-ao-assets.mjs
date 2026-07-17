/**
 * parse-ao-assets.mjs
 *
 * Parsea los archivos binarios del AO Libre:
 *   Graficos.ind  → GRH completo (frames estáticos + animaciones)
 *   Personajes.ini → Walk GRH IDs + HeadOffset por body
 *   Cabezas.ind   → GRH de cabeza por dirección y headId
 *
 * Formato de Graficos.ind (verificado con datos reales):
 *   Header: Int32 version (113), Int32 numGrhs (32870)
 *   Cada entrada:
 *     Int32  GrhId
 *     Int16  NumFrames
 *     Si NumFrames == 1 (estático):
 *       Int32  FileNum (número del PNG)
 *       Int16  X, Y, W, H
 *       — total 18 bytes —
 *     Si NumFrames > 1 (animación):
 *       Int32[N] frameIds
 *       Float32  speed
 *       — total 10+4*N bytes —
 *     Si NumFrames == 0 (vacío):
 *       — solo los 6 bytes de GrhId+NumFrames —
 *
 * Uso: node packages/client/scripts/parse-ao-assets.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, "../public/ao-assets");

// ─── 1. Cargar graficos.json + detectar PNGs en disco ────────────────────
const graficosJson = JSON.parse(readFileSync(resolve(ASSETS, "graficos.json"), "utf8"));

// Escanear el directorio de PNGs en disco para detectar todos los disponibles.
// (graficos.json puede estar desactualizado respecto a los PNGs descargados)
const pngDir = resolve(ASSETS, "graficos");
const pngFiles = readdirSync(pngDir).filter((f) => f.endsWith(".png"));
const availableFileNums = new Set(pngFiles.map((f) => parseInt(f.replace(".png", ""), 10)).filter((n) => !isNaN(n)));
console.log(`graficos.json: ${Object.keys(graficosJson).length} GRHs, ${availableFileNums.size} archivos PNG en disco`);

// ─── 2. Parsear Graficos.ind ─────────────────────────────────────────────
function parseGraficosInd(filePath) {
  const buf = readFileSync(filePath);
  let offset = 0;

  const readI16 = () => { const v = buf.readInt16LE(offset); offset += 2; return v; };
  const readI32 = () => { const v = buf.readInt32LE(offset); offset += 4; return v; };
  const readF32 = () => { const v = buf.readFloatLE(offset); offset += 4; return v; };

  const version = readI32();
  const numGrhs = readI32();
  console.log(`Graficos.ind: version=${version}, numGrhs=${numGrhs}, tamaño=${buf.length} bytes`);

  // grhMap[grhId] = { type, fileNum, x, y, w, h } | { type, frames, speed }
  const grhMap = new Map();

  for (let i = 0; i < numGrhs; i++) {
    if (offset + 6 > buf.length) break;

    const grhId = readI32();
    const numFrames = readI16();

    if (numFrames === 0) {
      // GRH vacío — solo usamos el espacio del header
      grhMap.set(grhId, { type: "empty" });
    } else if (numFrames === 1) {
      // GRH estático: fileNum + x,y,w,h (sin speed)
      if (offset + 12 > buf.length) break;
      const fileNum = readI32();
      const x = readI16();
      const y = readI16();
      const w = readI16();
      const h = readI16();
      grhMap.set(grhId, { type: "static", fileNum, x, y, w, h });
    } else {
      // GRH animado: N frame IDs + speed
      if (offset + numFrames * 4 + 4 > buf.length) break;
      const frames = [];
      for (let j = 0; j < numFrames; j++) {
        frames.push(readI32());
      }
      const speed = readF32();
      grhMap.set(grhId, { type: "anim", frames, speed });
    }
  }

  console.log(`Graficos.ind parseado: ${grhMap.size} entradas`);
  return grhMap;
}

const grhMap = parseGraficosInd(resolve(ASSETS, "Graficos.ind"));

// Verificar datos conocidos
const g2531 = grhMap.get(2531);
const g4581 = grhMap.get(4581);
const g7001 = grhMap.get(7001);
console.log("Verificación GRH 2531:", JSON.stringify(g2531), "(esperado f=168,x=0,y=0,w=25,h=45)");
console.log("Verificación GRH 4581:", JSON.stringify(g4581), "(esperado 6 frames: 2531-2536)");
console.log("Verificación GRH 7001:", JSON.stringify(g7001), "(esperado f=6071,x=0,y=0,w=256,h=256)");

// Función: dado un GRH ID (posiblemente animación), devuelve los GRH IDs de frames estáticos
function resolveToStaticFrames(grhId) {
  const entry = grhMap.get(grhId);
  if (!entry || entry.type === "empty") return [];
  if (entry.type === "static") return [grhId];
  if (entry.type === "anim") {
    // Los sub-frames deberían ser todos estáticos
    return entry.frames.filter((f) => {
      const e = grhMap.get(f);
      return e && e.type === "static";
    });
  }
  return [];
}

// Función: ¿tenemos el PNG para este GRH estático?
function hasPixels(grhId) {
  const entry = grhMap.get(grhId);
  if (!entry || entry.type !== "static") return false;
  return availableFileNums.has(entry.fileNum);
}

// Añadir al graficos.json los GRHs que encontramos en Graficos.ind
// y tienen PNG disponible, pero no estaban en el JSON previo.
let added = 0;
for (const [grhId, entry] of grhMap.entries()) {
  if (entry.type === "static" && availableFileNums.has(entry.fileNum)) {
    const key = grhId.toString();
    if (!graficosJson[key]) {
      graficosJson[key] = { f: entry.fileNum, x: entry.x, y: entry.y, w: entry.w, h: entry.h };
      added++;
    }
  }
}
console.log(`Añadidos ${added} GRHs estáticos a graficos.json`);

// GRHs ANIMADOS: los mapas referencian animaciones directamente (agua,
// fuego, costas). Los resolvemos a su PRIMER frame estático para que el
// tile se dibuje con los píxeles correctos, y además emitimos
// animaciones.json con la lista completa de frames + speed (para FX de
// hechizos y animación de tiles).
let addedAnim = 0;
const animaciones = {};
for (const [grhId, entry] of grhMap.entries()) {
  if (entry.type !== "anim" || entry.frames.length === 0) continue;
  const validFrames = entry.frames.filter((f) => {
    const e = grhMap.get(f);
    return e && e.type === "static" && availableFileNums.has(e.fileNum);
  });
  if (validFrames.length === 0) continue;
  animaciones[grhId.toString()] = { frames: validFrames, speed: entry.speed };
  const key = grhId.toString();
  if (!graficosJson[key]) {
    const first = grhMap.get(validFrames[0]);
    graficosJson[key] = { f: first.fileNum, x: first.x, y: first.y, w: first.w, h: first.h };
    addedAnim++;
  }
}
writeFileSync(resolve(ASSETS, "animaciones.json"), JSON.stringify(animaciones));
console.log(`Añadidos ${addedAnim} GRHs animados (primer frame) · animaciones.json: ${Object.keys(animaciones).length}`);

// ─── FXs de hechizos (fxs.ini del cliente original) ──────────────────────
// FX id → GRH animado + offset de dibujado sobre el objetivo.
try {
  const fxText = readFileSync(resolve(ASSETS, "fxs.ini"), "utf8");
  const fxs = {};
  let curFx = 0;
  for (const raw of fxText.split(/\r?\n/)) {
    const line = raw.trim();
    const fm = line.match(/^\[FX(\d+)\]$/i);
    if (fm) { curFx = parseInt(fm[1]); fxs[curFx] = { grh: 0, ox: 0, oy: 0 }; continue; }
    if (!curFx) continue;
    const am = line.match(/^Animacion=(\d+)/i);
    if (am) fxs[curFx].grh = parseInt(am[1]);
    const oxm = line.match(/^OffsetX=(-?\d+)/i);
    if (oxm) fxs[curFx].ox = parseInt(oxm[1]);
    const oym = line.match(/^OffsetY=(-?\d+)/i);
    if (oym) fxs[curFx].oy = parseInt(oym[1]);
  }
  writeFileSync(resolve(ASSETS, "fxs.json"), JSON.stringify(fxs));
  console.log(`✓ fxs.json: ${Object.keys(fxs).length} efectos`);
} catch {
  console.log("(fxs.ini no encontrado — se omite fxs.json)");
}

// ─── 2b. Equipamiento: Armas.dat / Escudos.dat / Cascos.ini ────────────────
// Overlays de arma/escudo (GRH animado por dirección, mismo orden Walk1-4 =
// [norte, este, sur, oeste]) y cascos (GRH estático por dirección).
function parseDirSections(filePath, sectionRe, keyRe) {
  const text = readFileSync(filePath, "latin1");
  const out = {};
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("'")[0].trim();
    if (!line) continue;
    const sm = line.match(sectionRe);
    if (sm) {
      cur = [0, 0, 0, 0];
      out[parseInt(sm[1])] = cur;
      continue;
    }
    if (!cur) continue;
    const km = line.match(keyRe);
    if (km) cur[parseInt(km[1]) - 1] = parseInt(km[2]);
  }
  return out;
}

try {
  const armasRaw = parseDirSections(resolve(ASSETS, "Armas.dat"), /^\[Arma(\d+)\]$/i, /^Dir([1-4])=(\d+)/i);
  const escudosRaw = parseDirSections(resolve(ASSETS, "Escudos.dat"), /^\[ESC(\d+)\]$/i, /^Dir([1-4])=(\d+)/i);
  const cascosRaw = parseDirSections(resolve(ASSETS, "Cascos.ini"), /^\[HEAD(\d+)\]$/i, /^Head([1-4])=(\d+)/i);

  // Armas/escudos: cada Dir es un GRH animado → resolver a frames estáticos.
  const resolveDirs = (raw) => {
    const out = {};
    for (const [id, dirs] of Object.entries(raw)) {
      const frames = dirs.map((g) => (g > 0 ? resolveToStaticFrames(g).filter(hasPixels) : []));
      if (frames.some((f) => f.length > 0)) out[id] = frames;
    }
    return out;
  };
  // Cascos: GRHs estáticos directos.
  const cascos = {};
  for (const [id, dirs] of Object.entries(cascosRaw)) {
    if (dirs.some((g) => g > 0 && hasPixels(g))) cascos[id] = dirs;
  }
  const equipamiento = { armas: resolveDirs(armasRaw), escudos: resolveDirs(escudosRaw), cascos };
  writeFileSync(resolve(ASSETS, "equipamiento.json"), JSON.stringify(equipamiento));
  console.log(
    `✓ equipamiento.json: ${Object.keys(equipamiento.armas).length} armas, ` +
    `${Object.keys(equipamiento.escudos).length} escudos, ${Object.keys(equipamiento.cascos).length} cascos`,
  );
} catch (err) {
  console.log(`(equipamiento omitido: ${err.message})`);
}

// ─── 3. Parsear Personajes.ini ────────────────────────────────────────────
function parsePersonajesIni(filePath) {
  const text = readFileSync(filePath, "latin1");
  const bodies = {};
  let cur = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("'")[0].trim();
    if (!line) continue;

    const bm = line.match(/^\[BODY(\d+)\]$/i);
    if (bm) {
      cur = { id: parseInt(bm[1]), walkGrhs: [0, 0, 0, 0], headOffset: { x: 0, y: 0 } };
      bodies[cur.id] = cur;
      continue;
    }
    if (!cur) continue;

    const wm = line.match(/^Walk([1-4])=(\d+)/i);
    if (wm) { cur.walkGrhs[parseInt(wm[1]) - 1] = parseInt(wm[2]); continue; }

    const hox = line.match(/^HeadOffsetX=(-?\d+)/i);
    if (hox) { cur.headOffset.x = parseInt(hox[1]); continue; }

    const hoy = line.match(/^HeadOffsetY=(-?\d+)/i);
    if (hoy) { cur.headOffset.y = parseInt(hoy[1]); continue; }
  }

  return bodies;
}

const personajesData = parsePersonajesIni(resolve(ASSETS, "Personajes.ini"));
console.log(`Personajes.ini: ${Object.keys(personajesData).length} cuerpos`);

// ─── 4. Parsear Cabezas.ind ───────────────────────────────────────────────
// Formato real (verificado con datos conocidos):
//   256 bytes: texto de header "Argentum Online by Noland Studios..."
//   1 byte: null terminator (offset 256)
//   8 bytes: metadata binaria (offset 257-264)
//   514 entradas × 16 bytes: datos de cabeza (offset 265+)
//     Cada entrada = 4 × Int32 LE: GRH_Norte, GRH_Este, GRH_Sur, GRH_Oeste
function parseCabezasInd(filePath) {
  const buf = readFileSync(filePath);
  const DATA_START = 265;
  const ENTRY_SIZE = 16; // 4 × Int32
  const numHeads = Math.floor((buf.length - DATA_START) / ENTRY_SIZE);
  console.log(`Cabezas.ind: ${numHeads} cabezas (data desde offset ${DATA_START})`);

  const heads = {};
  for (let i = 0; i < numHeads; i++) {
    const off = DATA_START + i * ENTRY_SIZE;
    const n = buf.readInt32LE(off);
    const e = buf.readInt32LE(off + 4);
    const s = buf.readInt32LE(off + 8);
    const o = buf.readInt32LE(off + 12);
    heads[i + 1] = { n, e, s, o };
  }

  return heads;
}

const cabezasData = parseCabezasInd(resolve(ASSETS, "Cabezas.ind"));

// ─── 5. Construir personajes.json ─────────────────────────────────────────

// Body IDs de JUGADORES (clases 1-6 usan bodyId 1, 2, 3).
// Estos van en "bodies". Todos los demás van en "monsterBodies".
// Los bodies 1-3 también van en monsterBodies porque los NPCs humanoides
// (guardia, mercader, banquero) usan bodyId=1 con kind="npc".
const PLAYER_BODY_IDS = new Set([1, 2, 3]);

const bodiesOut = {};
const monsterBodiesOut = {};
let skippedNoFrames = 0;
let skippedNoPng = 0;

for (const [idStr, body] of Object.entries(personajesData)) {
  const id = parseInt(idStr);
  // Walk: [norte(0), este(1), sur(2), oeste(3)]
  const walkFrames = body.walkGrhs.map((walkGrh) => {
    if (!walkGrh) return [];
    const frames = resolveToStaticFrames(walkGrh);
    return frames.filter(hasPixels);
  });

  const hasAny = walkFrames.some((d) => d.length > 0);
  if (!hasAny) {
    // Verificar si el Walk GRH existe pero no tenemos PNG
    const anyWalk = body.walkGrhs.find((g) => g > 0);
    if (anyWalk) {
      const frames = resolveToStaticFrames(anyWalk);
      if (frames.length === 0) skippedNoFrames++;
      else skippedNoPng++;
    }
    continue;
  }

  // Rellenar direcciones sin frames con la dirección sur (índice 2) o la que haya
  const southFrames = walkFrames[2].length > 0 ? walkFrames[2] : walkFrames.find((d) => d.length > 0) ?? [];
  const filled = walkFrames.map((d) => (d.length > 0 ? d : southFrames));

  const entry = { walkFrames: filled, headOffset: body.headOffset };

  if (PLAYER_BODY_IDS.has(id)) {
    // Los cuerpos de jugador van en bodies Y en monsterBodies
    // (los NPCs humanoides como guardia/mercader usan bodyId=1 con kind="npc")
    bodiesOut[idStr] = entry;
    monsterBodiesOut[idStr] = entry;
  } else {
    monsterBodiesOut[idStr] = entry;
  }
}

console.log(`Bodies de jugador: ${Object.keys(bodiesOut).length}`);
console.log(`Monster bodies (NPCs + jugadores humanoides): ${Object.keys(monsterBodiesOut).length}`);
console.log(`Skipped (no frames en Graficos.ind): ${skippedNoFrames}`);
console.log(`Skipped (sin PNG disponible): ${skippedNoPng}`);

// ─── 6. Construir cabezas ─────────────────────────────────────────────────
const headsOut = {};
let headHits = 0;
let headMiss = 0;

for (const [idStr, headGrhs] of Object.entries(cabezasData)) {
  const { n, e, s, o } = headGrhs;
  if (!n && !e && !s && !o) continue;

  // Verificar que al menos la cara sur existe y tiene PNG
  const sGrh = s || n || e || o;
  if (!sGrh || !hasPixels(sGrh)) {
    headMiss++;
    continue;
  }

  // Solo incluir si TODAS las direcciones tienen datos válidos (o rellenar con sur)
  const ns = n && hasPixels(n) ? n : sGrh;
  const es = e && hasPixels(e) ? e : sGrh;
  const ss = s && hasPixels(s) ? s : sGrh;
  const os = o && hasPixels(o) ? o : sGrh;

  headsOut[idStr] = { n: ns, e: es, s: ss, o: os };
  headHits++;
}

console.log(`Cabezas con PNG: ${headHits}, sin PNG: ${headMiss}`);

// ─── 7. Escribir archivos de salida ──────────────────────────────────────
const output = { bodies: bodiesOut, heads: headsOut, monsterBodies: monsterBodiesOut };
writeFileSync(resolve(ASSETS, "personajes.json"), JSON.stringify(output));
console.log(`\n✓ personajes.json: ${Object.keys(bodiesOut).length} player bodies, ${Object.keys(headsOut).length} heads, ${Object.keys(monsterBodiesOut).length} monster bodies`);

writeFileSync(resolve(ASSETS, "graficos.json"), JSON.stringify(graficosJson));
console.log(`✓ graficos.json: ${Object.keys(graficosJson).length} GRHs totales`);

// ─── 8. Mostrar qué bodies y heads tenemos disponibles ───────────────────
console.log("\n=== Bodies humanos disponibles ===");
for (const [id, b] of Object.entries(bodiesOut)) {
  const counts = b.walkFrames.map((d) => d.length).join(",");
  console.log(`  Body ${id}: frames por dir [${counts}], headOffset=${JSON.stringify(b.headOffset)}`);
}

console.log("\n=== Monster bodies disponibles ===");
const monsterIds = Object.keys(monsterBodiesOut).map(Number).sort((a,b) => a-b);
console.log(`  IDs: ${monsterIds.slice(0, 30).join(", ")}${monsterIds.length > 30 ? "..." : ""}`);
