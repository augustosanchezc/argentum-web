// Baja los assets necesarios para renderizar personajes y NPCs con los
// sprites reales del AO original (ao-libre/ao-cliente).
//
// Parsea Personajes.ind y Cabezas.ind (formato binario VB6), resuelve el
// walk cycle de cada dirección al Graficos.ind, y baja los PNGs que falten.
//
// Uso:
//   node scripts/fetch-char-assets.mjs [bodyIds] [headIds]
//
// Sin argumentos, baja el set mínimo del MVP:
//   - bodyIds:  humano básico + los ~10 body ids que usan los NPCs del Mapa1
//   - headIds:  cabeza del jugador por defecto + las cabezas de esos NPCs
//
// Salidas:
//   packages/client/public/ao-assets/personajes.json  (index por body/head)
//   packages/client/public/ao-assets/graficos/N.png   (solo los que falten)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const PERSONAJES_IND = resolve(ROOT, "packages/client/public/ao-assets/Personajes.ind");
const CABEZAS_IND = resolve(ROOT, "packages/client/public/ao-assets/Cabezas.ind");
const GRAFICOS_IND = resolve(ROOT, "packages/client/public/ao-assets/Graficos.ind");
const PERSONAJES_INI = resolve(ROOT, "packages/client/public/ao-assets/Personajes.ini");
const GRAFICOS_JSON = resolve(ROOT, "packages/client/public/ao-assets/graficos.json");
const PERSONAJES_JSON = resolve(ROOT, "packages/client/public/ao-assets/personajes.json");
const PNG_DIR = resolve(ROOT, "packages/client/public/ao-assets/graficos");
const CLIENT_REPO_RAW = "https://raw.githubusercontent.com/ao-libre/ao-cliente/master/Graficos";

// Header comun a Personajes.ind y Cabezas.ind: Desc 255 + CRC u32 + Magic u32.
const IND_HEADER_BYTES = 255 + 4 + 4;

// Selección por defecto: humano básico + set del MVP.
// bodyIds y headIds pueden ser sobreescritos por argv[2] y argv[3] (CSV).
const DEFAULT_BODY_IDS = [1];   // humano/aventurero base
const DEFAULT_HEAD_IDS = [1];   // cabeza clasica

// Body IDs de Personajes.ini para NPCs monstruo del MVP.
//   10 = lobo (agresivo, 4 frames animados por dir)
//   71 = rata (2 frames animados por dir)
const DEFAULT_MONSTER_BODY_IDS = [10, 71];

// Grh estáticos extra que queremos siempre disponibles en el cliente.
// Vienen de shared/items.ts (GrhIndex del obj.dat de ao-libre).
const EXTRA_GRH_IDS = [
  542, // Poción Roja (HP)
  510, // Daga
  504, // Espada larga
  526, // Armadura de cuero
  559, // Casco de hierro
];

// --- parsers ---

function parsePersonajes(buf) {
  const numBodies = buf.readUInt16LE(IND_HEADER_BYTES);
  const bodies = new Map();
  let off = IND_HEADER_BYTES + 2;
  for (let i = 1; i <= numBodies; i += 1) {
    const walk = [
      buf.readUInt32LE(off),      // norte
      buf.readUInt32LE(off + 4),  // este
      buf.readUInt32LE(off + 8),  // sur
      buf.readUInt32LE(off + 12), // oeste
    ];
    const headOffsetX = buf.readInt16LE(off + 16);
    const headOffsetY = buf.readInt16LE(off + 18);
    bodies.set(i, { walk, headOffsetX, headOffsetY });
    off += 20;
  }
  return bodies;
}

// Parser mínimo de Personajes.ini para NPCs monstruo. Formato:
//   [BODYn]
//   Walk1=<grh_norte>
//   Walk2=<grh_este>
//   Walk3=<grh_sur>
//   Walk4=<grh_oeste>
//   HeadOffsetX=..
//   HeadOffsetY=..
function parseMonsterBodies(text, ids) {
  const wantedIds = new Set(ids);
  const out = new Map();
  const lines = text.split(/\r?\n/);
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("'")) continue;
    const sectionMatch = /^\[BODY(\d+)\]/i.exec(line);
    if (sectionMatch) {
      const id = Number(sectionMatch[1]);
      current = wantedIds.has(id) ? { id, walk: [0, 0, 0, 0] } : null;
      if (current) out.set(id, current);
      continue;
    }
    if (!current) continue;
    // Los Walk vienen con comentarios "	' arriba"; corto en tab o comilla.
    const kv = /^(\w+)\s*=\s*([^\s'#]+)/.exec(line);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const val = Number(kv[2]);
    if (Number.isNaN(val)) continue;
    if (key === "walk1") current.walk[0] = val;
    else if (key === "walk2") current.walk[1] = val;
    else if (key === "walk3") current.walk[2] = val;
    else if (key === "walk4") current.walk[3] = val;
  }
  return out;
}

function parseCabezas(buf) {
  const numHeads = buf.readUInt16LE(IND_HEADER_BYTES);
  const heads = new Map();
  let off = IND_HEADER_BYTES + 2;
  for (let i = 1; i <= numHeads; i += 1) {
    const heads4 = [
      buf.readUInt32LE(off),      // norte
      buf.readUInt32LE(off + 4),  // este
      buf.readUInt32LE(off + 8),  // sur
      buf.readUInt32LE(off + 12), // oeste
    ];
    heads.set(i, { heads: heads4 });
    off += 16;
  }
  return heads;
}

// Reutilizado de fetch-ulla-assets.
function parseGraficosInd(buf) {
  buf.readUInt32LE(0); // fileVersion (no usada)
  const grhCount = buf.readUInt32LE(4);
  let off = 8;
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
  void grhCount;
  return grhData;
}

// Devuelve una lista plana de todos los grh ids estaticos que compone el
// walk del cuerpo/cabeza (siguiendo animaciones a sus frames base).
function resolveWalkFrames(grhData, grh) {
  const data = grhData.get(grh);
  if (!data) return [];
  if (data.numFrames === 1) return [grh];
  return data.frames.slice(); // ya son grh ids estaticos
}

// --- main ---

async function main() {
  const argv = process.argv.slice(2);
  const bodyIds = argv[0]
    ? argv[0].split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
    : DEFAULT_BODY_IDS;
  const headIds = argv[1]
    ? argv[1].split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
    : DEFAULT_HEAD_IDS;

  console.log(`bodies:  ${bodyIds.join(",")}`);
  console.log(`heads:   ${headIds.join(",")}`);

  console.log("Parsing Personajes.ind...");
  const bodies = parsePersonajes(readFileSync(PERSONAJES_IND));
  console.log(`  → ${bodies.size} cuerpos`);

  console.log("Parsing Cabezas.ind...");
  const heads = parseCabezas(readFileSync(CABEZAS_IND));
  console.log(`  → ${heads.size} cabezas`);

  console.log("Parsing Graficos.ind...");
  const grhData = parseGraficosInd(readFileSync(GRAFICOS_IND));

  // Extendemos el graficos.json existente con las nuevas entradas.
  const existingIndex = existsSync(GRAFICOS_JSON)
    ? JSON.parse(readFileSync(GRAFICOS_JSON, "utf-8"))
    : {};

  const grhsNeeded = new Set();

  // Personajes.json:
  //   bodies:        {id: {walkFrames: [[n],[e],[s],[o]], headOffset: {x,y}}}
  //   heads:         {id: {n,e,s,o}}
  //   monsterBodies: {id: {walkFrames: [[n],[e],[s],[o]]}}   (sin cabeza separada)
  const personajesJson = { bodies: {}, heads: {}, monsterBodies: {} };

  for (const id of bodyIds) {
    const b = bodies.get(id);
    if (!b) {
      console.warn(`  ! body ${id} no existe`);
      continue;
    }
    const walkFrames = b.walk.map((grh) => {
      const frames = resolveWalkFrames(grhData, grh);
      frames.forEach((f) => grhsNeeded.add(f));
      return frames;
    });
    personajesJson.bodies[id] = {
      walkFrames,
      headOffset: { x: b.headOffsetX, y: b.headOffsetY },
    };
  }

  for (const id of headIds) {
    const h = heads.get(id);
    if (!h) {
      console.warn(`  ! head ${id} no existe`);
      continue;
    }
    // Las cabezas suelen ser grhs estaticos (NumFrames=1).
    h.heads.forEach((grh) => grhsNeeded.add(grh));
    personajesJson.heads[id] = { n: h.heads[0], e: h.heads[1], s: h.heads[2], o: h.heads[3] };
  }

  // Grhs extra (íconos de items, etc). Los resolvemos como cualquier otro:
  // si son estáticos, van directo al índice; si son animados, tomamos el
  // primer frame.
  for (const grh of EXTRA_GRH_IDS) {
    const data = grhData.get(grh);
    if (!data) {
      console.warn(`  ! grh ${grh} no existe en Graficos.ind`);
      continue;
    }
    if (data.numFrames === 1) {
      grhsNeeded.add(grh);
    } else {
      grhsNeeded.add(data.frames[0]);
    }
  }

  // Monster bodies (rata, lobo, etc): parseamos Personajes.ini, resolvemos
  // el walk cycle de cada dirección al Graficos.ind y añadimos al JSON.
  console.log("Parsing Personajes.ini...");
  const monsterBodies = parseMonsterBodies(
    readFileSync(PERSONAJES_INI, "utf-8"),
    DEFAULT_MONSTER_BODY_IDS,
  );
  console.log(`  → ${monsterBodies.size} monster bodies`);
  for (const [id, mb] of monsterBodies.entries()) {
    const walkFrames = mb.walk.map((grh) => {
      const frames = resolveWalkFrames(grhData, grh);
      frames.forEach((f) => grhsNeeded.add(f));
      return frames;
    });
    personajesJson.monsterBodies[id] = { walkFrames };
  }

  // Resolvemos cada grh a su entrada del graficos.json global (fileNum + rect).
  const fileNums = new Set();
  for (const grh of grhsNeeded) {
    const data = grhData.get(grh);
    if (!data) continue;
    if (data.numFrames === 1) {
      existingIndex[grh] = {
        f: data.fileNum,
        x: data.sX,
        y: data.sY,
        w: data.w,
        h: data.h,
      };
      fileNums.add(data.fileNum);
    }
  }

  mkdirSync(PNG_DIR, { recursive: true });
  writeFileSync(GRAFICOS_JSON, JSON.stringify(existingIndex));
  writeFileSync(PERSONAJES_JSON, JSON.stringify(personajesJson));
  console.log(`Wrote personajes.json (${bodyIds.length} bodies, ${headIds.length} heads)`);
  console.log(`Merged graficos.json (+${grhsNeeded.size} grhs -> ${fileNums.size} PNGs)`);

  const toDownload = [...fileNums].filter((fn) => !existsSync(resolve(PNG_DIR, `${fn}.png`)));
  console.log(`Downloading ${toDownload.length} PNGs faltantes...`);
  let i = 0;
  for (const fn of toDownload) {
    const outPath = resolve(PNG_DIR, `${fn}.png`);
    const res = await fetch(`${CLIENT_REPO_RAW}/${fn}.png`);
    if (!res.ok) {
      console.warn(`\n[skip] ${fn}.png -> ${res.status}`);
      continue;
    }
    writeFileSync(outPath, new Uint8Array(await res.arrayBuffer()));
    process.stdout.write(`.`);
    i += 1;
    if (i % 20 === 0) process.stdout.write(` ${i}/${toDownload.length}\n`);
  }
  console.log(`\nDone.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
