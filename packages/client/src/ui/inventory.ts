import { getItem, type InventorySlot } from "@ao/shared";

// Panel de inventario (E-3.7). Grilla drag-and-drop 4x5.
//   - Click derecho o botón "Vender": vender al comerciante (si hay tienda abierta).
//   - Doble click: usar / equipar.
//   - Drag → otro slot: reordenar (server autoritativo).
//   - Drag → zona "Tirar": soltar al piso, encima del personaje.
// Se abre/cierra con la tecla I.

const SLOT_COUNT = 20;

export interface InventoryData {
  gold: number;
  slots: ReadonlyArray<InventorySlot>;
  equippedWeapon: number | null;
  equippedArmor: number | null;
}

// Coordenadas de un sprite dentro del atlas del AO. Devuelto por Tileset.entry
// pero acá lo redeclaramos para no acoplar la UI al módulo de world/.
export interface IconRect {
  fileNum: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InventoryCallbacks {
  onUse(item: number): void;
  onSell(item: number): void;
  onReorder(from: number, to: number): void;
  onDrop(slot: number, qty: number): void;
  // Devuelve las bounds del sprite del ítem dentro del atlas del AO.
  // null si el grh no está disponible (usa fallback: siglas).
  resolveIcon(graphicId: number): IconRect | null;
}

export interface InventoryHandle {
  setData(data: InventoryData): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

function itemColor(item: number): string {
  // Sin sprites de items todavía: color por type + hash del id para
  // distinguir dagas de espadas etc. Suficiente hasta E-4.
  const def = getItem(item);
  if (!def) return "#333";
  const hue = (def.id * 47) % 360;
  const l = def.type === "potion" ? 55 : def.type === "weapon" ? 40 : 35;
  return `hsl(${hue.toString()}, 55%, ${l.toString()}%)`;
}

export function mountInventory(
  parent: HTMLElement,
  cb: InventoryCallbacks,
): InventoryHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-inv";
  wrap.innerHTML = `
    <div class="ao-inv__title">Inventario <span class="ao-inv__gold">0 oro</span></div>
    <div class="ao-inv__grid" role="grid"></div>
    <div class="ao-inv__trash" data-role="trash">Arrastrá acá para tirar al suelo</div>
    <div class="ao-inv__hint">I abrir/cerrar · G recoger · doble click usar/equipar · click derecho vender</div>
  `;
  parent.appendChild(wrap);

  const goldEl = wrap.querySelector<HTMLSpanElement>(".ao-inv__gold")!;
  const gridEl = wrap.querySelector<HTMLDivElement>(".ao-inv__grid")!;
  const trashEl = wrap.querySelector<HTMLDivElement>(".ao-inv__trash")!;

  let open = false;
  let last: InventoryData = { gold: 0, slots: [], equippedWeapon: null, equippedArmor: null };
  let draggingFrom: number | null = null;

  function isEquipped(item: number): boolean {
    return last.equippedWeapon === item || last.equippedArmor === item;
  }

  function render(): void {
    goldEl.textContent = `${last.gold.toString()} oro`;
    gridEl.replaceChildren();
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const cell = document.createElement("div");
      cell.className = "ao-inv__cell";
      cell.dataset.slot = i.toString();

      const slot = i < last.slots.length ? last.slots[i] : null;
      if (slot) {
        const def = getItem(slot.item);
        if (def) {
          cell.classList.add("ao-inv__cell--filled");
          if (isEquipped(def.id)) cell.classList.add("ao-inv__cell--equipped");
          cell.style.setProperty("--item-color", itemColor(def.id));
          cell.title = `${def.name}${slot.qty > 1 ? ` x${slot.qty.toString()}` : ""}${isEquipped(def.id) ? " (equipada)" : ""}`;
          cell.draggable = true;

          // Sprite real del AO si el atlas ya lo tiene cargado. Si no, siglas.
          const icon = def.graphic > 0 ? cb.resolveIcon(def.graphic) : null;
          if (icon) {
            const img = document.createElement("div");
            img.className = "ao-inv__cell-icon";
            img.style.width = `${icon.w.toString()}px`;
            img.style.height = `${icon.h.toString()}px`;
            img.style.backgroundImage = `url(/ao-assets/graficos/${icon.fileNum.toString()}.png)`;
            img.style.backgroundPosition = `-${icon.x.toString()}px -${icon.y.toString()}px`;
            cell.appendChild(img);
          } else {
            const label = document.createElement("span");
            label.className = "ao-inv__cell-name";
            label.textContent = def.name.slice(0, 3).toUpperCase();
            cell.appendChild(label);
          }

          if (slot.qty > 1) {
            const qty = document.createElement("span");
            qty.className = "ao-inv__cell-qty";
            qty.textContent = slot.qty.toString();
            cell.appendChild(qty);
          }

          // Doble click: usar/equipar (mismo efecto que el botón "Usar" viejo).
          cell.addEventListener("dblclick", () => {
            cb.onUse(def.id);
          });
          // Click derecho: vender (mantiene compat con la venta del viejo).
          cell.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            cb.onSell(def.id);
          });
          // Drag start guarda el slot origen.
          cell.addEventListener("dragstart", (ev) => {
            draggingFrom = i;
            cell.classList.add("ao-inv__cell--dragging");
            ev.dataTransfer?.setData("text/plain", i.toString());
            if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
          });
          cell.addEventListener("dragend", () => {
            draggingFrom = null;
            cell.classList.remove("ao-inv__cell--dragging");
          });
        }
      }

      // Drop target: cualquier cell recibe drops (para reordenar).
      cell.addEventListener("dragover", (ev) => {
        if (draggingFrom !== null) {
          ev.preventDefault();
          if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
          cell.classList.add("ao-inv__cell--drop-target");
        }
      });
      cell.addEventListener("dragleave", () => {
        cell.classList.remove("ao-inv__cell--drop-target");
      });
      cell.addEventListener("drop", (ev) => {
        ev.preventDefault();
        cell.classList.remove("ao-inv__cell--drop-target");
        if (draggingFrom === null) return;
        if (draggingFrom === i) return;
        // El server valida rangos y slots vacios de acuerdo a su verdad.
        cb.onReorder(draggingFrom, i);
      });

      gridEl.appendChild(cell);
    }
  }

  // Trash zone: drop de un item lo tira al suelo del jugador.
  trashEl.addEventListener("dragover", (ev) => {
    if (draggingFrom !== null) {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      trashEl.classList.add("ao-inv__trash--hover");
    }
  });
  trashEl.addEventListener("dragleave", () => {
    trashEl.classList.remove("ao-inv__trash--hover");
  });
  trashEl.addEventListener("drop", (ev) => {
    ev.preventDefault();
    trashEl.classList.remove("ao-inv__trash--hover");
    if (draggingFrom === null) return;
    const slot = last.slots[draggingFrom];
    if (!slot) return;
    // Tiramos toda la pila al piso (para pociones/oro apilables se puede
    // afinar mas adelante con un dialogo de cantidad; para MVP tirar todo).
    cb.onDrop(draggingFrom, slot.qty);
  });

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
