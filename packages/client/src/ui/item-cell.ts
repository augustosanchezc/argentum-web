// Celda de item reutilizable (grillas de tienda/banco/comercio): ícono real
// del AO vía CSS, cantidad y precio opcionales, tooltip con el nombre.

import { getItem } from "@ao/shared";

export interface IconRect {
  fileNum: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type IconResolver = (graphicId: number) => IconRect | null;

export interface ItemCellOpts {
  item: number;
  qty?: number;
  price?: number;
  resolveIcon: IconResolver;
  onClick?: () => void;
  onContextMenu?: () => void;
}

export function createItemCell(opts: ItemCellOpts): HTMLDivElement {
  const def = getItem(opts.item);
  const cell = document.createElement("div");
  cell.className = "ao-cell";
  if (!def) {
    cell.classList.add("ao-cell--empty");
    return cell;
  }
  cell.title = `${def.name}${opts.qty !== undefined && opts.qty > 1 ? ` x${opts.qty.toString()}` : ""}${opts.price !== undefined ? ` — ${opts.price.toString()} oro` : ""}`;

  const icon = def.graphic > 0 ? opts.resolveIcon(def.graphic) : null;
  if (icon) {
    const img = document.createElement("div");
    img.className = "ao-cell__icon";
    img.style.width = `${Math.min(icon.w, 32).toString()}px`;
    img.style.height = `${Math.min(icon.h, 32).toString()}px`;
    img.style.backgroundImage = `url(/ao-assets/graficos/${icon.fileNum.toString()}.png)`;
    img.style.backgroundPosition = `-${icon.x.toString()}px -${icon.y.toString()}px`;
    cell.appendChild(img);
  } else {
    const label = document.createElement("span");
    label.className = "ao-cell__name";
    label.textContent = def.name.slice(0, 3).toUpperCase();
    cell.appendChild(label);
  }

  if (opts.qty !== undefined && opts.qty > 1) {
    const qty = document.createElement("span");
    qty.className = "ao-cell__qty";
    qty.textContent = opts.qty.toString();
    cell.appendChild(qty);
  }
  if (opts.price !== undefined) {
    const price = document.createElement("span");
    price.className = "ao-cell__price";
    price.textContent = opts.price.toString();
    cell.appendChild(price);
  }
  if (opts.onClick) {
    cell.classList.add("ao-cell--clickable");
    cell.addEventListener("click", opts.onClick);
  }
  if (opts.onContextMenu) {
    cell.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      opts.onContextMenu!();
    });
  }
  return cell;
}
