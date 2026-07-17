import { getItem, type InventorySlot } from "@ao/shared";
import { createItemCell, type IconResolver } from "./item-cell";

// Ventana de comercio del AO Libre (frmComerciar): fondo con el arte original
// (VentanaComercio.jpg) y, encima, las dos grillas — stock del vendedor a la
// izquierda, tu inventario a la derecha — más la placa de info, el campo de
// cantidad y los botones Comprar / Vender. Geometría tomada del .frm original
// (twips ÷ 15 = px sobre la imagen de 463×490).

export interface ShopOffer {
  readonly item: number;
  readonly price: number;
}

export interface ShopCallbacks {
  onBuy(item: number, qty: number): void;
  onSell(item: number, qty: number): void;
  resolveIcon: IconResolver;
}

export interface ShopHandle {
  open(offers: ReadonlyArray<ShopOffer>): void;
  close(): void;
  isOpen(): boolean;
  setPlayerInventory(slots: ReadonlyArray<InventorySlot>, gold: number): void;
  destroy(): void;
}

type Selection = { side: "npc" | "user"; item: number; unit: number } | null;

export function mountShop(parent: HTMLElement, cb: ShopCallbacks): ShopHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-shop ao-vp";
  wrap.innerHTML = `
    <div class="ao-vp__win">
      <div class="ao-vp__head">
        <span class="ao-vp__title">Comercio</span>
        <button class="ao-vp__close" type="button" title="Cerrar">✕</button>
      </div>
      <div class="ao-vp__cols">
        <div class="ao-vp__col">
          <div class="ao-vp__label">Vendedor</div>
          <div class="ao-vp__grid ao-shop__npc"></div>
        </div>
        <div class="ao-vp__col">
          <div class="ao-vp__label">Tu inventario</div>
          <div class="ao-vp__grid ao-shop__user"></div>
        </div>
      </div>
      <div class="ao-vp__info">
        <span class="ao-shop__iname">&nbsp;</span>
        <span class="ao-shop__iprice"></span>
        <span class="ao-shop__istat"></span>
      </div>
      <div class="ao-vp__foot">
        <label class="ao-vp__qtylbl">Cantidad
          <input class="ao-vp__field ao-shop__qty" type="number" min="1" max="10000" value="1" />
        </label>
        <button class="ao-vp__btn ao-vp__btn--primary ao-shop__buy" type="button">Comprar</button>
        <button class="ao-vp__btn ao-shop__sell" type="button">Vender</button>
      </div>
    </div>
  `;
  parent.appendChild(wrap);

  const npcGrid = wrap.querySelector<HTMLDivElement>(".ao-shop__npc")!;
  const userGrid = wrap.querySelector<HTMLDivElement>(".ao-shop__user")!;
  const nameEl = wrap.querySelector<HTMLDivElement>(".ao-shop__iname")!;
  const priceEl = wrap.querySelector<HTMLDivElement>(".ao-shop__iprice")!;
  const statEl = wrap.querySelector<HTMLDivElement>(".ao-shop__istat")!;
  const qtyEl = wrap.querySelector<HTMLInputElement>(".ao-shop__qty")!;
  const buyBtn = wrap.querySelector<HTMLButtonElement>(".ao-shop__buy")!;
  const sellBtn = wrap.querySelector<HTMLButtonElement>(".ao-shop__sell")!;
  const closeBtn = wrap.querySelector<HTMLButtonElement>(".ao-vp__close")!;

  let open = false;
  let offers: ReadonlyArray<ShopOffer> = [];
  let invSlots: ReadonlyArray<InventorySlot> = [];
  let selected: Selection = null;

  function qty(): number {
    const n = Math.floor(Number(qtyEl.value));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 1;
  }

  // Precio de venta del AO original: un tercio del valor del item.
  function sellUnit(item: number): number {
    const def = getItem(item);
    return def ? Math.floor(def.value / 3) : 0;
  }

  function renderInfo(): void {
    if (!selected) {
      nameEl.innerHTML = "&nbsp;";
      priceEl.innerHTML = "&nbsp;";
      statEl.innerHTML = "&nbsp;";
      return;
    }
    const def = getItem(selected.item);
    if (!def) return;
    nameEl.textContent = def.name;
    const total = selected.unit * qty();
    priceEl.textContent = `$: ${total.toLocaleString("es")}`;
    if (def.maxHit && def.maxHit > 0) {
      statEl.textContent = `Golpe ${(def.minHit ?? 0).toString()}/${def.maxHit.toString()}`;
    } else if (def.defense && def.defense > 0) {
      statEl.textContent = `Defensa ${def.defense.toString()}`;
    } else {
      statEl.innerHTML = "&nbsp;";
    }
  }

  function select(side: "npc" | "user", item: number, unit: number, cell: HTMLElement): void {
    selected = { side, item, unit };
    wrap.querySelectorAll(".ao-cell--sel").forEach((c) => { c.classList.remove("ao-cell--sel"); });
    cell.classList.add("ao-cell--sel");
    renderInfo();
  }

  // Rellena una grilla a 40 casilleros (5×8, como el AO). `entries` puede tener
  // menos; el resto quedan vacíos para respetar la grilla del arte.
  function fillGrid(grid: HTMLElement, side: "npc" | "user", entries: { item: number; qty: number; unit: number }[]): void {
    grid.replaceChildren();
    const count = Math.max(30, Math.ceil(entries.length / 5) * 5);
    for (let i = 0; i < count; i++) {
      const e = entries[i];
      if (!e) {
        const empty = document.createElement("div");
        empty.className = "ao-cell ao-cell--empty";
        grid.appendChild(empty);
        continue;
      }
      const cell = createItemCell({
        item: e.item,
        qty: e.qty,
        resolveIcon: cb.resolveIcon,
        onClick: () => { select(side, e.item, e.unit, cell); },
      });
      if (selected && selected.side === side && selected.item === e.item) cell.classList.add("ao-cell--sel");
      grid.appendChild(cell);
    }
  }

  function renderNpc(): void {
    fillGrid(npcGrid, "npc", offers.map((o) => ({ item: o.item, qty: 0, unit: o.price })));
  }

  function renderUser(): void {
    const entries = invSlots
      .filter((s): s is InventorySlot => !!s && s.item > 0)
      .map((s) => ({ item: s.item, qty: s.qty, unit: sellUnit(s.item) }));
    fillGrid(userGrid, "user", entries);
  }

  function setOpen(v: boolean): void {
    open = v;
    wrap.classList.toggle("ao-shop--open", v);
    if (!v) {
      selected = null;
      renderInfo();
    }
  }

  buyBtn.addEventListener("click", () => {
    if (selected?.side === "npc") cb.onBuy(selected.item, qty());
  });
  sellBtn.addEventListener("click", () => {
    if (selected?.side === "user") cb.onSell(selected.item, qty());
  });
  closeBtn.addEventListener("click", () => { setOpen(false); });
  qtyEl.addEventListener("input", renderInfo);

  return {
    open: (o) => {
      offers = o;
      selected = null;
      qtyEl.value = "1";
      renderNpc();
      renderUser();
      renderInfo();
      setOpen(true);
    },
    close: () => { setOpen(false); },
    isOpen: () => open,
    setPlayerInventory: (slots) => {
      invSlots = slots;
      if (open) {
        // Si el item seleccionado para vender ya no está, limpiar la selección.
        if (selected?.side === "user" && !slots.some((s) => s && s.item === selected!.item)) {
          selected = null;
          renderInfo();
        }
        renderUser();
      }
    },
    destroy: () => { wrap.remove(); },
  };
}
