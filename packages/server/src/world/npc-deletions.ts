// NPCs eliminados por un GM en runtime (/eliminarnpc). Los NPCs se re-crean de
// los .inf de los mapas en cada arranque, así que para que una eliminación
// SOBREVIVA a los redeploy la PERSISTIMOS en el volumen (data/overrides/
// npc-deletions.json) y, al poblar el mundo, salteamos los que estén en la lista.
//
// Se identifica cada NPC por (mapId, npcNumber, x, y) usando la posición de spawn
// ya resuelta (findWalkableNear es determinístico, así que la misma tile del .inf
// da la misma posición en cada arranque → el match es estable).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";

const DELETIONS_PATH = overridePath("npc-deletions.json");

interface NpcDeletion {
  readonly mapId: number;
  readonly npcNumber: number;
  readonly x: number;
  readonly y: number;
}

const deletions: NpcDeletion[] = [];
try {
  const text = readOverrideOrSeed("npc-deletions.json");
  if (text) {
    const arr = JSON.parse(text) as NpcDeletion[];
    if (Array.isArray(arr)) deletions.push(...arr);
  }
} catch {
  // sin eliminaciones guardadas todavía
}

function persist(): void {
  try {
    mkdirSync(dirname(DELETIONS_PATH), { recursive: true });
    writeFileSync(DELETIONS_PATH, JSON.stringify(deletions, null, 2));
  } catch {
    // disco de solo lectura: vive en memoria hasta reiniciar
  }
}

export function isNpcDeleted(mapId: number, npcNumber: number, x: number, y: number): boolean {
  return deletions.some((d) => d.mapId === mapId && d.npcNumber === npcNumber && d.x === x && d.y === y);
}

export function addNpcDeletion(mapId: number, npcNumber: number, x: number, y: number): void {
  if (isNpcDeleted(mapId, npcNumber, x, y)) return;
  deletions.push({ mapId, npcNumber, x, y });
  persist();
}
