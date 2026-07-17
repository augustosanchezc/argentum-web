// Reproductor de FX del AO: las animaciones de fxs.ini (índice FX →
// GRH animado + offset) dibujadas sobre una entidad, con la misma
// semántica de colocación del motor original (centrado en el tile,
// bottom-aligned + offset).

import { Sprite, type Container, type Texture } from "pixi.js";
import type { Tileset } from "./tileset";

interface FxDef {
  grh: number;
  ox: number;
  oy: number;
}

interface AnimDef {
  frames: number[];
  speed: number; // duración total del ciclo en ms (semántica Graficos.ind)
}

export interface FxHandle {
  stop(): void;
}

interface ActiveFx {
  sprite: Sprite;
  parent: Container;
  frames: number[];
  frameMs: number;
  startedAt: number;
  loops: number; // -1 = infinito
  stopped: boolean;
}

const TILE_BOTTOM = 16;

export class FxPlayer {
  private fxs: Record<string, FxDef> = {};
  private anims: Record<string, AnimDef> = {};
  private loaded = false;
  private readonly active: ActiveFx[] = [];

  constructor(private readonly tileset: Tileset) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    const [fxRes, animRes] = await Promise.all([
      fetch("/ao-assets/fxs.json", { cache: "no-cache" }),
      fetch("/ao-assets/animaciones.json", { cache: "no-cache" }),
    ]);
    if (!fxRes.ok || !animRes.ok) throw new Error("No se pudieron cargar los FX");
    this.fxs = (await fxRes.json()) as Record<string, FxDef>;
    this.anims = (await animRes.json()) as Record<string, AnimDef>;
    this.loaded = true;
  }

  get ready(): boolean {
    return this.loaded;
  }

  // Reproduce el FX fxId sobre el container (loops del Hechizos.dat;
  // -1 = loop infinito, p. ej. el aura de meditar).
  play(parent: Container, fxId: number, loops: number): FxHandle | null {
    if (!this.loaded) return null;
    const fx = this.fxs[fxId.toString()];
    if (!fx) return null;
    const anim = this.anims[fx.grh.toString()];
    if (!anim || anim.frames.length === 0) return null;

    const entry: ActiveFx = {
      sprite: new Sprite(),
      parent,
      frames: anim.frames,
      frameMs: Math.max(30, anim.speed / anim.frames.length),
      startedAt: performance.now(),
      loops: loops === 0 ? 1 : loops,
      stopped: false,
    };
    entry.sprite.anchor.set(0.5, 1);
    entry.sprite.x = fx.ox;
    entry.sprite.y = TILE_BOTTOM + fx.oy;
    entry.sprite.zIndex = 10; // sobre body/head dentro del container

    // Precarga lazy de los PNGs del FX; recién ahí se agrega el sprite.
    void this.tileset.preload(anim.frames).then(() => {
      if (entry.stopped) return;
      const tex = this.tileset.get(anim.frames[0]!);
      if (!tex) {
        entry.stopped = true;
        return;
      }
      entry.sprite.texture = tex;
      entry.startedAt = performance.now();
      parent.addChild(entry.sprite);
      this.active.push(entry);
    });

    return {
      stop: () => {
        entry.stopped = true;
        if (entry.sprite.parent) entry.sprite.parent.removeChild(entry.sprite);
        entry.sprite.destroy();
        const i = this.active.indexOf(entry);
        if (i !== -1) this.active.splice(i, 1);
      },
    };
  }

  // Avanza todas las animaciones activas. Llamar desde el ticker.
  update(now: number): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const fx = this.active[i]!;
      if (fx.stopped || fx.parent.destroyed) {
        this.active.splice(i, 1);
        continue;
      }
      const elapsed = now - fx.startedAt;
      const totalFrames = Math.floor(elapsed / fx.frameMs);
      const cycle = Math.floor(totalFrames / fx.frames.length);

      if (fx.loops !== -1 && cycle >= fx.loops) {
        fx.stopped = true;
        if (fx.sprite.parent) fx.sprite.parent.removeChild(fx.sprite);
        fx.sprite.destroy();
        this.active.splice(i, 1);
        continue;
      }

      const frame = fx.frames[totalFrames % fx.frames.length]!;
      const tex: Texture | null = this.tileset.get(frame);
      if (tex) fx.sprite.texture = tex;
    }
  }
}
