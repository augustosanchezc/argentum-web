import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Vector2 } from "@ao/shared";
import { AO_MAP_HEIGHT, AO_MAP_WIDTH, loadAoMap } from "./ao-map-loader.js";

export interface MapState {
  readonly id: number;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  // Arrays planos length = width * height, indexados por y*width + x.
  readonly graphic: ReadonlyArray<number>;
  readonly blocked: ReadonlyArray<number>; // 1 / 0
  readonly spawn: Vector2;
}

// Donde quedan los assets de los mapas. En el repo viven en
// packages/server/data/maps/. resolve desde este archivo soporta
// tanto el dev-mode (tsx) como el build (dist/).
const HERE = dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = resolve(HERE, "..", "..", "data", "maps");

// Spawn por defecto en Ullathorpe — cerca de la plaza central. Si el tile
// resulta bloqueado, search hacia afuera el primer tile caminable.
const ULLA_FALLBACK_SPAWN: Vector2 = { x: 50, y: 50 };

function findNearestWalkable(
  blocked: ReadonlyArray<number>,
  width: number,
  height: number,
  origin: Vector2,
): Vector2 {
  const isWalkableIdx = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && blocked[y * width + x] === 0;

  if (isWalkableIdx(origin.x, origin.y)) return origin;
  // Busqueda en espiral: anillos crecientes alrededor del origen
  // hasta encontrar un tile caminable.
  for (let r = 1; r < Math.max(width, height); r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        // Solo el borde del anillo
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (isWalkableIdx(x, y)) return { x, y };
      }
    }
  }
  return origin;
}

function loadMap(mapId: number, fallbackSpawn: Vector2, name: string): MapState {
  const raw = loadAoMap({ mapId, dataDir: MAPS_DIR });
  const total = raw.width * raw.height;
  const graphic = new Array<number>(total);
  const blocked = new Array<number>(total);
  for (let i = 0; i < total; i += 1) {
    graphic[i] = raw.tiles[i].graphic1;
    blocked[i] = raw.tiles[i].blocked ? 1 : 0;
  }
  const spawn = findNearestWalkable(blocked, raw.width, raw.height, fallbackSpawn);
  return {
    id: mapId,
    name,
    width: raw.width,
    height: raw.height,
    graphic,
    blocked,
    spawn,
  };
}

const maps = new Map<number, MapState>();
maps.set(1, loadMap(1, ULLA_FALLBACK_SPAWN, "Ciudad de Ullathorpe"));

export function getMap(mapId: number): MapState | undefined {
  return maps.get(mapId);
}

export function isWalkable(map: MapState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return map.blocked[y * map.width + x] === 0;
}

// Re-exports para que otros modulos no tengan que conocer el path interno.
export { AO_MAP_WIDTH, AO_MAP_HEIGHT };
