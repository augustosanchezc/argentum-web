import { getItem, type InventorySlot, type TradeOfferData } from "@ao/shared";
import { createItemCell, type IconResolver } from "./item-cell";

// Ventana de comercio jugador-jugador del AO Libre (frmComerciarUsu): fondo con
// el arte original (VentanaComercioUsuario.jpg 665×592) y, encima, mi inventario
// (izq), mi oferta y la oferta del otro (der), los oros, el campo de cantidad
// con la flecha Agregar, y los botones Confirmar / Cancelar. Geometría del .frm
// (twips ÷ 15). El server soporta: agregar item, poner oro, confirmar, cancelar
// (una sola confirmación; no hay "quitar" ni chat), así que esas zonas del arte
// quedan informativas.

export interface TradeCallbacks {
  onAccept(): void;
  onAddItem(item: number, qty: number): void;
  onSetGold(amount: number): void;
  onConfirm(): void;
  onCancel(): void;
  resolveIcon: IconResolver;
}

export interface TradeHandle {
  showInvite(initiatorName: string): void;
  hideInvite(): void;
  openTrade(theirName: string): void;
  updateTrade(myOffer: TradeOfferData, theirOffer: TradeOfferData, theirName: string): void;
  closeTrade(reason?: string): void;
  isOpen(): boolean;
  setInventory(slots: ReadonlyArray<InventorySlot>, gold: number): void;
  destroy(): void;
}

export function mountTrade(parent: HTMLElement, cb: TradeCallbacks): TradeHandle {
  // Invitación recibida (toast chico, aparte de la ventana).
  const inviteToast = document.createElement("div");
  inviteToast.className = "ao-trade-invite";
  inviteToast.innerHTML = `
    <span class="ao-trade-invite__text"></span>
    <button class="ao-trade-invite__accept">Aceptar</button>
    <button class="ao-trade-invite__decline">Rechazar</button>
  `;
  parent.appendChild(inviteToast);

  const wrap = document.createElement("div");
  wrap.className = "ao-trade ao-vp";
  wrap.innerHTML = `
    <div class="ao-vp__win">
      <div class="ao-vp__head">
        <span class="ao-vp__title">Comercio con <span class="ao-trade__their-name">?</span></span>
        <button class="ao-vp__close" type="button" title="Cerrar">✕</button>
      </div>
      <div class="ao-vp__cols">
        <div class="ao-vp__col">
          <div class="ao-vp__label">Tu inventario</div>
          <div class="ao-vp__grid ao-trade__myinv"></div>
        </div>
        <div class="ao-vp__col">
          <div class="ao-vp__label">Tu oferta</div>
          <div class="ao-vp__grid ao-trade__myoffer"></div>
        </div>
        <div class="ao-vp__col">
          <div class="ao-vp__label">Oferta de <span class="ao-trade__their-name">?</span></div>
          <div class="ao-vp__grid ao-trade__theiroffer"></div>
        </div>
      </div>
      <div class="ao-vp__info"><span class="ao-trade__info">&nbsp;</span></div>
      <div class="ao-vp__goldrow">
        <span class="ao-vp__goldinfo">🪙 Tu oro: <b class="ao-trade__mygold">0</b> · Ofrecés: <b class="ao-trade__myoffergold">0</b> · Te ofrecen: <b class="ao-trade__theiroffergold">0</b></span>
        <input class="ao-vp__field ao-trade__qty" type="number" min="1" value="1" />
        <button class="ao-vp__btn ao-trade__add" type="button" title="Agregar el item seleccionado a tu oferta">Agregar ▶</button>
        <button class="ao-vp__btn ao-trade__setgold" type="button" title="Ofertar la cantidad de oro indicada">Ofertar oro</button>
      </div>
      <div class="ao-vp__foot">
        <span class="ao-trade__status"></span>
        <button class="ao-vp__btn ao-vp__btn--primary ao-trade__confirm" type="button">Confirmar</button>
        <button class="ao-vp__btn ao-trade__cancel" type="button">Cancelar</button>
      </div>
    </div>
  `;
  parent.appendChild(wrap);

  const inviteText = inviteToast.querySelector<HTMLElement>(".ao-trade-invite__text")!;
  const acceptInvBtn = inviteToast.querySelector<HTMLButtonElement>(".ao-trade-invite__accept")!;
  const declineInvBtn = inviteToast.querySelector<HTMLButtonElement>(".ao-trade-invite__decline")!;

  const theirNameEls = [...wrap.querySelectorAll<HTMLElement>(".ao-trade__their-name")];
  const setTheirName = (name: string): void => { for (const el of theirNameEls) el.textContent = name; };
  const myInvGrid = wrap.querySelector<HTMLDivElement>(".ao-trade__myinv")!;
  const myOfferGrid = wrap.querySelector<HTMLDivElement>(".ao-trade__myoffer")!;
  const theirOfferGrid = wrap.querySelector<HTMLDivElement>(".ao-trade__theiroffer")!;
  const myGoldEl = wrap.querySelector<HTMLElement>(".ao-trade__mygold")!;
  const myOfferGoldEl = wrap.querySelector<HTMLElement>(".ao-trade__myoffergold")!;
  const theirOfferGoldEl = wrap.querySelector<HTMLElement>(".ao-trade__theiroffergold")!;
  const qtyEl = wrap.querySelector<HTMLInputElement>(".ao-trade__qty")!;
  const addBtn = wrap.querySelector<HTMLButtonElement>(".ao-trade__add")!;
  const setGoldBtn = wrap.querySelector<HTMLButtonElement>(".ao-trade__setgold")!;
  const infoEl = wrap.querySelector<HTMLElement>(".ao-trade__info")!;
  const statusEl = wrap.querySelector<HTMLElement>(".ao-trade__status")!;
  const confirmBtn = wrap.querySelector<HTMLButtonElement>(".ao-trade__confirm")!;
  const cancelBtn = wrap.querySelector<HTMLButtonElement>(".ao-trade__cancel")!;
  const closeBtn = wrap.querySelector<HTMLButtonElement>(".ao-vp__close")!;

  let open = false;
  let myInventory: ReadonlyArray<InventorySlot> = [];
  let myGold = 0;
  let selectedItem: number | null = null;

  function qty(): number {
    const n = Math.floor(Number(qtyEl.value));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 1;
  }

  function setOpen(v: boolean): void {
    open = v;
    wrap.classList.toggle("ao-trade--open", v);
    if (!v) { selectedItem = null; }
  }

  function fillGrid(grid: HTMLElement, slots: ReadonlyArray<InventorySlot>, clickable: boolean): void {
    grid.replaceChildren();
    const items = slots.filter((s): s is InventorySlot => !!s && s.item > 0);
    for (let i = 0; i < 30; i++) {
      const s = items[i];
      if (!s) {
        const empty = document.createElement("div");
        empty.className = "ao-cell ao-cell--empty";
        grid.appendChild(empty);
        continue;
      }
      const cell = createItemCell({
        item: s.item,
        qty: s.qty,
        resolveIcon: cb.resolveIcon,
        onClick: clickable
          ? () => {
              selectedItem = s.item;
              grid.querySelectorAll(".ao-cell--sel").forEach((c) => { c.classList.remove("ao-cell--sel"); });
              cell.classList.add("ao-cell--sel");
              const def = getItem(s.item);
              infoEl.textContent = def ? def.name : " ";
            }
          : undefined,
      });
      if (clickable && selectedItem === s.item) cell.classList.add("ao-cell--sel");
      grid.appendChild(cell);
    }
  }

  function renderMyInv(): void {
    fillGrid(myInvGrid, myInventory, true);
    myGoldEl.textContent = myGold.toLocaleString("es");
  }

  acceptInvBtn.addEventListener("click", () => {
    inviteToast.classList.remove("ao-trade-invite--visible");
    cb.onAccept();
  });
  declineInvBtn.addEventListener("click", () => {
    inviteToast.classList.remove("ao-trade-invite--visible");
  });
  cancelBtn.addEventListener("click", () => { cb.onCancel(); });
  closeBtn.addEventListener("click", () => { cb.onCancel(); });
  confirmBtn.addEventListener("click", () => { cb.onConfirm(); });
  addBtn.addEventListener("click", () => {
    if (selectedItem !== null) cb.onAddItem(selectedItem, qty());
  });
  // Ofertar oro: la cantidad indicada en el campo (acotada a lo que tenés).
  setGoldBtn.addEventListener("click", () => {
    const amount = qty();
    if (amount >= 0 && amount <= myGold) cb.onSetGold(amount);
  });

  return {
    showInvite: (initiatorName) => {
      inviteText.textContent = `${initiatorName} quiere comerciar con vos`;
      inviteToast.classList.add("ao-trade-invite--visible");
    },
    hideInvite: () => { inviteToast.classList.remove("ao-trade-invite--visible"); },
    openTrade: (name) => {
      setTheirName(name);
      selectedItem = null;
      qtyEl.value = "1";
      renderMyInv();
      setOpen(true);
    },
    updateTrade: (myOffer, theirOffer, name) => {
      setTheirName(name);
      renderMyInv();
      fillGrid(myOfferGrid, myOffer.items, false);
      fillGrid(theirOfferGrid, theirOffer.items, false);
      myOfferGoldEl.textContent = myOffer.gold.toLocaleString("es");
      theirOfferGoldEl.textContent = theirOffer.gold.toLocaleString("es");
      const me = myOffer.confirmed ? "confirmaste ✓" : "pendiente";
      const them = theirOffer.confirmed ? "confirmó ✓" : "pendiente";
      statusEl.textContent = `Vos: ${me}  ·  ${name}: ${them}`;
      confirmBtn.classList.toggle("ao-trade__btn--on", myOffer.confirmed);
    },
    closeTrade: () => { setOpen(false); },
    isOpen: () => open,
    setInventory: (slots, gold) => {
      myInventory = slots;
      myGold = gold;
      if (open) renderMyInv();
    },
    destroy: () => { wrap.remove(); inviteToast.remove(); },
  };
}
