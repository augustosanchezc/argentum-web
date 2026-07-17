import type { Texture } from "pixi.js";
import type { Tileset } from "./tileset";
import type { CharDirection } from "./personajes";

// Overlays de equipo del AO clásico: Armas.dat / Escudos.dat (GRH animado
// por dirección, resuelto a frames estáticos en equipamiento.json) y
// Cascos.ini (GRH estático por dirección). Mismo orden que los bodies:
// [norte, este, sur, oeste].
interface EquipIndex {
  armas: Record<string, number[][]>;
  escudos: Record<string, number[][]>;
  cascos: Record<string, number[]>;
}

const DIR_INDEX: Record<CharDirection, number> = {
  north: 0,
  east: 1,
  south: 2,
  west: 3,
};

export class Equipamiento {
  private index: EquipIndex = { armas: {}, escudos: {}, cascos: {} };
  private loaded = false;

  constructor(private readonly tileset: Tileset) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    const res = await fetch("/ao-assets/equipamiento.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`No se pudo cargar equipamiento.json (${res.status.toString()})`);
    this.index = (await res.json()) as EquipIndex;
    this.loaded = true;
  }

  get ready(): boolean {
    return this.loaded;
  }

  hasWeapon(anim: number): boolean {
    return this.index.armas[anim.toString()] !== undefined;
  }

  hasShield(anim: number): boolean {
    return this.index.escudos[anim.toString()] !== undefined;
  }

  hasHelmet(anim: number): boolean {
    return this.index.cascos[anim.toString()] !== undefined;
  }

  weaponFrame(anim: number, dir: CharDirection, frameIdx: number): Texture | null {
    return this.animFrame(this.index.armas[anim.toString()], dir, frameIdx);
  }

  shieldFrame(anim: number, dir: CharDirection, frameIdx: number): Texture | null {
    return this.animFrame(this.index.escudos[anim.toString()], dir, frameIdx);
  }

  helmet(anim: number, dir: CharDirection): Texture | null {
    const dirs = this.index.cascos[anim.toString()];
    if (!dirs) return null;
    const grh = dirs[DIR_INDEX[dir]];
    if (!grh) return null;
    return this.tileset.get(grh);
  }

  // Precarga los PNGs de los overlays de una entidad. Idempotente.
  async ensure(weaponAnim: number, shieldAnim: number, helmetAnim: number): Promise<void> {
    const grhIds = new Set<number>();
    const collect = (frames?: number[][]): void => {
      if (!frames) return;
      for (const dirFrames of frames) for (const g of dirFrames) grhIds.add(g);
    };
    if (weaponAnim > 0) collect(this.index.armas[weaponAnim.toString()]);
    if (shieldAnim > 0) collect(this.index.escudos[shieldAnim.toString()]);
    if (helmetAnim > 0) {
      for (const g of this.index.cascos[helmetAnim.toString()] ?? []) if (g > 0) grhIds.add(g);
    }
    if (grhIds.size > 0) await this.tileset.preload(grhIds);
  }

  private animFrame(frames: number[][] | undefined, dir: CharDirection, frameIdx: number): Texture | null {
    if (!frames) return null;
    const dirFrames = frames[DIR_INDEX[dir]];
    if (!dirFrames || dirFrames.length === 0) return null;
    return this.tileset.get(dirFrames[frameIdx % dirFrames.length]);
  }
}
