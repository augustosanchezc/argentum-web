// Directorio de los overrides EDITABLES en runtime desde el panel admin
// (Ajustes/intervalos, criaturas/NPCs, items). En producción apunta a un volumen
// Docker persistente (env AO_OVERRIDES_DIR) para que los cambios del admin
// SOBREVIVAN a los redeploy — antes vivían dentro de la imagen (COPY packages/
// server) y cada `docker compose up --build` los pisaba con la versión del repo.
//
// En dev (sin la env) cae al data/ del repo, como siempre.
//
// Lectura con SEED: si el archivo todavía no existe en el volumen (primer deploy
// con el volumen vacío), se lee el valor "de fábrica" que vino en la imagen
// (data/<archivo>), así no se pierde la config actual. La escritura SIEMPRE va
// al volumen persistente.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// data/ empaquetado en la imagen (junto a maps/ y dat/). Ojo: este archivo vive
// en world/, así que ../../data = packages/server/data.
const BUNDLED_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");

// Directorio persistente para escribir (volumen en prod, data/ en dev).
export const OVERRIDES_DIR = process.env.AO_OVERRIDES_DIR
  ? resolve(process.env.AO_OVERRIDES_DIR)
  : BUNDLED_DATA_DIR;

// Ruta de ESCRITURA (persistente) de un override.
export function overridePath(file: string): string {
  return resolve(OVERRIDES_DIR, file);
}

// Lee el override: primero del volumen persistente; si no existe ahí todavía,
// cae al valor de fábrica empaquetado en la imagen (seed). Devuelve "" si no hay
// ninguno (el caller decide el default).
export function readOverrideOrSeed(file: string): string {
  try {
    return readFileSync(overridePath(file), "utf8");
  } catch {
    // Sin archivo en el volumen: intentar el seed de la imagen (solo si el
    // directorio persistente es distinto del empaquetado).
    if (OVERRIDES_DIR !== BUNDLED_DATA_DIR) {
      try {
        return readFileSync(resolve(BUNDLED_DATA_DIR, file), "utf8");
      } catch {
        /* tampoco hay seed */
      }
    }
    return "";
  }
}
