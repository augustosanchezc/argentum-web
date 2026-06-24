import type { Vector2 } from "@ao/shared";

// Tile types:
//   0 = grass (caminable)
//   1 = wall  (no caminable)
//   2 = water (no caminable, visual distinto)
export const TILE_GRASS = 0;
export const TILE_WALL = 1;
export const TILE_WATER = 2;

const WALKABLE = new Set<number>([TILE_GRASS]);

export interface MapState {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly tiles: ReadonlyArray<number>;
  readonly spawn: Vector2;
}

// PRNG determinista (mulberry32). Garantiza que el mapa generado sea
// reproducible entre arranques del servidor y entre instancias.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateInitialMap(): MapState {
  const width = 50;
  const height = 50;
  const tiles = new Array<number>(width * height).fill(TILE_GRASS);

  // Borde de paredes
  for (let x = 0; x < width; x += 1) {
    tiles[x] = TILE_WALL;
    tiles[(height - 1) * width + x] = TILE_WALL;
  }
  for (let y = 0; y < height; y += 1) {
    tiles[y * width] = TILE_WALL;
    tiles[y * width + (width - 1)] = TILE_WALL;
  }

  // Charco rectangular como referencia visual
  for (let yy = 18; yy < 26; yy += 1) {
    for (let xx = 32; xx < 40; xx += 1) {
      tiles[yy * width + xx] = TILE_WATER;
    }
  }

  // Algunas paredes salpicadas para que el mapa no se vea totalmente vacio
  const rng = mulberry32(0xa01337);
  let placed = 0;
  for (let attempts = 0; attempts < 200 && placed < 35; attempts += 1) {
    const x = 2 + Math.floor(rng() * (width - 4));
    const y = 2 + Math.floor(rng() * (height - 4));
    const idx = y * width + x;
    if (tiles[idx] === TILE_GRASS) {
      tiles[idx] = TILE_WALL;
      placed += 1;
    }
  }

  // Spawn por defecto en el centro
  return {
    id: 1,
    width,
    height,
    tiles,
    spawn: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
  };
}

const maps = new Map<number, MapState>();
maps.set(1, generateInitialMap());

export function getMap(mapId: number): MapState | undefined {
  return maps.get(mapId);
}

export function isWalkable(map: MapState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tile = map.tiles[y * map.width + x];
  return tile !== undefined && WALKABLE.has(tile);
}
