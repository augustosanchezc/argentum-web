// Overrides de items del panel de administración (server).
// El catálogo base (items.generated) es el balance original de AO Libre. El
// admin puede sobreescribir campos de balance (daño, defensa, valor, curación)
// por id; se guardan en data/item-overrides.json y se cargan al arrancar, de
// modo que el combate/economía del server usa los valores efectivos y el
// balance original queda intacto (borrando el JSON se vuelve al original).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadItemOverrides, setItemOverride, getItemOverrides, type ItemDef } from "@ao/shared";
import { overridePath, readOverrideOrSeed } from "./overrides-dir.js";

const OVERRIDES_PATH = overridePath("item-overrides.json");

// Carga inicial (al importar este módulo en el arranque del server).
try {
  const text = readOverrideOrSeed("item-overrides.json");
  if (text) loadItemOverrides(JSON.parse(text) as Record<string, Partial<ItemDef>>);
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
