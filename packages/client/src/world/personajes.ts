import type { Texture } from "pixi.js";
import type { Tileset } from "./tileset";

// Índice generado por scripts/fetch-char-assets.mjs — mapea body/head del AO
// original a los grh (indices de Graficos.ind) que forman su walk cycle y
// sus 4 direcciones fijas de cabeza.
interface PersonajesIndex {
  bodies: Record<string, {
    // Uno por dirección: [norte, este, sur, oeste]. Cada arreglo interno
    // son los grh estáticos del walk cycle (5-6 frames típicamente).
    walkFrames: number[][];
    // Desplazamiento en píxeles donde apoya la cabeza sobre el cuerpo.
    headOffset: { x: number; y: number };
  }>;
  heads: Record<string, {
    n: number; // grh estático mirando al norte
    e: number;
    s: number;
    o: number;
  }>;
  // Sprites de NPCs monstruo (rata, lobo, etc). Igual estructura que
  // bodies pero sin head separada — el sprite ya incluye "cabeza".
  monsterBodies: Record<string, {
    walkFrames: number[][];
  }>;
}

export type CharDirection = "north" | "east" | "south" | "west";

const DIR_INDEX: Record<CharDirection, number> = {
  north: 0,
  east: 1,
  south: 2,
  west: 3,
};

const HEAD_KEY: Record<CharDirection, "n" | "e" | "s" | "o"> = {
  north: "n",
  east: "e",
  south: "s",
  west: "o",
};

const ASSETS_BASE = "/ao-assets";

// Loader perezoso de los assets de personaje. Reutiliza el `Tileset` que ya
// hay para las texturas — todos los sprites (mapa, chars, items) viven en
// el mismo `graficos.json` porque son grhs del AO clásico.
export class Personajes {
  private index: PersonajesIndex = { bodies: {}, heads: {}, monsterBodies: {} };
  private loaded = false;

  constructor(private readonly tileset: Tileset) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    const res = await fetch(`${ASSETS_BASE}/personajes.json`);
    if (!res.ok) {
      throw new Error(`No se pudo cargar personajes.json (${res.status.toString()})`);
    }
    this.index = (await res.json()) as PersonajesIndex;
    this.loaded = true;
    // Precargamos los PNGs de todos los cuerpos y cabezas del índice para
    // que al aparecer una entidad no haya salto visual.
    const grhIds = new Set<number>();
    for (const b of Object.values(this.index.bodies)) {
      for (const dirFrames of b.walkFrames) for (const g of dirFrames) grhIds.add(g);
    }
    for (const h of Object.values(this.index.heads)) {
      grhIds.add(h.n); grhIds.add(h.e); grhIds.add(h.s); grhIds.add(h.o);
    }
    for (const mb of Object.values(this.index.monsterBodies ?? {})) {
      for (const dirFrames of mb.walkFrames) for (const g of dirFrames) grhIds.add(g);
    }
    await this.tileset.preload(grhIds);
  }

  get ready(): boolean {
    return this.loaded;
  }

  hasBody(bodyId: number): boolean {
    return this.index.bodies[bodyId.toString()] !== undefined;
  }

  hasHead(headId: number): boolean {
    return this.index.heads[headId.toString()] !== undefined;
  }

  // Cantidad de frames del walk cycle en una dirección dada.
  bodyFrameCount(bodyId: number, dir: CharDirection): number {
    const b = this.index.bodies[bodyId.toString()];
    if (!b) return 0;
    return b.walkFrames[DIR_INDEX[dir]]?.length ?? 0;
  }

  // Textura del frame de walk. Devuelve null si el body/dir/frame no existe.
  bodyFrame(bodyId: number, dir: CharDirection, frameIdx: number): Texture | null {
    const b = this.index.bodies[bodyId.toString()];
    if (!b) return null;
    const dirFrames = b.walkFrames[DIR_INDEX[dir]];
    if (!dirFrames || dirFrames.length === 0) return null;
    const grh = dirFrames[frameIdx % dirFrames.length];
    return this.tileset.get(grh);
  }

  headOffset(bodyId: number): { x: number; y: number } {
    const b = this.index.bodies[bodyId.toString()];
    return b?.headOffset ?? { x: 0, y: 0 };
  }

  head(headId: number, dir: CharDirection): Texture | null {
    const h = this.index.heads[headId.toString()];
    if (!h) return null;
    return this.tileset.get(h[HEAD_KEY[dir]]);
  }

  hasMonsterBody(monsterBodyId: number): boolean {
    return this.index.monsterBodies?.[monsterBodyId.toString()] !== undefined;
  }

  monsterBodyFrameCount(monsterBodyId: number, dir: CharDirection): number {
    const mb = this.index.monsterBodies?.[monsterBodyId.toString()];
    if (!mb) return 0;
    return mb.walkFrames[DIR_INDEX[dir]]?.length ?? 0;
  }

  monsterBodyFrame(
    monsterBodyId: number,
    dir: CharDirection,
    frameIdx: number,
  ): Texture | null {
    const mb = this.index.monsterBodies?.[monsterBodyId.toString()];
    if (!mb) return null;
    const dirFrames = mb.walkFrames[DIR_INDEX[dir]];
    if (!dirFrames || dirFrames.length === 0) return null;
    const grh = dirFrames[frameIdx % dirFrames.length];
    return this.tileset.get(grh);
  }
}
