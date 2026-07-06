import { getItem } from "@ao/shared";
import type { InventorySlot } from "@ao/shared";

// Ventana de banco del banquero (E-4.2).

export interface BankCallbacks {
  onDepositItem(item: number, qty: number): void;
  onWithdrawItem(item: number, qty: number): void;
  onDepositGold(amount: number): void;
  onWithdrawGold(amount: number): void;
}

export interface BankHandle {
  open(bankInventory: ReadonlyArray<InventorySlot>, bankGold: number): void;
  update(
    bankInventory: ReadonlyArray<InventorySlot>,
    bankGold: number,
    playerInventory: ReadonlyArray<InventorySlot>,
    playerGold: number,
  ): void;
  close(): void;
  isOpen(): boolean;
  setPlayerInventory(slots: ReadonlyArray<InventorySlot>, gold: number): void;
  destroy(): void;
}

export function mountBank(parent: HTMLElement, cb: BankCallbacks): BankHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-bank";
  wrap.innerHTML = `
    <div class="ao-bank__header">
      <span class="ao-bank__title">Banco de Ullathorpe</span>
      <button class="ao-bank__close" aria-label="Cerrar">✕</button>
    </div>
    <div class="ao-bank__body">
      <div class="ao-bank__section">
        <div class="ao-bank__section-title">Inventario del banco</div>
        <ul class="ao-bank__list ao-bank__list--bank"></ul>
        <div class="ao-bank__gold-row">
          <span class="ao-bank__gold-label">Oro en banco: <strong class="ao-bank__gold-bank">0</strong></span>
          <input class="ao-bank__gold-input" type="number" min="1" placeholder="cant." />
          <button class="ao-bank__btn ao-bank__btn--withdraw-gold">Retirar</button>
        </div>
      </div>
      <div class="ao-bank__section">
        <div class="ao-bank__section-title">Inventario del jugador</div>
        <ul class="ao-bank__list ao-bank__list--player"></ul>
        <div class="ao-bank__gold-row">
          <span class="ao-bank__gold-label">Oro en mano: <strong class="ao-bank__gold-player">0</strong></span>
          <input class="ao-bank__gold-input2" type="number" min="1" placeholder="cant." />
          <button class="ao-bank__btn ao-bank__btn--deposit-gold">Depositar</button>
        </div>
      </div>
    </div>
  `;
  parent.appendChild(wrap);

  const bankList = wrap.querySelector<HTMLUListElement>(".ao-bank__list--bank")!;
  const playerList = wrap.querySelector<HTMLUListElement>(".ao-bank__list--player")!;
  const goldBankEl = wrap.querySelector<HTMLElement>(".ao-bank__gold-bank")!;
  const goldPlayerEl = wrap.querySelector<HTMLElement>(".ao-bank__gold-player")!;
  const goldInputBank = wrap.querySelector<HTMLInputElement>(".ao-bank__gold-input")!;
  const goldInputPlayer = wrap.querySelector<HTMLInputElement>(".ao-bank__gold-input2")!;
  const closeBtn = wrap.querySelector<HTMLButtonElement>(".ao-bank__close")!;
  const withdrawGoldBtn = wrap.querySelector<HTMLButtonElement>(".ao-bank__btn--withdraw-gold")!;
  const depositGoldBtn = wrap.querySelector<HTMLButtonElement>(".ao-bank__btn--deposit-gold")!;

  let open = false;
  let currentBank: ReadonlyArray<InventorySlot> = [];
  let currentPlayer: ReadonlyArray<InventorySlot> = [];
  let currentBankGold = 0;
  let currentPlayerGold = 0;

  function setOpen(v: boolean): void {
    open = v;
    wrap.classList.toggle("ao-bank--open", open);
  }

  closeBtn.addEventListener("click", () => setOpen(false));

  function renderItems(
    list: HTMLUListElement,
    slots: ReadonlyArray<InventorySlot>,
    action: "deposit" | "withdraw",
  ): void {
    list.replaceChildren();
    for (const slot of slots) {
      const def = getItem(slot.item);
      if (!def) continue;
      const li = document.createElement("li");
      li.className = "ao-bank__item";

      const info = document.createElement("span");
      info.className = "ao-bank__item-name";
      info.textContent = `${def.name} x${slot.qty.toString()}`;
      li.appendChild(info);

      const btn = document.createElement("button");
      btn.className = "ao-bank__btn";
      btn.textContent = action === "deposit" ? "Depositar" : "Retirar";
      btn.addEventListener("click", () => {
        if (action === "deposit") {
          cb.onDepositItem(slot.item, slot.qty);
        } else {
          cb.onWithdrawItem(slot.item, slot.qty);
        }
      });
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  function refresh(): void {
    renderItems(bankList, currentBank, "withdraw");
    renderItems(playerList, currentPlayer, "deposit");
    goldBankEl.textContent = currentBankGold.toString();
    goldPlayerEl.textContent = currentPlayerGold.toString();
  }

  withdrawGoldBtn.addEventListener("click", () => {
    const amount = parseInt(goldInputBank.value, 10);
    if (!isNaN(amount) && amount > 0) {
      cb.onWithdrawGold(amount);
      goldInputBank.value = "";
    }
  });

  depositGoldBtn.addEventListener("click", () => {
    const amount = parseInt(goldInputPlayer.value, 10);
    if (!isNaN(amount) && amount > 0) {
      cb.onDepositGold(amount);
      goldInputPlayer.value = "";
    }
  });

  return {
    open: (bankInventory, bankGold) => {
      currentBank = bankInventory;
      currentBankGold = bankGold;
      refresh();
      setOpen(true);
    },
    update: (bankInventory, bankGold, playerInventory, playerGold) => {
      currentBank = bankInventory;
      currentBankGold = bankGold;
      currentPlayer = playerInventory;
      currentPlayerGold = playerGold;
      if (open) refresh();
    },
    close: () => setOpen(false),
    isOpen: () => open,
    setPlayerInventory: (slots, gold) => {
      currentPlayer = slots;
      currentPlayerGold = gold;
      if (open) refresh();
    },
    destroy: () => wrap.remove(),
  };
}
