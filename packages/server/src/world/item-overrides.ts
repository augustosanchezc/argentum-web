// Overrides de items del panel de administración (server).
// El catálogo base (items.generated) es el balance original de AO Libre. El
// admin puede sobreescribir campos de balance (daño, defensa, valor, curación)
// por id; se guardan en data/item-overrides.json y se cargan al arrancar, de
// modo que el combate/economía del server usa los valores efectivos y el
// balance original queda intacto (borrando el JSON se vuelve al original).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadItemOverrides, setItemOverride, getItemOverrides, type ItemDef } from "@ao/shared";

const OVERRIDES_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/item-overrides.json");

// Carga inicial (al importar este módulo en el arranque del server).
try {
  const obj = JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) as Record<string, Partial<ItemDef>>;
  loadItemOverrides(obj);
} catch {
  // sin overrides todavía
}

function persist(): void {
  try {
    mkdirSync(dirname(OVERRIDES_PATH), { recursive: true });
    writeFileSync(OVERRIDES_PATH, JSON.stringify(getItemOverrides(), null, 2));
  } catch {
    // disco de solo lectura: viven en memoria hasta reiniciar
  }
}

// Aplica un override y lo persiste. Devuelve el mapa completo actualizado.
export function setItemOverridePersisted(id: number, patch: Partial<ItemDef>): void {
  setItemOverride(id, patch);
  persist();
}
