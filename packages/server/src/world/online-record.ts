// Record de jugadores online SIMULTÁNEOS. Se persiste en el volumen de
// overrides (online-record.json) para que sobreviva a reinicios/redeploys.
// El ws lo consulta en cada login: si el pico actual supera el record guardado,
// lo actualiza y anuncia a todos en el chat global.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";

const RECORD_PATH = overridePath("online-record.json");

let record = 0;

// Carga inicial (al importar en el arranque).
(function load(): void {
  try {
    const text = readOverrideOrSeed("online-record.json");
    if (!text) return;
    const obj = JSON.parse(text) as { record?: number };
    if (typeof obj.record === "number" && Number.isFinite(obj.record)) {
      record = Math.max(0, Math.floor(obj.record));
    }
  } catch {
    // sin override todavía → record 0
  }
})();

export function getOnlineRecord(): number {
  return record;
}

// Registra `count` como pico actual. Devuelve true SOLO si es un NUEVO record
// (mayor al guardado), en cuyo caso lo persiste. El caller decide si anunciar.
export function checkOnlineRecord(count: number): boolean {
  if (!Number.isFinite(count) || count <= record) return false;
  record = Math.floor(count);
  try {
    mkdirSync(dirname(RECORD_PATH), { recursive: true });
    writeFileSync(RECORD_PATH, JSON.stringify({ record }));
  } catch {
    // best-effort: si falla la escritura, igual queda el record en memoria
  }
  return true;
}
