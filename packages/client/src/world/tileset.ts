import { Assets, Rectangle, Texture } from "pixi.js";

// Índice de gráficos del AO original. Lo genera scripts/fetch-ulla-assets.mjs
// a partir de Graficos.ind: por cada grh (el índice u32 que manda el server en
// MapData.graphic) sabemos en qué PNG vive y su sub-rectángulo en píxeles.
//   f = fileNum (archivo /ao-assets/graficos/{f}.png)
//   x,y = offset dentro del PNG
//   w,h = tamaño del recorte
interface GrhEntry {
  readonly f: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

type GrhIndex = Record<string, GrhEntry>;

const ASSETS_BASE = "/ao-assets";

// Carga perezosa del tileset clásico de Argentum Online.
//
// Flujo de uso:
//   const ts = new Tileset();
//   await ts.loadIndex();           // una vez, al iniciar la escena
//   await ts.preload(grhIdsDelMapa); // antes de renderizar
//   const tex = ts.get(grh);        // sub-textura lista para un Sprite
//
// `get` devuelve null si el grh no existe en el índice o su PNG no pudo
// bajarse; el caller decide el fallback (p. ej. un rectángulo de color).
export class Tileset {
  private index: GrhIndex = {};
  private indexLoaded = false;
  // Texturas base por fileNum (un PNG puede contener muchos grh).
  private readonly fileTextures = new Map<number, Texture>();
  // Sub-texturas memoizadas por grh (frame dentro de la textura base).
  private readonly grhTextures = new Map<number, Texture | null>();

  async loadIndex(): Promise<void> {
    if (this.indexLoaded) return;
    // cache: "no-cache" fuerza revalidación — un graficos.json viejo cacheado
    // por el navegador deja miles de tiles sin textura (parches negros).
    const res = await fetch(`${ASSETS_BASE}/graficos.json`, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`No se pudo cargar graficos.json (${res.status.toString()})`);
    }
    this.index = (await res.json()) as GrhIndex;
    this.indexLoaded = true;
    console.log(`[tileset] índice cargado: ${Object.keys(this.index).length.toString()} GRHs`);
  }

  // Devuelve true si el índice ya está disponible.
  get ready(): boolean {
    return this.indexLoaded;
  }

  // Precarga las texturas base (PNG) necesarias para un conjunto de grh.
  // Idempotente: los PNGs ya cargados se saltan. Errores de un PNG concreto
  // no abortan el resto: se reintenta una vez y si vuelve a fallar queda
  // registrado en consola (ese grh usará el fallback de color).
  async preload(grhIds: Iterable<number>): Promise<void> {
    const fileNums = new Set<number>();
    for (const grh of grhIds) {
      const entry = this.index[grh.toString()];
      if (entry && !this.fileTextures.has(entry.f)) {
        fileNums.add(entry.f);
      }
    }
    const failed: number[] = [];
    await Promise.all(
      [...fileNums].map(async (fileNum) => {
        const url = `${ASSETS_BASE}/graficos/${fileNum.toString()}.png`;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const tex = await Assets.load<Texture>(url);
            // Pixel-art: escalado nearest para que no se vea borroso al hacer zoom.
            tex.source.scaleMode = "nearest";
            this.fileTextures.set(fileNum, tex);
            return;
          } catch {
            // backoff corto antes del reintento
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          }
        }
        failed.push(fileNum);
      }),
    );
    if (failed.length > 0) {
      console.warn(
        `[tileset] ${failed.length.toString()} PNGs fallaron tras reintento: ${failed.slice(0, 20).join(", ")}`,
      );
    }
  }

  // Cuántos PNGs de atlas todavía NO están cargados para este conjunto de grh.
  // 0 = ya está todo en caché (el mapa se puede dibujar completo sin precargar).
  missingFileCount(grhIds: Iterable<number>): number {
    const files = new Set<number>();
    for (const grh of grhIds) {
      const e = this.index[grh.toString()];
      if (e && !this.fileTextures.has(e.f)) files.add(e.f);
    }
    return files.size;
  }

  // Devuelve las coordenadas del grh dentro de su PNG. Sirve para renderizar
  // el sprite como fondo CSS (fuera de PixiJS, típicamente en el inventario
  // que es DOM). Null si el grh no existe en el índice.
  entry(grh: number): { fileNum: number; x: number; y: number; w: number; h: number } | null {
    const e = this.index[grh.toString()];
    if (!e) return null;
    return { fileNum: e.f, x: e.x, y: e.y, w: e.w, h: e.h };
  }

  // Sub-textura para un grh, o null si no la tenemos (grh desconocido o PNG
  // no cargado). Memoiza el resultado, incluido el null.
  get(grh: number): Texture | null {
    const cached = this.grhTextures.get(grh);
    if (cached !== undefined) return cached;

    const entry = this.index[grh.toString()];
    if (!entry) {
      this.grhTextures.set(grh, null);
      return null;
    }
    const base = this.fileTextures.get(entry.f);
    if (!base) {
      // El PNG aún no está cargado; no memoizamos null para permitir que
      // un preload posterior lo resuelva.
      return null;
    }
    const tex = new Texture({
      source: base.source,
      frame: new Rectangle(entry.x, entry.y, entry.w, entry.h),
    });
    this.grhTextures.set(grh, tex);
    return tex;
  }
}
