// Configuración de jugabilidad editable desde el panel admin (solapa Ajustes).
// Los intervalos base son los del Server.ini real de AO Libre (DEFAULT_INTERVALS
// en combat.ts). El admin puede sobreescribirlos en vivo; se guardan en
// data/game-config.json y se cargan al arrancar. Borrando el JSON se vuelve al
// balance original de AO.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { INTERVALS, DEFAULT_INTERVALS, type IntervalKey } from "./combat.js";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";

const CONFIG_PATH = overridePath("game-config.json");

// Metadatos para el panel: etiqueta, descripción y rango válido (ms) por clave.
export const INTERVAL_META: ReadonlyArray<{
  key: IntervalKey;
  label: string;
  desc: string;
  min: number;
  max: number;
}> = [
  { key: "potion", label: "Poción (cooldown)", desc: "Tiempo entre pociones. 125 = rojas spameables como el AO.", min: 0, max: 10_000 },
  { key: "golpeUsar", label: "Poción tras golpear", desc: "No podés tomar poción hasta X ms después de golpear (IntervaloGolpeUsar).", min: 0, max: 10_000 },
  { key: "use", label: "Usar item", desc: "Entre usos de cualquier item (IntervaloUserPuedeUsar).", min: 0, max: 10_000 },
  { key: "melee", label: "Golpe melee", desc: "Entre golpes cuerpo a cuerpo (IntervaloUserPuedeAtacar).", min: 100, max: 10_000 },
  { key: "arrow", label: "Disparar arco", desc: "Entre flechas (IntervaloFlechasCazadores).", min: 100, max: 10_000 },
  { key: "spell", label: "Lanzar hechizo", desc: "Entre casteos (IntervaloLanzaHechizo).", min: 100, max: 10_000 },
  { key: "golpeMagia", label: "Castear tras golpear", desc: "Espera para castear después de pegar (IntervaloGolpeMagia).", min: 0, max: 10_000 },
  { key: "magiaGolpe", label: "Golpear tras castear", desc: "Espera para pegar después de castear (IntervaloMagiaGolpe).", min: 0, max: 10_000 },
  { key: "npcAttack", label: "Ataque de NPC", desc: "Entre golpes de un NPC a un jugador (IntervaloNpcPuedeAtacar).", min: 100, max: 10_000 },
];

const KEY_SET = new Set<IntervalKey>(INTERVAL_META.map((m) => m.key));

// Carga inicial (al importar en el arranque).
loadGameConfig();

function loadGameConfig(): void {
  try {
    const text = readOverrideOrSeed("game-config.json");
    if (!text) return;
    const obj = JSON.parse(text) as { intervals?: Partial<Record<IntervalKey, number>> };
    for (const [k, v] of Object.entries(obj.intervals ?? {})) {
      if (KEY_SET.has(k as IntervalKey) && typeof v === "number" && Number.isFinite(v)) {
        INTERVALS[k as IntervalKey] = v;
      }
    }
  } catch {
    // sin overrides todavía
  }
}

function persist(): void {
  try {
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    // Solo persistimos los que difieren del default (para que "borrar" sea limpio).
    const intervals: Partial<Record<IntervalKey, number>> = {};
    for (const m of INTERVAL_META) {
      if (INTERVALS[m.key] !== DEFAULT_INTERVALS[m.key]) intervals[m.key] = INTERVALS[m.key];
    }
    writeFileSync(CONFIG_PATH, JSON.stringify({ intervals }, null, 2));
  } catch {
    // disco de solo lectura: viven en memoria hasta reiniciar
  }
}

// Estado actual para el panel: valor efectivo + default por clave.
export function getGameConfig(): Array<{ key: IntervalKey; label: string; desc: string; value: number; default: number; min: number; max: number }> {
  return INTERVAL_META.map((m) => ({
    key: m.key,
    label: m.label,
    desc: m.desc,
    value: INTERVALS[m.key],
    default: DEFAULT_INTERVALS[m.key],
    min: m.min,
    max: m.max,
  }));
}

// Aplica cambios (clave→ms) validando rango; persiste. Devuelve el estado nuevo.
export function setIntervals(patch: Record<string, unknown>): void {
  for (const m of INTERVAL_META) {
    const raw = patch[m.key];
    if (raw === undefined) continue;
    const v = Math.round(Number(raw));
    if (!Number.isFinite(v)) continue;
    INTERVALS[m.key] = Math.max(m.min, Math.min(v, m.max));
  }
  persist();
}

// Restaurar todo a los valores de AO Libre.
export function resetIntervals(): void {
  for (const m of INTERVAL_META) INTERVALS[m.key] = DEFAULT_INTERVALS[m.key];
  persist();
}
