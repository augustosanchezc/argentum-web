import * as PIXI from "pixi.js";
import { BODY_ANIMATIONS, HEAD_GRAPHICS, type AnimDirection } from "@ao/shared";

export class SpriteManager {
  private readonly cache = new Map<number, PIXI.Texture | null>();
  private readonly loading = new Map<number, Promise<PIXI.Texture | null>>();

  async tryLoad(grhId: number): Promise<PIXI.Texture | null> {
    if (this.cache.has(grhId)) return this.cache.get(grhId) ?? null;
    const existing = this.loading.get(grhId);
    if (existing) return existing;
    const p = PIXI.Assets.load<PIXI.Texture>(`/graficos/${grhId.toString()}.png`)
      .then((tex) => {
        this.cache.set(grhId, tex);
        return tex as PIXI.Texture | null;
      })
      .catch(() => {
        this.cache.set(grhId, null);
        return null;
      });
    this.loading.set(grhId, p);
    return p;
  }

  get(grhId: number): PIXI.Texture | null {
    return this.cache.get(grhId) ?? null;
  }

  async preloadBody(bodyId: number): Promise<void> {
    const anim = BODY_ANIMATIONS[bodyId];
    if (!anim) return;
    const grhs = [...anim.north, ...anim.south, ...anim.east, ...anim.west];
    await Promise.all(grhs.map((g) => this.tryLoad(g)));
  }

  getBodyGrh(bodyId: number, dir: AnimDirection, frame: number): number | null {
    const anim = BODY_ANIMATIONS[bodyId];
    if (!anim) return null;
    const frames = anim[dir];
    if (!frames || frames.length === 0) return null;
    return frames[Math.min(frame, frames.length - 1)] ?? null;
  }

  getHeadGrh(headId: number): number | null {
    return HEAD_GRAPHICS[headId]?.grh ?? null;
  }
}

export const spriteManager = new SpriteManager();
