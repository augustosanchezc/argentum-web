/**
 * apply-color-key.mjs
 *
 * El motor original del AO (DirectDraw) usa el NEGRO PURO (0,0,0) como color
 * de transparencia. Al convertir los BMP a PNG, ao-libre aplicó el color-key
 * a la mayoría de los archivos pero a varios se les pasó (p. ej. 6073.png:
 * árbol sobre fondo negro opaco → se dibuja un rectángulo negro en el mapa).
 *
 * Este script replica el comportamiento del motor original:
 *   - Si el PNG ya usa canal alpha (algún píxel transparente), NO se toca —
 *     fue convertido bien y su negro es arte intencional (ojos, contornos).
 *   - Si el PNG es 100% opaco, todo píxel negro puro pasa a transparente.
 *
 * Uso: node packages/client/scripts/apply-color-key.mjs
 */

import { readdirSync, renameSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, "../public/ao-assets/graficos");

const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));
console.log(`Procesando ${files.length} PNGs...`);

let keyed = 0;
let skippedAlpha = 0;
let untouched = 0;
let failed = 0;

// Umbral: negro puro con tolerancia mínima (BMP es lossless, 0 exacto alcanza,
// pero toleramos 1-2 por conversiones con redondeo).
const THRESHOLD = 2;

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const path = resolve(DIR, file);
  try {
    const img = sharp(path);
    const { data, info } = await img
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // ¿Ya usa transparencia? → convertido correctamente, no tocar.
    let hasAlpha = false;
    for (let p = 3; p < data.length; p += 4) {
      if (data[p] < 255) {
        hasAlpha = true;
        break;
      }
    }
    if (hasAlpha) {
      skippedAlpha++;
      continue;
    }

    // Aplicar color-key: negro puro → alpha 0.
    let changed = 0;
    for (let p = 0; p < data.length; p += 4) {
      if (data[p] <= THRESHOLD && data[p + 1] <= THRESHOLD && data[p + 2] <= THRESHOLD) {
        data[p + 3] = 0;
        changed++;
      }
    }
    if (changed === 0) {
      untouched++;
      continue;
    }

    const tmp = `${path}.tmp`;
    await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(tmp);
    renameSync(tmp, path);
    keyed++;
  } catch (err) {
    failed++;
    console.warn(`  fallo en ${file}: ${err.message}`);
  }

  if ((i + 1) % 500 === 0) {
    console.log(`  ${i + 1}/${files.length} — keyed: ${keyed}, con alpha previo: ${skippedAlpha}`);
  }
}

console.log(`\n✓ Color-key aplicado a ${keyed} PNGs`);
console.log(`  Ya tenían alpha (no tocados): ${skippedAlpha}`);
console.log(`  Opacos sin negro (no tocados): ${untouched}`);
if (failed > 0) console.log(`  Fallidos: ${failed}`);
