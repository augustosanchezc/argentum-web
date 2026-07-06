import { getItem } from "@ao/shared";
import type { InventorySlot, TradeOfferData } from "@ao/shared";

// Ventana de trade jugador-jugador (E-4.4).

export interface TradeCallbacks {
  onAccept(): void;
  onAddItem(item: number, qty: number): void;
  onSetGold(amount: number): void;
  onConfirm(): void;
  onCancel(): void;
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
  // Invitación recibida.
  const inviteToast = document.createElement("div");
  inviteToast.className = "ao-trade-invite";
  inviteToast.innerHTML = `
    <span class="ao-trade-invite__text"></span>
    <button class="ao-trade-invite__accept">Aceptar</button>
    <button class="ao-trade-invite__decline">Rechazar</button>
  `;
  parent.appendChild(inviteToast);

  // Ventana de trade.
  const wrap = document.createElement("div");
  wrap.className = "ao-trade";
  wrap.innerHTML = `
    <div class="ao-trade__header">
      <span class="ao-trade__title">Comercio con <strong class="ao-trade__their-name">?</strong></span>
      <button class="ao-trade__cancel-btn">Cancelar</button>
    </div>
    <div class="ao-trade__body">
      <div class="ao-trade__side ao-trade__side--mine">
        <div class="ao-trade__side-title">Mi oferta</div>
        <ul class="ao-trade__offer-list ao-trade__offer-list--mine"></ul>
        <div class="ao-trade__gold-row">
          <span>Oro: </span>
          <input class="ao-trade__gold-input" type="number" min="0" value="0" />
          <button class="ao-trade__btn ao-trade__btn--set-gold">Actualizar</button>
        </div>
        <div class="ao-trade__add-item-row">
          <select class="ao-trade__item-select"></select>
          <button class="ao-trade__btn ao-trade__btn--add-item">Agregar</button>
        </div>
        <span class="ao-trade__confirmed-mine ao-trade__confirmed--no">Pendiente</span>
      </div>
      <div class="ao-trade__side ao-trade__side--theirs">
        <div class="ao-trade__side-title">Su oferta (<span class="ao-trade__their-name2">?</span>)</div>
        <ul class="ao-trade__offer-list ao-trade__offer-list--theirs"></ul>
        <div class="ao-trade__gold-row">
          <span>Oro: <strong class="ao-trade__their-gold">0</strong></span>
        </div>
        <span class="ao-trade__confirmed-theirs ao-trade__confirmed--no">Pendiente</span>
      </div>
    </div>
    <div class="ao-trade__footer">
      <button class="ao-trade__btn ao-trade__btn--confirm">Confirmar</button>
    </div>
  `;
  parent.appendChild(wrap);

  const inviteText = inviteToast.querySelector<HTMLElement>(".ao-trade-invite__text")!;
  const acceptInvBtn = inviteToast.querySelector<HTMLButtonElement>(".ao-trade-invite__accept")!;
  const declineInvBtn = inviteToast.querySelector<HTMLButtonElement>(".ao-trade-invite__decline")!;

  const theirNameEl = wrap.querySelector<HTMLElement>(".ao-trade__their-name")!;
  const theirName2El = wrap.querySelector<HTMLElement>(".ao-trade__their-name2")!;
  const myList = wrap.querySelector<HTMLUListElement>(".ao-trade__offer-list--mine")!;
  const theirList = wrap.querySelector<HTMLUListElement>(".ao-trade__offer-list--theirs")!;
  const theirGoldEl = wrap.querySelector<HTMLElement>(".ao-trade__their-gold")!;
  const goldInput = wrap.querySelector<HTMLInputElement>(".ao-trade__gold-input")!;
  const setGoldBtn = wrap.querySelector<HTMLButtonElement>(".ao-trade__btn--set-gold")!;
  const itemSelect = wrap.querySelector<HTMLSelectElement>(".ao-trade__item-select")!;
  const addItemBtn = wrap.querySelector<HTMLButtonElement>(".ao-trade__btn--add-item")!;
  const confirmBtn = wrap.querySelector<HTMLButtonElement>(".ao-trade__btn--confirm")!;
  const cancelBtn = wrap.querySelector<HTMLButtonElement>(".ao-trade__cancel-btn")!;
  const confirmedMine = wrap.querySelector<HTMLElement>(".ao-trade__confirmed-mine")!;
  const confirmedTheirs = wrap.querySelector<HTMLElement>(".ao-trade__confirmed-theirs")!;

  let open = false;
  let myInventory: ReadonlyArray<InventorySlot> = [];
  let myGold = 0;

  function setOpen(v: boolean): void {
    open = v;
    wrap.classList.toggle("ao-trade--open", open);
  }

  acceptInvBtn.addEventListener("click", () => {
    inviteToast.classList.remove("ao-trade-invite--visible");
    cb.onAccept();
  });
  declineInvBtn.addEventListener("click", () => {
    inviteToast.classList.remove("ao-trade-invite--visible");
  });
  cancelBtn.addEventListener("click", () => cb.onCancel());
  confirmBtn.addEventListener("click", () => cb.onConfirm());
  setGoldBtn.addEventListener("click", () => {
    const amount = parseInt(goldInput.value, 10);
    if (!isNaN(amount) && amount >= 0 && amount <= myGold) {
      cb.onSetGold(amount);
    }
  });
  addItemBtn.addEventListener("click", () => {
    const val = itemSelect.value;
    if (!val) return;
    const item = parseInt(val, 10);
    if (!isNaN(item)) cb.onAddItem(item, 1);
  });

  function refreshInventorySelect(): void {
    itemSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— item —";
    itemSelect.appendChild(placeholder);
    for (const slot of myInventory) {
      const def = getItem(slot.item);
      if (!def) continue;
      const opt = document.createElement("option");
      opt.value = slot.item.toString();
      opt.textContent = `${def.name} x${slot.qty.toString()}`;
      itemSelect.appendChild(opt);
    }
  }

  function renderOfferList(
    list: HTMLUListElement,
    offer: TradeOfferData,
  ): void {
    list.replaceChildren();
    for (const slot of offer.items) {
      const def = getItem(slot.item);
      if (!def) continue;
      const li = document.createElement("li");
      li.textContent = `${def.name} x${slot.qty.toString()}`;
      list.appendChild(li);
    }
  }

  return {
    showInvite: (initiatorName) => {
      inviteText.textContent = `${initiatorName} quiere comerciar con vos`;
      inviteToast.classList.add("ao-trade-invite--visible");
    },
    hideInvite: () => {
      inviteToast.classList.remove("ao-trade-invite--visible");
    },
    openTrade: (name) => {
      theirNameEl.textContent = name;
      theirName2El.textContent = name;
      setOpen(true);
    },
    updateTrade: (myOffer, theirOffer, name) => {
      theirNameEl.textContent = name;
      theirName2El.textContent = name;
      renderOfferList(myList, myOffer);
      renderOfferList(theirList, theirOffer);
      theirGoldEl.textContent = theirOffer.gold.toString();
      goldInput.value = myOffer.gold.toString();
      confirmedMine.textContent = myOffer.confirmed ? "Confirmado ✓" : "Pendiente";
      confirmedMine.className = `ao-trade__confirmed-mine ${myOffer.confirmed ? "ao-trade__confirmed--yes" : "ao-trade__confirmed--no"}`;
      confirmedTheirs.textContent = theirOffer.confirmed ? "Confirmado ✓" : "Pendiente";
      confirmedTheirs.className = `ao-trade__confirmed-theirs ${theirOffer.confirmed ? "ao-trade__confirmed--yes" : "ao-trade__confirmed--no"}`;
    },
    closeTrade: () => {
      setOpen(false);
    },
    isOpen: () => open,
    setInventory: (slots, gold) => {
      myInventory = slots;
      myGold = gold;
      if (open) refreshInventorySelect();
    },
    destroy: () => {
      wrap.remove();
      inviteToast.remove();
    },
  };
}
