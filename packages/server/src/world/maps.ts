import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Vector2 } from "@ao/shared";
import { AO_MAP_HEIGHT, AO_MAP_WIDTH, loadAoMap } from "./ao-map-loader.js";

export interface PortalTile {
  readonly x: number;
  readonly y: number;
  readonly toMapId: number;
  readonly toX: number;
  readonly toY: number;
}

export interface MapState {
  readonly id: number;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  // Arrays planos length = width * height, indexados por y*width + x.
  readonly graphic: ReadonlyArray<number>;
  readonly blocked: ReadonlyArray<number>; // 1 / 0
  readonly spawn: Vector2;
  // Tiles que teletransportan al jugador a otro mapa al pisarlos.
  // Extraídos de los exits nativos del .inf del AO original.
  readonly portals: ReadonlyArray<PortalTile>;
}

// Donde quedan los assets de los mapas. En el repo viven en
// packages/server/data/maps/. resolve desde este archivo soporta
// tanto el dev-mode (tsx) como el build (dist/).
const HERE = dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = resolve(HERE, "..", "..", "data", "maps");

// Nombres canónicos de los mapas conocidos. Los demás reciben "Mapa N".
const MAP_NAMES: Record<number, string> = {
  1: "Ciudad de Ullathorpe",
};

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

// Intenta cargar un mapa; devuelve null si el archivo no existe.
function tryLoadMap(mapId: number): MapState | null {
  try {
    const raw = loadAoMap({ mapId, dataDir: MAPS_DIR });
    const total = raw.width * raw.height;
    const graphic = new Array<number>(total);
    const blocked = new Array<number>(total);
    for (let i = 0; i < total; i += 1) {
      graphic[i] = raw.tiles[i].graphic1;
      blocked[i] = raw.tiles[i].blocked ? 1 : 0;
    }

    // Los exits del .inf del AO usan coords 1-based (VB6). Convertimos a
    // 0-based restando 1, clampamos al rango válido.
    const portals: PortalTile[] = [];
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
      }
    }

    const fallbackSpawn: Vector2 = { x: 50, y: 50 };
    const spawn = findNearestWalkable(blocked, raw.width, raw.height, fallbackSpawn);
    return {
      id: mapId,
      name: MAP_NAMES[mapId] ?? `Mapa ${mapId.toString()}`,
      width: raw.width,
      height: raw.height,
      graphic,
      blocked,
      spawn,
      portals,
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

export function isWalkable(map: MapState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return map.blocked[y * map.width + x] === 0;
}

export function loadedMapIds(): number[] {
  return [...maps.keys()];
}

// Re-exports para que otros modulos no tengan que conocer el path interno.
export { AO_MAP_WIDTH, AO_MAP_HEIGHT };
