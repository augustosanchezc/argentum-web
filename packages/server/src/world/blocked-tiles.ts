// Tiles bloqueados por un GM en runtime (/blockpiso). Los mapas se recargan de
// los .map/.inf en cada arranque, así que para que un bloqueo SOBREVIVA a los
// redeploy lo PERSISTIMOS en el volumen (data/overrides/blocked-tiles.json) y lo
// re-aplicamos al arrancar (setTileBlocked sobre el mapa ya cargado). Espejo de
// world/teleports.ts.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getMap, setTileBlocked } from "./maps.js";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";

const BLOCKS_PATH = overridePath("blocked-tiles.json");

interface BlockedTile {
  readonly mapId: number;
  readonly x: number;
  readonly y: number;
}

const blocks: BlockedTile[] = [];
try {
  const text = readOverrideOrSeed("blocked-tiles.json");
  if (text) {
    const arr = JSON.parse(text) as BlockedTile[];
    if (Array.isArray(arr)) blocks.push(...arr);
  }
} catch {
  // sin bloqueos guardados todavía
}

function persist(): void {
  try {
    mkdirSync(dirname(BLOCKS_PATH), { recursive: true });
    writeFileSync(BLOCKS_PATH, JSON.stringify(blocks, null, 2));
  } catch {
    // disco de solo lectura: vive en memoria hasta reiniciar
  }
}

// Re-aplica todos los bloqueos guardados a los mapas ya cargados (al arrancar).
export function applyStoredBlocks(): number {
  for (const b of blocks) {
    const map = getMap(b.mapId);
    if (map) setTileBlocked(map, b.x, b.y, true);
  }
  return blocks.length;
}

export function isBlockStored(mapId: number, x: number, y: number): boolean {
  return blocks.some((b) => b.mapId === mapId && b.x === x && b.y === y);
}

// Bloquea el tile (lo aplica al mapa + persiste).
export function addBlock(mapId: number, x: number, y: number): void {
  if (isBlockStored(mapId, x, y)) return;
  blocks.push({ mapId, x, y });
  const map = getMap(mapId);
  if (map) setTileBlocked(map, x, y, true);
  persist();
}

// Desbloquea el tile (lo saca del guardado + lo libera). Devuelve true si estaba.
export function removeBlock(mapId: number, x: number, y: number): boolean {
  const idx = blocks.findIndex((b) => b.mapId === mapId && b.x === x && b.y === y);
  if (idx < 0) return false;
  blocks.splice(idx, 1);
  const map = getMap(mapId);
  if (map) setTileBlocked(map, x, y, false);
  persist();
  return true;
}
