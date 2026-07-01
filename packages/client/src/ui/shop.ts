import { getItem } from "@ao/shared";

// Ventana de tienda del comerciante (E-3.4). Se abre al recibir ShopOpen y
// lista la oferta con un botón de compra por item.

export interface ShopOffer {
  readonly item: number;
  readonly price: number;
}

export interface ShopCallbacks {
  onBuy(item: number): void;
}

export interface ShopHandle {
  open(offers: ReadonlyArray<ShopOffer>): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function mountShop(parent: HTMLElement, cb: ShopCallbacks): ShopHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-shop";
  wrap.innerHTML = `
    <div class="ao-shop__header">
      <span class="ao-shop__title">Tienda del Mercader</span>
      <button class="ao-shop__close" aria-label="Cerrar">✕</button>
    </div>
    <ul class="ao-shop__list"></ul>
    <div class="ao-shop__hint">Comprá con el oro que tengas. Vendé desde el inventario (I).</div>
  `;
  parent.appendChild(wrap);

  const listEl = wrap.querySelector<HTMLUListElement>(".ao-shop__list")!;
  const closeBtn = wrap.querySelector<HTMLButtonElement>(".ao-shop__close")!;
  let open = false;

  function setOpen(v: boolean): void {
    open = v;
    wrap.classList.toggle("ao-shop--open", open);
  }

  closeBtn.addEventListener("click", () => {
    setOpen(false);
  });

  return {
    open: (offers) => {
      listEl.replaceChildren();
      for (const offer of offers) {
        const def = getItem(offer.item);
        if (!def) continue;
        const li = document.createElement("li");
        li.className = "ao-shop__item";

        const name = document.createElement("span");
        name.className = "ao-shop__name";
        name.textContent = def.name;
        li.appendChild(name);

        const buyBtn = document.createElement("button");
        buyBtn.className = "ao-shop__btn";
        buyBtn.textContent = `Comprar ${offer.price.toString()}`;
        buyBtn.addEventListener("click", () => {
          cb.onBuy(offer.item);
        });
        li.appendChild(buyBtn);

        listEl.appendChild(li);
      }
      setOpen(true);
    },
    close: () => {
      setOpen(false);
    },
    isOpen: () => open,
    destroy: () => {
      wrap.remove();
    },
  };
}
