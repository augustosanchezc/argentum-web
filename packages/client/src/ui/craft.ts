// Ventana de construcción (herrería / carpintería / fundición del AO).
// Lista los items construibles del catálogo real con sus costos; el server
// valida skill, materiales y cercanía de yunque/fragua.

import { ITEMS, type ItemDef } from "@ao/shared";

export type CraftMode = "herreria" | "carpinteria";

export interface CraftCallbacks {
  onCraft(item: number): void;
}

export interface CraftHandle {
  open(mode: CraftMode): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

function costText(def: ItemDef): string {
  if (def.skHerreria !== undefined) {
    const parts: string[] = [];
    if (def.lingH) parts.push(`${def.lingH.toString()} hierro`);
    if (def.lingP) parts.push(`${def.lingP.toString()} plata`);
    if (def.lingO) parts.push(`${def.lingO.toString()} oro`);
    return `${parts.join(" + ")} · skill ${def.skHerreria.toString()}`;
  }
  return `${(def.madera ?? 0).toString()} leña · skill ${(def.skCarpinteria ?? 0).toString()}`;
}

export function mountCraft(parent: HTMLElement, cb: CraftCallbacks): CraftHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-craft";
  wrap.innerHTML = `
    <div class="ao-craft__box">
      <div class="ao-craft__title"><span class="ao-craft__name">Herrería</span>
        <button type="button" class="ao-craft__close">✕</button>
      </div>
      <div class="ao-craft__hint"></div>
      <div class="ao-craft__list"></div>
    </div>
  `;
  parent.appendChild(wrap);

  const nameEl = wrap.querySelector<HTMLSpanElement>(".ao-craft__name")!;
  const hintEl = wrap.querySelector<HTMLDivElement>(".ao-craft__hint")!;
  const listEl = wrap.querySelector<HTMLDivElement>(".ao-craft__list")!;
  wrap.querySelector(".ao-craft__close")!.addEventListener("click", () => {
    close();
  });

  function render(mode: CraftMode): void {
    nameEl.textContent = mode === "herreria" ? "Herrería" : "Carpintería";
    hintEl.textContent =
      mode === "herreria"
        ? "Junto a un yunque. Fundí minerales en la fragua (5 crudos → 1 lingote)."
        : "Con el serrucho en el inventario y leña suficiente.";
    listEl.replaceChildren();

    const craftables = Object.values(ITEMS).filter((d) =>
      mode === "herreria" ? (d.skHerreria ?? 0) > 0 : (d.madera ?? 0) > 0,
    );
    craftables.sort((a, b) => (a.skHerreria ?? a.skCarpinteria ?? 0) - (b.skHerreria ?? b.skCarpinteria ?? 0));

    // Fundición primero (solo herrería).
    if (mode === "herreria") {
      for (const [ingot, label] of [
        [386, "Lingote de hierro (5 hierro crudo)"],
        [387, "Lingote de plata (5 plata cruda)"],
        [388, "Lingote de oro (5 oro crudo)"],
      ] as Array<[number, string]>) {
        const row = document.createElement("div");
        row.className = "ao-craft__row ao-craft__row--smelt";
        row.innerHTML = `<span>${label}</span><button type="button">Fundir</button>`;
        row.querySelector("button")!.addEventListener("click", () => {
          cb.onCraft(ingot);
        });
        listEl.appendChild(row);
      }
    }

    for (const def of craftables.slice(0, 60)) {
      const row = document.createElement("div");
      row.className = "ao-craft__row";
      row.innerHTML = `
        <span class="ao-craft__item">${def.name}</span>
        <span class="ao-craft__cost">${costText(def)}</span>
        <button type="button">Construir</button>
      `;
      row.querySelector("button")!.addEventListener("click", () => {
        cb.onCraft(def.id);
      });
      listEl.appendChild(row);
    }
  }

  function close(): void {
    wrap.classList.remove("ao-craft--open");
  }

  return {
    open: (mode) => {
      render(mode);
      wrap.classList.add("ao-craft--open");
    },
    close,
    isOpen: () => wrap.classList.contains("ao-craft--open"),
    destroy: () => {
      wrap.remove();
    },
  };
}
