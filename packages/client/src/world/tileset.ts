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
    const res = await fetch(`${ASSETS_BASE}/graficos.json`);
    if (!res.ok) {
      throw new Error(`No se pudo cargar graficos.json (${res.status.toString()})`);
    }
    this.index = (await res.json()) as GrhIndex;
    this.indexLoaded = true;
  }

  // Devuelve true si el índice ya está disponible.
  get ready(): boolean {
    return this.indexLoaded;
  }

  // Precarga las texturas base (PNG) necesarias para un conjunto de grh.
  // Idempotente: los PNGs ya cargados se saltan. Errores de un PNG concreto
  // no abortan el resto — ese grh quedará sin textura y usará fallback.
  async preload(grhIds: Iterable<number>): Promise<void> {
    const fileNums = new Set<number>();
    for (const grh of grhIds) {
      const entry = this.index[grh.toString()];
      if (entry && !this.fileTextures.has(entry.f)) {
        fileNums.add(entry.f);
      }
    }
    await Promise.all(
      [...fileNums].map(async (fileNum) => {
        try {
          const tex = await Assets.load<Texture>(
            `${ASSETS_BASE}/graficos/${fileNum.toString()}.png`,
          );
          // Pixel-art: escalado nearest para que no se vea borroso al hacer zoom.
          tex.source.scaleMode = "nearest";
          this.fileTextures.set(fileNum, tex);
        } catch {
          // PNG faltante: lo dejamos fuera; get() devolverá null para sus grh.
        }
      }),
    );
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
