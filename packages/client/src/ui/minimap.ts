// Minimapa del AO: render 1px-por-tile del mapa actual (100x100) con el
// punto del jugador, el nombre de la zona y las coordenadas — como el
// recuadro inferior derecho del cliente clásico.

export interface MinimapMapData {
  mapId: number;
  name: string;
  width: number;
  height: number;
  graphic: ReadonlyArray<number>;
  layer3: ReadonlyArray<number>;
  blocked: ReadonlyArray<number>;
}

export interface MinimapHandle {
  setMap(data: MinimapMapData): void;
  setPos(x: number, y: number): void;
  destroy(): void;
}

// Paleta heurística por rango de GRH — la misma familia de colores que el
// fallback de tiles del render principal.
function tileColor(graphic: number, blocked: boolean, hasTree: boolean): [number, number, number] {
  if (hasTree) return [24, 48, 28];            // vegetación (capa 3)
  if (graphic >= 1505 && graphic <= 1520) return [27, 54, 84]; // agua
  if (blocked) return [42, 38, 32];            // piedra / pared
  if (graphic >= 2000 && graphic <= 4000) return [90, 74, 48]; // baldosa/madera
  if (graphic >= 6300 && graphic <= 6600) return [122, 96, 60]; // caminos de tierra
  return [45, 66, 38];                          // pasto
}

export function mountMinimap(slot: HTMLElement): MinimapHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-minimap";
  wrap.innerHTML = `
    <div class="ao-minimap__zone">—</div>
    <div class="ao-minimap__frame">
      <canvas class="ao-minimap__canvas" width="100" height="100"></canvas>
      <div class="ao-minimap__dot"></div>
    </div>
    <div class="ao-minimap__coords">—</div>
  `;
  slot.appendChild(wrap);

  const zoneEl = wrap.querySelector<HTMLDivElement>(".ao-minimap__zone")!;
  const canvas = wrap.querySelector<HTMLCanvasElement>(".ao-minimap__canvas")!;
  const dotEl = wrap.querySelector<HTMLDivElement>(".ao-minimap__dot")!;
  const coordsEl = wrap.querySelector<HTMLDivElement>(".ao-minimap__coords")!;

  let mapW = 100;
  let mapH = 100;
  let mapId = 0;
  let lastX = -1;
  let lastY = -1;

  function setMap(data: MinimapMapData): void {
    mapW = data.width;
    mapH = data.height;
    mapId = data.mapId;
    zoneEl.textContent = data.name;
    canvas.width = data.width;
    canvas.height = data.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(data.width, data.height);
    for (let i = 0; i < data.width * data.height; i += 1) {
      const [r, g, b] = tileColor(
        data.graphic[i] ?? 0,
        (data.blocked[i] ?? 0) === 1,
        (data.layer3[i] ?? 0) > 0,
      );
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    lastX = -1; // fuerza reposicionar el punto
  }

  function setPos(x: number, y: number): void {
    if (x === lastX && y === lastY) return;
    lastX = x;
    lastY = y;
    // El canvas se estira por CSS al ancho del panel: el punto se posiciona
    // en porcentaje para que coincida en cualquier tamaño.
    dotEl.style.left = `${((x / mapW) * 100).toFixed(1)}%`;
    dotEl.style.top = `${((y / mapH) * 100).toFixed(1)}%`;
    coordsEl.textContent = `Mapa ${mapId.toString()} (${x.toString()},${y.toString()})`;
  }

  return {
    setMap,
    setPos,
    destroy: () => {
      wrap.remove();
    },
  };
}
