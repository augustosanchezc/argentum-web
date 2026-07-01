import { getItem, type InventorySlot } from "@ao/shared";

// Panel de inventario (E-3.7, versión click-based). Se abre/cierra con la
// tecla I. Muestra oro y los items; cada uno se puede usar/equipar o vender.

export interface InventoryData {
  gold: number;
  slots: ReadonlyArray<InventorySlot>;
  equippedWeapon: number | null;
  equippedArmor: number | null;
}

export interface InventoryCallbacks {
  onUse(item: number): void;
  onSell(item: number): void;
}

export interface InventoryHandle {
  setData(data: InventoryData): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function mountInventory(
  parent: HTMLElement,
  cb: InventoryCallbacks,
): InventoryHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-inv";
  wrap.innerHTML = `
    <div class="ao-inv__title">Inventario <span class="ao-inv__gold">0 oro</span></div>
    <ul class="ao-inv__list"></ul>
    <div class="ao-inv__hint">I para abrir/cerrar · G para agarrar del suelo</div>
  `;
  parent.appendChild(wrap);

  const goldEl = wrap.querySelector<HTMLSpanElement>(".ao-inv__gold")!;
  const listEl = wrap.querySelector<HTMLUListElement>(".ao-inv__list")!;
  let open = false;
  let last: InventoryData = { gold: 0, slots: [], equippedWeapon: null, equippedArmor: null };

  function render(): void {
    goldEl.textContent = `${last.gold.toString()} oro`;
    listEl.replaceChildren();
    if (last.slots.length === 0) {
      const li = document.createElement("li");
      li.className = "ao-inv__empty";
      li.textContent = "(vacío)";
      listEl.appendChild(li);
      return;
    }
    for (const slot of last.slots) {
      const def = getItem(slot.item);
      if (!def) continue;
      const equipped =
        (def.type === "weapon" && last.equippedWeapon === def.id) ||
        (def.type === "armor" && last.equippedArmor === def.id);

      const li = document.createElement("li");
      li.className = "ao-inv__item";

      const name = document.createElement("span");
      name.className = "ao-inv__name";
      name.textContent = `${def.name}${slot.qty > 1 ? ` x${slot.qty.toString()}` : ""}${equipped ? " (equipada)" : ""}`;
      li.appendChild(name);

      const useBtn = document.createElement("button");
      useBtn.className = "ao-inv__btn";
      useBtn.textContent = def.type === "potion" ? "Usar" : "Equipar";
      useBtn.addEventListener("click", () => {
        cb.onUse(def.id);
      });
      li.appendChild(useBtn);

      const sellBtn = document.createElement("button");
      sellBtn.className = "ao-inv__btn ao-inv__btn--sell";
      sellBtn.textContent = `Vender ${Math.floor(def.value / 2).toString()}`;
      sellBtn.addEventListener("click", () => {
        cb.onSell(def.id);
      });
      li.appendChild(sellBtn);

      listEl.appendChild(li);
    }
  }

  function setOpen(v: boolean): void {
    open = v;
    wrap.classList.toggle("ao-inv--open", open);
  }

  return {
    setData: (data) => {
      last = data;
      render();
    },
    toggle: () => {
      setOpen(!open);
    },
    isOpen: () => open,
    destroy: () => {
      wrap.remove();
    },
  };
}
