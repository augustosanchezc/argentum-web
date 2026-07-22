// NPCs invocados por un GM (/invocar). No provienen de los .inf de los mapas, así
// que para que SOBREVIVAN a un reinicio/redeploy los PERSISTIMOS en el volumen
// (data/overrides/gm-npcs.json) y los re-invocamos al poblar el mundo. Solo un GM
// puede sacarlos (/eliminarnpc), lo que los quita de esta lista.
//
// Se identifica cada uno por (mapId, npcNumber, x, y) usando la posición de spawn
// ya resuelta por findWalkableNear (determinística → el match es estable entre
// arranques, igual que npc-deletions).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";

const GM_NPCS_PATH = overridePath("gm-npcs.json");

export interface GmNpc {
  readonly mapId: number;
  readonly npcNumber: number;
  readonly x: number;
  readonly y: number;
}

const gmNpcs: GmNpc[] = [];
try {
  const text = readOverrideOrSeed("gm-npcs.json");
  if (text) {
    const arr = JSON.parse(text) as GmNpc[];
    if (Array.isArray(arr)) gmNpcs.push(...arr);
  }
} catch {
  // sin NPCs invocados guardados todavía
}

function persist(): void {
  try {
    mkdirSync(dirname(GM_NPCS_PATH), { recursive: true });
    writeFileSync(GM_NPCS_PATH, JSON.stringify(gmNpcs, null, 2));
  } catch {
    // disco de solo lectura: vive en memoria hasta reiniciar
  }
}

export function storedGmNpcs(): readonly GmNpc[] {
  return gmNpcs;
}

export function addGmNpc(mapId: number, npcNumber: number, x: number, y: number): void {
  if (gmNpcs.some((g) => g.mapId === mapId && g.npcNumber === npcNumber && g.x === x && g.y === y)) return;
  gmNpcs.push({ mapId, npcNumber, x, y });
  persist();
}

export function removeGmNpc(mapId: number, npcNumber: number, x: number, y: number): boolean {
  const i = gmNpcs.findIndex((g) => g.mapId === mapId && g.npcNumber === npcNumber && g.x === x && g.y === y);
  if (i === -1) return false;
  gmNpcs.splice(i, 1);
  persist();
  return true;
}
