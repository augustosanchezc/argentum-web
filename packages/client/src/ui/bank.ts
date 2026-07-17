import { getItem, type InventorySlot } from "@ao/shared";
import { createItemCell, type IconResolver } from "./item-cell";

// Ventana de banco del AO Libre (frmBancoObj): fondo con el arte original
// (Boveda.jpg 462×532) y, encima, las dos grillas — bóveda a la izquierda, tu
// inventario a la derecha —, la fila de oro (depositar/retirar con monto), las
// flechas de mover items y la placa de info. Geometría del .frm (twips ÷ 15).

export interface BankCallbacks {
  onDepositItem(item: number, qty: number): void;
  onWithdrawItem(item: number, qty: number): void;
  onDepositGold(amount: number): void;
  onWithdrawGold(amount: number): void;
  resolveIcon: IconResolver;
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

type Selection = { side: "bank" | "inv"; item: number; qty: number } | null;

export function mountBank(parent: HTMLElement, cb: BankCallbacks): BankHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-bank ao-vp";
  wrap.innerHTML = `
    <div class="ao-vp__win">
      <div class="ao-vp__head">
        <span class="ao-vp__title">Banco</span>
        <button class="ao-vp__close" type="button" title="Cerrar">✕</button>
      </div>
      <div class="ao-vp__cols">
        <div class="ao-vp__col">
          <div class="ao-vp__label">Bóveda</div>
          <div class="ao-vp__grid ao-bank__bankgrid"></div>
        </div>
        <div class="ao-vp__col">
          <div class="ao-vp__label">Tu inventario</div>
          <div class="ao-vp__grid ao-bank__invgrid"></div>
        </div>
      </div>
      <div class="ao-vp__info"><span class="ao-bank__info">&nbsp;</span></div>
      <div class="ao-vp__foot">
        <label class="ao-vp__qtylbl">Cantidad
          <input class="ao-vp__field ao-bank__itemqty" type="number" min="1" value="1" />
        </label>
        <button class="ao-vp__btn ao-vp__btn--primary ao-bank__dep" type="button" title="Depositar el item seleccionado de tu inventario">◀ Depositar</button>
        <button class="ao-vp__btn ao-bank__wit" type="button" title="Retirar el item seleccionado de la bóveda">Retirar ▶</button>
      </div>
      <div class="ao-vp__goldrow">
        <span class="ao-vp__goldinfo">🪙 Bóveda: <b class="ao-bank__goldbank">0</b> · En mano: <b class="ao-bank__goldyou">0</b></span>
        <input class="ao-vp__field ao-bank__goldqty" type="number" min="1" placeholder="0" />
        <button class="ao-vp__btn ao-bank__depgold" type="button">Depositar oro</button>
        <button class="ao-vp__btn ao-bank__witgold" type="button">Retirar oro</button>
      </div>
    </div>
  `;
  parent.appendChild(wrap);

  const bankGrid = wrap.querySelector<HTMLDivElement>(".ao-bank__bankgrid")!;
  const invGrid = wrap.querySelector<HTMLDivElement>(".ao-bank__invgrid")!;
  const goldYouEl = wrap.querySelector<HTMLElement>(".ao-bank__goldyou")!;
  const goldBankEl = wrap.querySelector<HTMLElement>(".ao-bank__goldbank")!;
  const goldQtyEl = wrap.querySelector<HTMLInputElement>(".ao-bank__goldqty")!;
  const itemQtyEl = wrap.querySelector<HTMLInputElement>(".ao-bank__itemqty")!;
  const infoEl = wrap.querySelector<HTMLElement>(".ao-bank__info")!;
  const closeBtn = wrap.querySelector<HTMLButtonElement>(".ao-vp__close")!;
  const depGoldBtn = wrap.querySelector<HTMLButtonElement>(".ao-bank__depgold")!;
  const witGoldBtn = wrap.querySelector<HTMLButtonElement>(".ao-bank__witgold")!;
  const depBtn = wrap.querySelector<HTMLButtonElement>(".ao-bank__dep")!;
  const witBtn = wrap.querySelector<HTMLButtonElement>(".ao-bank__wit")!;

  let open = false;
  let bankSlots: ReadonlyArray<InventorySlot> = [];
  let invSlots: ReadonlyArray<InventorySlot> = [];
  let bankGold = 0;
  let playerGold = 0;
  let selected: Selection = null;

  function itemQty(): number {
    const n = Math.floor(Number(itemQtyEl.value));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 1;
  }
  function goldAmount(): number {
    const n = Math.floor(Number(goldQtyEl.value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function renderInfo(): void {
    if (!selected) { infoEl.innerHTML = "&nbsp;"; return; }
    const def = getItem(selected.item);
    infoEl.textContent = def ? `${def.name} (${selected.qty.toString()})` : " ";
  }

  function select(side: "bank" | "inv", item: number, qty: number, cell: HTMLElement): void {
    selected = { side, item, qty };
    wrap.querySelectorAll(".ao-cell--sel").forEach((c) => { c.classList.remove("ao-cell--sel"); });
    cell.classList.add("ao-cell--sel");
    renderInfo();
  }

  function fillGrid(grid: HTMLElement, side: "bank" | "inv", slots: ReadonlyArray<InventorySlot>): void {
    grid.replaceChildren();
    const items = slots.filter((s): s is InventorySlot => !!s && s.item > 0);
    const count = Math.max(30, Math.ceil(items.length / 5) * 5);
    for (let i = 0; i < count; i++) {
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
        onClick: () => { select(side, s.item, s.qty, cell); },
      });
      if (selected && selected.side === side && selected.item === s.item) cell.classList.add("ao-cell--sel");
      grid.appendChild(cell);
    }
  }

  function refresh(): void {
    fillGrid(bankGrid, "bank", bankSlots);
    fillGrid(invGrid, "inv", invSlots);
    goldYouEl.textContent = playerGold.toLocaleString("es");
    goldBankEl.textContent = bankGold.toLocaleString("es");
    // Si el item seleccionado ya no existe en su lado, limpiar.
    if (selected) {
      const src = selected.side === "bank" ? bankSlots : invSlots;
      if (!src.some((s) => s && s.item === selected!.item)) { selected = null; renderInfo(); }
    }
  }

  function setOpen(v: boolean): void {
    open = v;
    wrap.classList.toggle("ao-bank--open", v);
    if (!v) { selected = null; renderInfo(); }
  }

  closeBtn.addEventListener("click", () => { setOpen(false); });
  depBtn.addEventListener("click", () => {
    if (selected?.side === "inv") cb.onDepositItem(selected.item, itemQty());
  });
  witBtn.addEventListener("click", () => {
    if (selected?.side === "bank") cb.onWithdrawItem(selected.item, itemQty());
  });
  depGoldBtn.addEventListener("click", () => {
    const a = goldAmount();
    if (a > 0) cb.onDepositGold(a);
  });
  witGoldBtn.addEventListener("click", () => {
    const a = goldAmount();
    if (a > 0) cb.onWithdrawGold(a);
  });

  return {
    open: (bankInventory, bankGoldAmt) => {
      bankSlots = bankInventory;
      bankGold = bankGoldAmt;
      selected = null;
      itemQtyEl.value = "1";
      goldQtyEl.value = "";
      refresh();
      renderInfo();
      setOpen(true);
    },
    update: (bankInventory, bankGoldAmt, playerInventory, playerGoldAmt) => {
      bankSlots = bankInventory;
      bankGold = bankGoldAmt;
      invSlots = playerInventory;
      playerGold = playerGoldAmt;
      if (open) refresh();
    },
    close: () => { setOpen(false); },
    isOpen: () => open,
    setPlayerInventory: (slots, gold) => {
      invSlots = slots;
      playerGold = gold;
      if (open) refresh();
    },
    destroy: () => { wrap.remove(); },
  };
}
