import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getItem, isWaterGraphic, type Vector2 } from "@ao/shared";
import { AO_MAP_HEIGHT, AO_MAP_WIDTH, loadAoMap } from "./ao-map-loader.js";

export interface PortalTile {
  readonly x: number;
  readonly y: number;
  readonly toMapId: number;
  readonly toX: number;
  readonly toY: number;
}

// Portales agregados por este server (no vienen del .inf original del AO).
// El AO Libre coloca teleports con /CT en runtime; acá los declaramos fijos.
// `grh`/`objId` son el gráfico y objeto reales del AO (obj.dat OBJ144
// "Teleport a Dungeon Newbie", GrhIndex 669, ObjType 19) para que el
// teleport se vea y sea clickeable, no una tile invisible inventada.
interface ExtraPortal extends PortalTile {
  readonly grh: number;
  readonly objId: number;
}
// Teleport para newbies en Ullathorpe (1) que lleva al Dungeon Newbie (167).
const EXTRA_PORTALS: Readonly<Record<number, ReadonlyArray<ExtraPortal>>> = {
  1: [{ x: 50, y: 47, toMapId: 167, toX: 50, toY: 51, grh: 669, objId: 144 }],
};

// Spawn de NPC nativo del mapa: viene del npcIndex de los tiles del .inf
// del AO original. `npcNumber` referencia una entrada de NPCs.dat.
export interface NpcSpawnTile {
  readonly x: number;
  readonly y: number;
  readonly npcNumber: number;
}

export interface MapState {
  readonly id: number;
  readonly name: string;
  // Zona segura (ciudad): sin PvP. Viene del Pk= del MapaN.dat original
  // (quirk del server VB6: Pk=1 significa "seguro").
  readonly safeZone: boolean;
  // Música del mapa (MusicNumMp3 del MapaN.dat — MP3 oficial del AO Libre).
  readonly music: number;
  readonly width: number;
  readonly height: number;
  // Arrays planos length = width * height, indexados por y*width + x.
  readonly graphic: ReadonlyArray<number>; // capa 1: suelo
  readonly layer2: ReadonlyArray<number>;  // decoración de suelo
  readonly layer3: ReadonlyArray<number>;  // objetos (árboles, paredes)
  readonly layer4: ReadonlyArray<number>;  // techos
  readonly trigger: ReadonlyArray<number>; // 1/2/4 = bajo techo
  readonly blocked: ReadonlyArray<number>; // 1 / 0
  // 1 = agua (solo navegable con barco). Precomputado del gráfico de suelo.
  readonly water: ReadonlyArray<number>;
  readonly spawn: Vector2;
  // Tiles que teletransportan al jugador a otro mapa al pisarlos.
  // Extraídos de los exits nativos del .inf del AO original.
  readonly portals: ReadonlyArray<PortalTile>;
  // NPCs colocados en el mapa por el .inf original.
  readonly npcSpawns: ReadonlyArray<NpcSpawnTile>;
  // Objetos del mapa (.inf objIndex): árboles, yacimientos, yunques,
  // fraguas, puertas, carteles — indexados por y*width+x.
  readonly objects: ReadonlyMap<number, { readonly item: number; readonly amount: number }>;
}

// Donde quedan los assets de los mapas. En el repo viven en
// packages/server/data/maps/. resolve desde este archivo soporta
// tanto el dev-mode (tsx) como el build (dist/).
const HERE = dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = resolve(HERE, "..", "..", "data", "maps");

// Metadata real del mapa: MapaN.dat del ao-server original.
//   Name= nombre canónico · Pk=1 → zona segura (ciudad, sin PvP)
//   (quirk histórico del VB6: Pk "1" es seguro, "0"/ausente es inseguro)
interface MapMeta {
  readonly name: string;
  readonly safeZone: boolean;
  readonly music: number;
}

function loadMapMeta(mapId: number): MapMeta {
  const fallback: MapMeta = { name: `Mapa ${mapId.toString()}`, safeZone: false, music: 0 };
  try {
    const text = readFileSync(resolve(MAPS_DIR, `Mapa${mapId.toString()}.dat`), "latin1");
    let name = fallback.name;
    let safeZone = false;
    let music = 0;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      const nm = line.match(/^Name=(.+)$/i);
      if (nm) name = nm[1].trim();
      const pk = line.match(/^Pk=\s*(\d+)/i);
      if (pk) safeZone = pk[1] === "1";
      const mus = line.match(/^MusicNumMp3=\s*(\d+)/i);
      if (mus) music = parseInt(mus[1], 10);
    }
    return { name, safeZone, music };
  } catch {
    return fallback;
  }
}

function findNearestWalkable(
  blocked: ReadonlyArray<number>,
  width: number,
  height: number,
  origin: Vector2,
): Vector2 {
  const isWalkableIdx = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && blocked[y * width + x] === 0;

  if (isWalkableIdx(origin.x, origin.y)) return origin;
  for (let r = 1; r < Math.max(width, height); r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (isWalkableIdx(x, y)) return { x, y };
      }
    }
  }
  return origin;
}

// Tile transitable A PIE (ni bloqueado ni agua) más cercano al origen. Para
// validar destinos de portales: hay portales nativos cuyo destino cae en agua
// abierta o en tiles sellados — el jugador quedaba varado para siempre.
export function findLandingTile(map: MapState, origin: Vector2): Vector2 {
  const ok = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height &&
    map.blocked[y * map.width + x] === 0 && map.water[y * map.width + x] === 0;
  if (ok(origin.x, origin.y)) return origin;
  for (let r = 1; r < Math.max(map.width, map.height); r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (ok(x, y)) return { x, y };
      }
    }
  }
  return origin;
}

// Intenta cargar un mapa; devuelve null si el archivo no existe.
// Mapa gráfico-de-puerta-cerrada → puerta abierta {item, graphic}, derivado de
// los pares del catálogo (una puerta CERRADA apunta a su abierta vía
// indexAbierta). Sirve para abrir puertas con llave (indexAbierta 0) por gráfico.
let _doorOpenByClosedGrh: Map<number, { item: number; graphic: number }> | null = null;
function doorOpenByClosedGrh(): Map<number, { item: number; graphic: number }> {
  if (_doorOpenByClosedGrh) return _doorOpenByClosedGrh;
  const m = new Map<number, { item: number; graphic: number }>();
  for (let id = 1; id <= 2000; id += 1) {
    const d = getItem(id);
    if (!d || d.objType !== 6) continue;
    const openId = d.indexAbierta ?? 0;
    if (openId > 0 && openId !== id) {
      const openDef = getItem(openId);
      if (openDef) m.set(d.graphic, { item: openId, graphic: openDef.graphic });
    }
  }
  _doorOpenByClosedGrh = m;
  return m;
}

function tryLoadMap(mapId: number): MapState | null {
  try {
    const raw = loadAoMap({ mapId, dataDir: MAPS_DIR });
    const total = raw.width * raw.height;
    const graphic = new Array<number>(total);
    const layer2 = new Array<number>(total);
    const layer3 = new Array<number>(total);
    const layer4 = new Array<number>(total);
    const trigger = new Array<number>(total);
    const blocked = new Array<number>(total);
    const water = new Array<number>(total);
    for (let i = 0; i < total; i += 1) {
      graphic[i] = raw.tiles[i].graphic1;
      layer2[i] = raw.tiles[i].graphic2;
      layer3[i] = raw.tiles[i].graphic3;
      layer4[i] = raw.tiles[i].graphic4;
      trigger[i] = raw.tiles[i].trigger;
      blocked[i] = raw.tiles[i].blocked ? 1 : 0;
      water[i] = isWaterGraphic(graphic[i]!) ? 1 : 0;
    }

    // Los exits del .inf del AO usan coords 1-based (VB6). Convertimos a
    // 0-based restando 1, clampamos al rango válido.
    const portals: PortalTile[] = [];
    const npcSpawns: NpcSpawnTile[] = [];
    const objects = new Map<number, { item: number; amount: number }>();
    for (let y = 0; y < raw.height; y += 1) {
      for (let x = 0; x < raw.width; x += 1) {
        const tile = raw.tiles[y * raw.width + x];
        if (tile.exit && tile.exit.mapId > 0) {
          portals.push({
            x,
            y,
            toMapId: tile.exit.mapId,
            toX: Math.max(0, tile.exit.x - 1),
            toY: Math.max(0, tile.exit.y - 1),
          });
        }
        if (tile.npcIndex > 0) {
          npcSpawns.push({ x, y, npcNumber: tile.npcIndex });
        }
        if (tile.objIndex > 0) {
          objects.set(y * raw.width + x, { item: tile.objIndex, amount: tile.objAmount });
        }
      }
    }
    // Portales custom del server (teleport newbie de Ulla, etc.): además del
    // exit, colocamos el gráfico (layer3) y el objeto real del AO en la tile
    // para que se vea y muestre su nombre al clickearlo.
    for (const extra of EXTRA_PORTALS[mapId] ?? []) {
      portals.push({ x: extra.x, y: extra.y, toMapId: extra.toMapId, toX: extra.toX, toY: extra.toY });
      const idx = extra.y * raw.width + extra.x;
      layer3[idx] = extra.grh;
      objects.set(idx, { item: extra.objId, amount: 1 });
    }

    // #6: TODAS las puertas siempre abiertas (incluso con llave). Al cargar el
    // mapa abrimos cada puerta (objType 6): gráfico de puerta abierta + tile
    // transitable. Nunca se cierran (handleTileInteract las ignora).
    for (const [idx, obj] of objects) {
      const def = getItem(obj.item);
      if (!def || def.objType !== 6) continue;
      let openId = obj.item;
      let openGrh = def.graphic;
      if ((def.indexAbierta ?? 0) > 0) {
        // Variante con contraparte abierta directa.
        openId = def.indexAbierta!;
        openGrh = getItem(openId)?.graphic ?? def.graphic;
      } else {
        // Puerta con llave (indexAbierta 0): mapear por gráfico cerrado→abierto.
        const byGrh = doorOpenByClosedGrh().get(def.graphic);
        if (byGrh) { openId = byGrh.item; openGrh = byGrh.graphic; }
      }
      objects.set(idx, { item: openId, amount: obj.amount });
      layer3[idx] = openGrh;
      blocked[idx] = 0;
      if (idx % raw.width > 0) blocked[idx - 1] = 0; // tile oeste (puerta = 2 tiles)
    }

    const fallbackSpawn: Vector2 = { x: 50, y: 50 };
    const spawn = findNearestWalkable(blocked, raw.width, raw.height, fallbackSpawn);
    const meta = loadMapMeta(mapId);
    return {
      id: mapId,
      name: meta.name,
      safeZone: meta.safeZone,
      music: meta.music,
      width: raw.width,
      height: raw.height,
      graphic,
      layer2,
      layer3,
      layer4,
      trigger,
      blocked,
      water,
      spawn,
      portals,
      npcSpawns,
      objects,
    };
  } catch {
    return null;
  }
}

// Carga el mapa raíz (id=1) y todos los mapas alcanzables por sus portales
// (BFS). Los mapas sin archivo .map/.inf en data/maps/ se saltan graciosamente;
// sus portales simplemente no se activan en el servidor.
const maps = new Map<number, MapState>();

(function initMaps(): void {
  const queue: number[] = [1];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const mapId = queue.shift()!;
    if (visited.has(mapId)) continue;
    visited.add(mapId);

    const state = tryLoadMap(mapId);
    if (!state) continue;

    maps.set(mapId, state);
    for (const portal of state.portals) {
      if (!visited.has(portal.toMapId)) queue.push(portal.toMapId);
    }
  }
})();

export function getMap(mapId: number): MapState | undefined {
  return maps.get(mapId);
}

// navigating: en barco solo se navega por agua; a pie solo por tierra (AO).
export function isWalkable(map: MapState, x: number, y: number, navigating = false): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const idx = y * map.width + x;
  if (map.blocked[idx] !== 0) return false;
  const isWater = map.water[idx] === 1;
  return navigating ? isWater : !isWater;
}

export function isWaterAt(map: MapState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return map.water[y * map.width + x] === 1;
}

export function loadedMapIds(): number[] {
  return [...maps.keys()];
}

// Puertas (AccionParaPuerta del AO): mutan el objeto y el bloqueo de un tile
// en runtime. Los arrays/mapas son de solo-lectura para el resto del código;
// estas dos funciones son el único punto de mutación.
export function setTileObject(map: MapState, x: number, y: number, item: number): void {
  (map.objects as Map<number, { item: number; amount: number }>).set(y * map.width + x, {
    item,
    amount: 1,
  });
}

export function setTileBlocked(map: MapState, x: number, y: number, blocked: boolean): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  (map.blocked as number[])[y * map.width + x] = blocked ? 1 : 0;
}

// Re-exports para que otros modulos no tengan que conocer el path interno.
export { AO_MAP_WIDTH, AO_MAP_HEIGHT };
