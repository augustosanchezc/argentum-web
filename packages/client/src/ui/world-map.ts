// Mapa-mundi: overlay que muestra el mapa del mundo oficial del AO Libre
// (Mapa1.jpg = supramundo, Mapa2.jpg = calabozos) — cada mapa como celda
// coloreada por terreno con su número, en su posición geográfica real.

export interface WorldMapHandle {
  open(currentMapId: number): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function mountWorldMap(parent: HTMLElement): WorldMapHandle {
  const overlay = document.createElement("div");
  overlay.className = "ao-worldmap";
  overlay.innerHTML = `
    <div class="ao-worldmap__box">
      <div class="ao-worldmap__head">
        <span class="ao-worldmap__title">🗺 Mapa del mundo</span>
        <div class="ao-worldmap__tabs">
          <button type="button" class="ao-worldmap__tab ao-worldmap__tab--active" data-map="mundi">Supramundo</button>
          <button type="button" class="ao-worldmap__tab" data-map="dungeon">Calabozos</button>
        </div>
        <button type="button" class="ao-worldmap__close" aria-label="Cerrar">✕</button>
      </div>
      <div class="ao-worldmap__imgwrap">
        <img class="ao-worldmap__img" src="/ao-assets/ui/mapa-mundi.jpg" alt="Mapa del mundo" />
      </div>
    </div>
  `;
  parent.appendChild(overlay);

  const closeBtn = overlay.querySelector<HTMLButtonElement>(".ao-worldmap__close")!;
  const img = overlay.querySelector<HTMLImageElement>(".ao-worldmap__img")!;
  const tabs = [...overlay.querySelectorAll<HTMLButtonElement>(".ao-worldmap__tab")];

  const SRC = {
    mundi: "/ao-assets/ui/mapa-mundi.jpg",
    dungeon: "/ao-assets/ui/mapa-dungeon.jpg",
  } as const;

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      for (const t of tabs) t.classList.toggle("ao-worldmap__tab--active", t === tab);
      const which = (tab.dataset.map as keyof typeof SRC) ?? "mundi";
      img.src = SRC[which];
    });
  }

  function open(): void {
    overlay.classList.add("ao-worldmap--open");
  }
  function close(): void {
    overlay.classList.remove("ao-worldmap--open");
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  return {
    open: () => open(),
    close,
    isOpen: () => overlay.classList.contains("ao-worldmap--open"),
    destroy: () => overlay.remove(),
  };
}
