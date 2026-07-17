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
  // bodies; se fusionan en `bodies` al cargar (ver load()).
  monsterBodies: Record<string, {
    walkFrames: number[][];
    headOffset?: { x: number; y: number };
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
    const res = await fetch(`${ASSETS_BASE}/personajes.json`, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`No se pudo cargar personajes.json (${res.status.toString()})`);
    }
    this.index = (await res.json()) as PersonajesIndex;
    // Unificamos bodies y monsterBodies en un solo espacio de lookup: con el
    // sistema de ropaje del AO cualquier body de Personajes.ini puede ser el
    // sprite de un jugador (armaduras = NumRopaje) o de un NPC humanoide.
    for (const [id, mb] of Object.entries(this.index.monsterBodies ?? {})) {
      if (!this.index.bodies[id]) {
        this.index.bodies[id] = {
          walkFrames: mb.walkFrames,
          headOffset: mb.headOffset ?? { x: 0, y: 0 },
        };
      }
    }
    this.loaded = true;
    // NO precargamos los PNGs acá: con 675 bodies serían ~700 archivos de
    // golpe y saturan el dev server (tiles negros, siluetas eternas).
    // Cada body/head se baja on-demand con ensure() al aparecer la entidad.
  }

  // Precarga los PNGs de un body+head específicos. Idempotente y barato:
  // el Tileset saltea los archivos ya cargados.
  async ensure(bodyId: number, headId: number): Promise<void> {
    const grhIds = new Set<number>();
    const b = this.index.bodies[bodyId.toString()];
    if (b) {
      for (const dirFrames of b.walkFrames) for (const g of dirFrames) grhIds.add(g);
    }
    const h = this.index.heads[headId.toString()];
    if (h) {
      grhIds.add(h.n); grhIds.add(h.e); grhIds.add(h.s); grhIds.add(h.o);
    }
    if (grhIds.size > 0) await this.tileset.preload(grhIds);
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

  // GRH crudos (para dibujar el retrato del personaje a mano en un canvas 2D).
  headGrh(headId: number, dir: CharDirection): number | null {
    const h = this.index.heads[headId.toString()];
    if (!h) return null;
    return h[HEAD_KEY[dir]] || null;
  }

  bodyGrh(bodyId: number, dir: CharDirection, frameIdx = 0): number | null {
    const b = this.index.bodies[bodyId.toString()];
    if (!b) return null;
    const dirFrames = b.walkFrames[DIR_INDEX[dir]];
    if (!dirFrames || dirFrames.length === 0) return null;
    return dirFrames[frameIdx % dirFrames.length] || null;
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
