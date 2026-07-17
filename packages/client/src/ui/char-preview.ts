// Preview de personaje para la creación/selección: compone el cuerpo (por
// raza+género) y la cabeza usando los índices reales del AO (graficos.json +
// personajes.json). Devuelve HTML con sprites CSS escalados (pixel-art nearest).

interface Rect { f: number; x: number; y: number; w: number; h: number }
interface BodyDef { walkFrames: number[][]; headOffset?: { x: number; y: number } }
interface Personajes {
  bodies: Record<string, BodyDef>;
  monsterBodies: Record<string, BodyDef>;
  heads: Record<string, { n: number; e: number; s: number; o: number }>;
}

let GRH: Record<string, Rect> | null = null;
let PJ: Personajes | null = null;
let loadPromise: Promise<void> | null = null;

export async function loadSpriteData(): Promise<void> {
  if (GRH && PJ) return;
  loadPromise ??= (async () => {
    const [g, p] = await Promise.all([
      fetch("/ao-assets/graficos.json").then((r) => r.json() as Promise<Record<string, Rect>>),
      fetch("/ao-assets/personajes.json").then((r) => r.json() as Promise<Personajes>),
    ]);
    GRH = g;
    PJ = p;
  })();
  await loadPromise;
}

function rect(grh: number | undefined): Rect | undefined {
  return grh && GRH ? GRH[String(grh)] : undefined;
}

function bodyDef(body: number): BodyDef | undefined {
  if (!PJ) return undefined;
  return PJ.monsterBodies[String(body)] ?? PJ.bodies[String(body)];
}

function cssOf(r: Rect): string {
  return `width:${r.w}px;height:${r.h}px;background:url(/ao-assets/graficos/${r.f}.png) -${r.x}px -${r.y}px;image-rendering:pixelated`;
}

// Composición cuerpo (frame sur parado) + cabeza (anclada abajo con headOffset),
// escalada por `scale`. `box` es el alto/ancho del contenedor centrado.
export function charSpriteHtml(body: number, head: number, scale = 2, box = 120): string {
  const bg = bodyDef(body);
  const br = rect(bg?.walkFrames[2]?.[0]);
  if (!br) return `<div class="char-preview__box" style="width:${box}px;height:${box}px"></div>`;
  const off = bg?.headOffset ?? { x: 0, y: 0 };
  const hg = head && PJ?.heads[String(head)] ? PJ.heads[String(head)].s : undefined;
  const hr = rect(hg);
  let inner = `<div style="position:relative;width:${br.w}px;height:${br.h}px;transform:scale(${scale});transform-origin:bottom center">`;
  inner += `<div style="position:absolute;left:0;bottom:0;${cssOf(br)}"></div>`;
  if (hr) {
    inner += `<div style="position:absolute;left:50%;bottom:${-off.y}px;margin-left:${off.x - hr.w / 2}px;${cssOf(hr)}"></div>`;
  }
  inner += `</div>`;
  return `<div class="char-preview__box" style="width:${box}px;height:${box}px">${inner}</div>`;
}
