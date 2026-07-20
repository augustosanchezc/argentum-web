// Teleports creados por GM en runtime (/teleport). El comando muta el MapState
// en memoria (portal + gráfico de teleport en la capa 3), pero eso se perdía al
// reiniciar porque los mapas se recargan de los .map/.inf originales. Acá los
// PERSISTIMOS en el volumen (data/overrides/teleports.json) y los re-aplicamos
// al arrancar, así sobreviven a los redeploy.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getMap, type PortalTile } from "./maps.js";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";

const TELEPORTS_PATH = overridePath("teleports.json");
// Gráfico del teleport (obj.dat OBJ144 "Teleport a Dungeon Newbie", GrhIndex 669).
export const TELEPORT_GRH = 669;

export interface CustomTeleport {
  readonly mapId: number;
  readonly x: number;
  readonly y: number;
  readonly toMapId: number;
  readonly toX: number;
  readonly toY: number;
}

const teleports: CustomTeleport[] = [];
try {
  const text = readOverrideOrSeed("teleports.json");
  if (text) {
    const arr = JSON.parse(text) as CustomTeleport[];
    if (Array.isArray(arr)) teleports.push(...arr);
  }
} catch {
  // sin teleports guardados todavía
}

function persist(): void {
  try {
    mkdirSync(dirname(TELEPORTS_PATH), { recursive: true });
    writeFileSync(TELEPORTS_PATH, JSON.stringify(teleports, null, 2));
  } catch {
    // disco de solo lectura: vive en memoria hasta reiniciar
  }
}

// Aplica un teleport al MapState en memoria: agrega el portal (si no está ya) y
// pinta el gráfico del teleport en la capa 3.
function applyToMap(t: CustomTeleport): void {
  const map = getMap(t.mapId);
  if (!map) return;
  const portals = map.portals as PortalTile[];
  if (!portals.some((p) => p.x === t.x && p.y === t.y)) {
    portals.push({ x: t.x, y: t.y, toMapId: t.toMapId, toX: t.toX, toY: t.toY });
  }
  (map.layer3 as number[])[t.y * map.width + t.x] = TELEPORT_GRH;
}

// Re-aplica TODOS los teleports guardados a los mapas ya cargados. Se llama al
// arrancar el server (después de cargar los mapas).
export function applyStoredTeleports(): number {
  for (const t of teleports) applyToMap(t);
  return teleports.length;
}

// Crea y GUARDA un teleport nuevo (lo aplica al mapa + persiste). Devuelve el
// grh del gráfico para que el caller broadcastee el MapTileUpdate.
export function addCustomTeleport(t: CustomTeleport): number {
  teleports.push(t);
  applyToMap(t);
  persist();
  return TELEPORT_GRH;
}
