// Renderer liviano de la "foto en vivo" del landing. Dibuja en un <canvas> 2D
// una ventana del mundo real (default map 1, 50,50) con los MISMOS gráficos
// del juego (/ao-assets) y las entidades vivas que devuelve /world-peek, y la
// refresca cada minuto. No usa PixiJS: lee el índice de grh y compone los
// atlas con drawImage, replicando el anclaje del motor (capa 1 en el origen
// del tile; capas 2-4 y cuerpos centrados en X y apoyados en el borde inferior
// del tile, igual que game.ts).

const ASSETS = "/ao-assets";

interface GrhEntry { f: number; x: number; y: number; w: number; h: number }
type GrhIndex = Record<string, GrhEntry>;

interface PjBody { walkFrames: number[][]; headOffset?: { x: number; y: number } }
interface PjIndex {
  bodies: Record<string, PjBody>;
  heads: Record<string, { n: number; e: number; s: number; o: number }>;
  monsterBodies?: Record<string, PjBody>;
}

interface PeekEntity { x: number; y: number; body: number; head: number; dir: string; name: string; kind: string }
interface PeekData {
  map: number; name: string; cx: number; cy: number; x0: number; y0: number;
  w: number; h: number; tile: number;
  l1: number[]; l2: number[]; l3: number[]; l4: number[];
  entities: PeekEntity[];
}

// Cachés a nivel de módulo: el índice de grh (~1.5MB) y el de personajes se
// bajan una sola vez; los atlas PNG se reutilizan entre refrescos.
let grhIndexP: Promise<GrhIndex> | null = null;
let pjIndexP: Promise<PjIndex> | null = null;
const atlasCache = new Map<number, Promise<HTMLImageElement | null>>();

function loadGrhIndex(): Promise<GrhIndex> {
  grhIndexP ??= fetch(`${ASSETS}/graficos.json`, { cache: "force-cache" })
    .then((r) => (r.ok ? (r.json() as Promise<GrhIndex>) : Promise.reject(new Error("grh"))));
  return grhIndexP;
}

function loadPjIndex(): Promise<PjIndex> {
  pjIndexP ??= fetch(`${ASSETS}/personajes.json`, { cache: "force-cache" })
    .then((r) => (r.ok ? (r.json() as Promise<PjIndex>) : Promise.reject(new Error("pj"))))
    .then((idx) => {
      // Fusionamos monsterBodies en bodies (mismo espacio de lookup que el juego).
      for (const [id, mb] of Object.entries(idx.monsterBodies ?? {})) {
        idx.bodies[id] ??= { walkFrames: mb.walkFrames, headOffset: mb.headOffset ?? { x: 0, y: 0 } };
      }
      return idx;
    });
  return pjIndexP;
}

function loadAtlas(fileNum: number): Promise<HTMLImageElement | null> {
  let p = atlasCache.get(fileNum);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => { resolve(img); };
      img.onerror = () => { resolve(null); };
      img.src = `${ASSETS}/graficos/${fileNum.toString()}.png`;
    });
    atlasCache.set(fileNum, p);
  }
  return p;
}

// Body/cabeza mirando al sur (índice 2 del walk cycle; "s" en heads).
function bodySouthGrh(pj: PjIndex, body: number): number | null {
  const b = pj.bodies[body.toString()];
  const frames = b?.walkFrames[2];
  return frames && frames.length > 0 ? (frames[0] || null) : null;
}
function headSouthGrh(pj: PjIndex, head: number): number | null {
  return pj.heads[head.toString()]?.s || null;
}
function headOffsetOf(pj: PjIndex, body: number): { x: number; y: number } {
  return pj.bodies[body.toString()]?.headOffset ?? { x: 0, y: 0 };
}

export interface LiveMapOptions {
  map?: number; x?: number; y?: number; rx?: number; ry?: number;
  refreshMs?: number;
}

// Arranca el renderer sobre `canvas`. Devuelve una función para detenerlo.
export function startLiveMap(canvas: HTMLCanvasElement, opts: LiveMapOptions = {}): () => void {
  const { map = 1, x = 50, y = 50, rx = 10, ry = 7, refreshMs = 60_000 } = opts;
  let stopped = false;
  let timer: number | undefined;

  const query = `map=${map.toString()}&x=${x.toString()}&y=${y.toString()}&rx=${rx.toString()}&ry=${ry.toString()}`;

  async function drawOnce(): Promise<void> {
    const [grh, res] = await Promise.all([
      loadGrhIndex(),
      fetch(`/world-peek?${query}`, { cache: "no-store" }),
    ]);
    if (stopped || !res.ok) return;
    const data = (await res.json()) as PeekData;
    const pj = await loadPjIndex().catch(() => null);
    if (stopped) return;

    const tile = data.tile;
    canvas.width = data.w * tile;
    canvas.height = data.h * tile;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false; // pixel-art nítido

    // Reunimos todos los grh que vamos a dibujar y precargamos sus atlas PNG.
    const need = new Set<number>();
    const addGrh = (g: number): void => { const e = grh[g.toString()]; if (e) need.add(e.f); };
    for (const arr of [data.l1, data.l2, data.l3, data.l4]) for (const g of arr) if (g) addGrh(g);
    if (pj) {
      for (const ent of data.entities) {
        const bg = bodySouthGrh(pj, ent.body); if (bg) addGrh(bg);
        const hg = ent.head > 0 ? headSouthGrh(pj, ent.head) : null; if (hg) addGrh(hg);
      }
    }
    const atlases = new Map<number, HTMLImageElement | null>();
    await Promise.all([...need].map(async (f) => { atlases.set(f, await loadAtlas(f)); }));
    if (stopped) return;

    const drawGrh = (g: number, destX: number, destY: number): void => {
      const e = grh[g.toString()];
      if (!e) return;
      const img = atlases.get(e.f);
      if (!img) return;
      ctx.drawImage(img, e.x, e.y, e.w, e.h, destX, destY, e.w, e.h);
    };
    // Capa 1 (suelo): grh 32x32 en el origen del tile.
    const drawFloor = (g: number, lx: number, ly: number): void => { drawGrh(g, lx * tile, ly * tile); };
    // Capas 2-4 y cuerpos: centrado en X, apoyado en el borde inferior del tile.
    const drawAnchored = (g: number, bcx: number, bcy: number): void => {
      const e = grh[g.toString()];
      if (!e) return;
      drawGrh(g, bcx - e.w / 2, bcy - e.h);
    };

    // Fondo (por si algún tile no tiene suelo cargado).
    ctx.fillStyle = "#070b13";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pasada 1: suelo. Pasada 2: decoración de suelo (capa 2).
    for (let ly = 0; ly < data.h; ly += 1) {
      for (let lx = 0; lx < data.w; lx += 1) {
        const g1 = data.l1[ly * data.w + lx] ?? 0;
        if (g1) drawFloor(g1, lx, ly);
      }
    }
    for (let ly = 0; ly < data.h; ly += 1) {
      for (let lx = 0; lx < data.w; lx += 1) {
        const g2 = data.l2[ly * data.w + lx] ?? 0;
        if (g2) drawAnchored(g2, (lx + 0.5) * tile, (ly + 1) * tile);
      }
    }

    // Pasada 3: capa 3 (objetos que ocluyen) + entidades, intercaladas por fila
    // para que lo que está más abajo tape a lo de arriba (mismo criterio que el
    // z-order del juego).
    const entsByRow = new Map<number, PeekEntity[]>();
    for (const ent of data.entities) {
      const ly = ent.y - data.y0;
      if (ly < 0 || ly >= data.h) continue;
      const list = entsByRow.get(ly) ?? [];
      list.push(ent);
      entsByRow.set(ly, list);
    }
    for (let ly = 0; ly < data.h; ly += 1) {
      for (let lx = 0; lx < data.w; lx += 1) {
        const g3 = data.l3[ly * data.w + lx] ?? 0;
        if (g3) drawAnchored(g3, (lx + 0.5) * tile, (ly + 1) * tile);
      }
      if (pj) {
        for (const ent of entsByRow.get(ly) ?? []) {
          const lx = ent.x - data.x0;
          const bcx = (lx + 0.5) * tile;
          const bcy = (ly + 1) * tile;
          const bg = bodySouthGrh(pj, ent.body);
          if (bg) drawAnchored(bg, bcx, bcy);
          const hg = ent.head > 0 ? headSouthGrh(pj, ent.head) : null;
          if (hg) {
            const off = headOffsetOf(pj, ent.body);
            drawAnchored(hg, bcx + off.x, bcy + off.y);
          }
        }
      }
    }

    // Pasada 4: techos (capa 4) por encima de todo.
    for (let ly = 0; ly < data.h; ly += 1) {
      for (let lx = 0; lx < data.w; lx += 1) {
        const g4 = data.l4[ly * data.w + lx] ?? 0;
        if (g4) drawAnchored(g4, (lx + 0.5) * tile, (ly + 1) * tile);
      }
    }
  }

  const tick = (): void => {
    void drawOnce().catch(() => { /* red/asset caído: dejamos el último frame */ });
  };
  tick();
  timer = window.setInterval(tick, refreshMs);

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearInterval(timer);
  };
}
