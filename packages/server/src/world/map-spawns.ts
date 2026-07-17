// Respawn aleatorio de criaturas por mapa, configurable desde el panel admin
// (solapa "Spawns"). Por defecto NO hay override: cada tile respawnea la misma
// criatura que trae el .inf del AO. Si el admin habilita un mapa y le da un pool
// de criaturas, al respawnear una criatura de ese mapa se elige una al azar del
// pool. Se persiste en data/map-spawns.json; borrando el JSON se vuelve al AO.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getNpcType, type NpcInstance } from "./npcs.js";

const CONFIG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/map-spawns.json");

export interface MapSpawnConfig {
  // Respawn aleatorio activo en este mapa.
  enabled: boolean;
  // Números de criatura (NPCs.dat) entre los que se sortea al respawnear.
  pool: number[];
}

const configs = new Map<number, MapSpawnConfig>();

// Carga inicial al importar (arranque).
try {
  const obj = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Record<string, MapSpawnConfig>;
  for (const [k, v] of Object.entries(obj)) {
    const mapId = Number(k);
    if (!Number.isFinite(mapId) || !v) continue;
    configs.set(mapId, {
      enabled: !!v.enabled,
      pool: Array.isArray(v.pool) ? v.pool.filter((n) => Number.isFinite(n)) : [],
    });
  }
} catch {
  // sin overrides todavía
}

function persist(): void {
  try {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    const obj: Record<string, MapSpawnConfig> = {};
    for (const [mapId, cfg] of configs) {
      // Solo guardamos mapas con algo configurado (pool no vacío o habilitado).
      if (cfg.enabled || cfg.pool.length > 0) obj[mapId.toString()] = cfg;
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(obj, null, 2));
  } catch {
    // disco de solo lectura: vive en memoria hasta reiniciar
  }
}

export function getMapSpawnConfig(mapId: number): MapSpawnConfig | undefined {
  return configs.get(mapId);
}

export function getAllMapSpawnConfigs(): Map<number, MapSpawnConfig> {
  return configs;
}

// Guarda la config de un mapa (valida que el pool sean criaturas reales) y persiste.
export function setMapSpawnConfig(mapId: number, enabled: boolean, pool: number[]): MapSpawnConfig {
  const clean = Array.from(new Set(pool))
    .map((n) => Math.trunc(Number(n)))
    .filter((n) => {
      const t = getNpcType(n);
      return !!t && t.isCreature;
    });
  const cfg: MapSpawnConfig = { enabled: !!enabled, pool: clean };
  configs.set(mapId, cfg);
  persist();
  return cfg;
}

// Elige un número de criatura al azar del pool del mapa, o null si el mapa no
// tiene respawn aleatorio activo (o su pool quedó vacío).
export function pickRandomCreatureFor(mapId: number, rng: () => number = Math.random): number | null {
  const cfg = configs.get(mapId);
  if (!cfg || !cfg.enabled || cfg.pool.length === 0) return null;
  const idx = Math.floor(rng() * cfg.pool.length);
  return cfg.pool[idx] ?? null;
}

// Si la instancia es una criatura de caza y su mapa tiene respawn aleatorio
// activo, le cambia el tipo por uno del pool (elegido al azar) y devuelve true.
// Solo muta `npc.type`; el llamador resetea hp/posición y avisa al cliente.
export function rerollCreatureType(npc: NpcInstance, rng: () => number = Math.random): boolean {
  if (!npc.type.isCreature) return false;
  const pick = pickRandomCreatureFor(npc.mapId, rng);
  if (pick === null || pick === npc.type.number) return false;
  const newType = getNpcType(pick);
  if (!newType) return false;
  npc.type = newType;
  return true;
}
