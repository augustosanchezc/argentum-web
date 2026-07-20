// Barra inferior de macros: 6 slots ligados a las teclas 1-6.
// Se puede: arrastrar un hechizo del libro / un item del inventario a un slot,
// O hacer click en un slot vacío para ELEGIR qué asignar (usar item, equipar
// objeto o lanzar hechizo). Presionar la tecla (o click en un slot lleno) lo
// dispara. Persistido en localStorage por personaje.

import { getAoSpell, getItem, getSkill, type ItemDef } from "@ao/shared";

export type MacroKind = "spell" | "item" | "skill" | "command";

export interface MacroSlot {
  kind: MacroKind;
  id: number;
  // Tecla que dispara este macro (KeyboardEvent.code). Si falta, se usa la
  // tecla por defecto del slot (Digit1..Digit6).
  key?: string;
  // Acción custom (kind "command"): texto que se envía como chat/comando.
  command?: string;
  label?: string;
}

// Teclas asignables a un macro.
const KEY_OPTIONS: ReadonlyArray<{ code: string; label: string }> = [
  { code: "Digit1", label: "1" }, { code: "Digit2", label: "2" }, { code: "Digit3", label: "3" },
  { code: "Digit4", label: "4" }, { code: "Digit5", label: "5" }, { code: "Digit6", label: "6" },
  { code: "KeyQ", label: "Q" }, { code: "KeyE", label: "E" }, { code: "KeyR", label: "R" },
  { code: "KeyF", label: "F" }, { code: "KeyZ", label: "Z" }, { code: "KeyX", label: "X" },
  { code: "KeyC", label: "C" }, { code: "KeyV", label: "V" },
];

// Comandos custom rápidos (presets). El texto se envía como chat: el server los
// interpreta (/meditar, /descansar, /seguro son comandos de jugador).
const COMMAND_PRESETS: ReadonlyArray<{ text: string; label: string }> = [
  { text: "/meditar", label: "Meditar" },
  { text: "/descansar", label: "Descansar" },
  { text: "/seguro", label: "Modo seguro" },
];

function keyLabel(code: string): string {
  return KEY_OPTIONS.find((k) => k.code === code)?.label ?? code.replace(/^(Digit|Key)/, "");
}
function defaultKey(i: number): string {
  return KEY_OPTIONS[i]?.code ?? `Digit${(i + 1).toString()}`;
}
function slotKey(slot: MacroSlot | null, i: number): string {
  return slot?.key ?? defaultKey(i);
}

export interface MacroCallbacks {
  onTrigger(slot: MacroSlot): void;
  // Coordenadas del sprite del item para el ícono (null → sin ícono).
  resolveIcon(graphicId: number): { fileNum: number; x: number; y: number; w: number; h: number } | null;
  // Inventario actual del jugador (para el selector "usar" / "equipar").
  getItems(): ReadonlyArray<{ item: number; qty: number }>;
  // Hechizos conocidos del jugador (para el selector "hechizo").
  getSpells(): ReadonlyArray<number>;
  // Persistir la config en el server (además del localStorage). Se llama en
  // cada cambio; así los macros NO se reinician al reloguear (ni en otro equipo).
  onSave?(slots: Array<MacroSlot | null>): void;
}

// Lee la config de macros del localStorage (fallback si el server no tiene).
function readLocalMacros(key: string): Array<MacroSlot | null> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Array<MacroSlot | null>;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface MacroBarHandle {
  // Setea el macro por defecto (skill de clase en slot 1) si el slot está vacío.
  setDefaultSkill(skillId: number): void;
  // Agrega un hechizo al primer slot libre (doble-click en el libro). Devuelve
  // false si no hay slots libres.
  addSpellToFirstFree(spellId: number): boolean;
  destroy(): void;
}

const SLOT_COUNT = 11;

function slotLabel(slot: MacroSlot | null): string {
  if (!slot) return "";
  if (slot.kind === "command") return slot.label ?? slot.command ?? "Comando";
  if (slot.kind === "spell") return getAoSpell(slot.id)?.name ?? `Hechizo ${slot.id.toString()}`;
  if (slot.kind === "item") return getItem(slot.id)?.name ?? `Item ${slot.id.toString()}`;
  return getSkill(slot.id)?.name ?? `Skill ${slot.id.toString()}`;
}

// El AO equipa/usa con el mismo "UseItem"; separamos las categorías sólo para
// que el selector sea claro: armas/armaduras/cascos/escudos/barcos = equipar.
function isEquip(def: ItemDef): boolean {
  if (def.objType === 31) return true; // barco (navegar)
  return def.type === "weapon" || def.type === "armor" || def.type === "helmet" || def.type === "shield";
}

export function mountMacroBar(
  parent: HTMLElement,
  characterName: string,
  cb: MacroCallbacks,
  initialMacros?: ReadonlyArray<MacroSlot | null>,
): MacroBarHandle {
  const storageKey = `ao-macros-${characterName}`;
  const bar = document.createElement("div");
  bar.className = "ao-macrobar";
  parent.appendChild(bar);

  // Selector emergente (click en slot vacío).
  const picker = document.createElement("div");
  picker.className = "ao-macropick";
  picker.hidden = true;
  // Dentro del contenedor de la barra (no body): en fullscreen el elemento
  // fullscreen tapa a los hermanos de <body> y el picker no se veía.
  parent.appendChild(picker);

  let slots: Array<MacroSlot | null> = new Array<MacroSlot | null>(SLOT_COUNT).fill(null);
  // Prioridad: config del SERVER (persistente por personaje). Si el server no
  // tiene nada guardado todavía, se migra desde el localStorage local.
  const source =
    initialMacros && initialMacros.length > 0 ? [...initialMacros] : readLocalMacros(storageKey);
  if (source) {
    slots = source.slice(0, SLOT_COUNT);
    while (slots.length < SLOT_COUNT) slots.push(null);
  }

  function persist(): void {
    localStorage.setItem(storageKey, JSON.stringify(slots));
    cb.onSave?.(slots); // persistir también en el server (no se pierde al reloguear).
  }

  // Tecla elegida en el selector del picker actual.
  let pendingKey = "";
  // Slot en modo "presioná una tecla" para reasignar su tecla (-1 = ninguno).
  let rebinding = -1;
  // Macro elegido en el picker, pendiente de confirmar con "Guardar".
  let pendingMacro: MacroSlot | null = null;

  function assign(i: number, slot: MacroSlot): void {
    slots[i] = { ...slot, key: pendingKey || defaultKey(i) };
    persist();
    render();
    closePicker();
  }

  function closePicker(): void {
    picker.hidden = true;
  }

  // Construye el contenido del selector para el slot i y lo muestra.
  function openPicker(i: number): void {
    const items = cb.getItems();
    // El ARCO va a "Usar" (usarlo = cargar/disparar una flecha), no a Equipar.
    const usar = items.map((s) => getItem(s.item)).filter((d): d is ItemDef => !!d && (!isEquip(d) || d.ranged === true));
    const equipar = items.map((s) => getItem(s.item)).filter((d): d is ItemDef => !!d && isEquip(d) && d.ranged !== true);
    const spells = cb.getSpells().map((id) => getAoSpell(id)).filter((s): s is NonNullable<typeof s> => !!s);

    picker.replaceChildren();

    pendingKey = slotKey(slots[i], i);

    const head = document.createElement("div");
    head.className = "ao-macropick__head";
    head.innerHTML = `<span>Asignar macro al slot ${(i + 1).toString()}</span>`;
    const close = document.createElement("button");
    close.className = "ao-macropick__close";
    close.type = "button";
    close.textContent = "✕";
    close.addEventListener("click", closePicker);
    head.appendChild(close);
    picker.appendChild(head);

    // Selector de TECLA: se elige PRESIONANDO la tecla (no es desplegable).
    pendingMacro = null;
    const keyRow = document.createElement("div");
    keyRow.className = "ao-macropick__keyrow";
    const keyLbl = document.createElement("span");
    keyLbl.textContent = "Tecla:";
    keyRow.appendChild(keyLbl);
    const keyBtn = document.createElement("button");
    keyBtn.type = "button";
    keyBtn.className = "ao-macropick__keysel";
    keyBtn.textContent = keyLabel(pendingKey);
    let capturing = false;
    const captureHandler = (ev: KeyboardEvent): void => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.code !== "Escape") pendingKey = ev.code;
      capturing = false;
      keyBtn.textContent = keyLabel(pendingKey);
      window.removeEventListener("keydown", captureHandler, true);
    };
    keyBtn.addEventListener("click", () => {
      if (capturing) return;
      capturing = true;
      keyBtn.textContent = "Presioná una tecla…";
      // Captura en fase de captura para ganarle al disparo global de macros.
      window.addEventListener("keydown", captureHandler, true);
    });
    keyRow.appendChild(keyBtn);
    picker.appendChild(keyRow);

    const tabsBar = document.createElement("div");
    tabsBar.className = "ao-macropick__tabs";
    const body = document.createElement("div");
    body.className = "ao-macropick__body";
    picker.appendChild(tabsBar);
    picker.appendChild(body);

    // Selecciona (no asigna) el macro; se confirma con "Guardar".
    const selectRow = (row: HTMLElement, slot: MacroSlot): void => {
      pendingMacro = slot;
      body.querySelectorAll(".ao-macropick__row--sel").forEach((r) => r.classList.remove("ao-macropick__row--sel"));
      row.classList.add("ao-macropick__row--sel");
    };

    // Fila de un item (usar/equipar) o hechizo.
    const itemRow = (def: ItemDef): HTMLElement => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ao-macropick__row";
      const icon = def.graphic > 0 ? cb.resolveIcon(def.graphic) : null;
      if (icon) {
        const img = document.createElement("span");
        img.className = "ao-macropick__icon";
        img.style.width = `${Math.min(icon.w, 28).toString()}px`;
        img.style.height = `${Math.min(icon.h, 28).toString()}px`;
        img.style.backgroundImage = `url(/ao-assets/graficos/${icon.fileNum.toString()}.png)`;
        img.style.backgroundPosition = `-${icon.x.toString()}px -${icon.y.toString()}px`;
        row.appendChild(img);
      }
      const name = document.createElement("span");
      name.className = "ao-macropick__name";
      name.textContent = def.name;
      row.appendChild(name);
      row.addEventListener("click", () => { selectRow(row, { kind: "item", id: def.id }); });
      return row;
    };
    const spellRow = (sp: { id: number; name: string; manaCost?: number }): HTMLElement => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ao-macropick__row";
      const name = document.createElement("span");
      name.className = "ao-macropick__name";
      name.textContent = sp.name;
      row.appendChild(name);
      if (sp.manaCost) {
        const mana = document.createElement("span");
        mana.className = "ao-macropick__mana";
        mana.textContent = `${sp.manaCost.toString()} maná`;
        row.appendChild(mana);
      }
      row.addEventListener("click", () => { selectRow(row, { kind: "spell", id: sp.id }); });
      return row;
    };

    const empty = (msg: string): HTMLElement => {
      const e = document.createElement("div");
      e.className = "ao-macropick__empty";
      e.textContent = msg;
      return e;
    };

    // Fila de comando custom (preset o texto libre).
    const commandRow = (text: string, label: string): HTMLElement => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "ao-macropick__row";
      const name = document.createElement("span");
      name.className = "ao-macropick__name";
      name.textContent = label;
      row.appendChild(name);
      const cmd = document.createElement("span");
      cmd.className = "ao-macropick__mana";
      cmd.textContent = text;
      row.appendChild(cmd);
      row.addEventListener("click", () => { selectRow(row, { kind: "command", id: 0, command: text, label }); });
      return row;
    };

    const showTab = (which: "usar" | "equipar" | "hechizo" | "comando"): void => {
      body.replaceChildren();
      [...tabsBar.children].forEach((t) => {
        (t as HTMLElement).classList.toggle("ao-macropick__tab--active", (t as HTMLElement).dataset.tab === which);
      });
      if (which === "usar") {
        if (usar.length === 0) body.appendChild(empty("No tenés ítems consumibles."));
        for (const d of usar) body.appendChild(itemRow(d));
      } else if (which === "equipar") {
        if (equipar.length === 0) body.appendChild(empty("No tenés objetos equipables."));
        for (const d of equipar) body.appendChild(itemRow(d));
      } else if (which === "hechizo") {
        if (spells.length === 0) body.appendChild(empty("No conocés hechizos."));
        for (const sp of spells) body.appendChild(spellRow(sp));
      } else {
        // Comando: presets + texto libre.
        for (const pr of COMMAND_PRESETS) body.appendChild(commandRow(pr.text, pr.label));
        const freeWrap = document.createElement("div");
        freeWrap.className = "ao-macropick__free";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Comando custom (ej. /meditar)";
        input.className = "ao-macropick__freein";
        const add = document.createElement("button");
        add.type = "button";
        add.className = "ao-macropick__freebtn";
        add.textContent = "Asignar";
        const doAdd = (): void => {
          const txt = input.value.trim();
          if (txt) { pendingMacro = { kind: "command", id: 0, command: txt, label: txt }; add.textContent = "✓ Elegido"; }
        };
        add.addEventListener("click", doAdd);
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doAdd(); } });
        freeWrap.append(input, add);
        body.appendChild(freeWrap);
      }
    };

    for (const [key, lbl] of [["usar", "Usar item"], ["equipar", "Equipar"], ["hechizo", "Tirar magia"], ["comando", "Comando"]] as const) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ao-macropick__tab";
      tab.dataset.tab = key;
      tab.textContent = lbl;
      tab.addEventListener("click", () => { showTab(key); });
      tabsBar.appendChild(tab);
    }

    // Pie: botón Guardar (confirma el macro elegido con la tecla presionada).
    const foot = document.createElement("div");
    foot.className = "ao-macropick__foot";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ao-macropick__savebtn";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", () => {
      if (pendingMacro) assign(i, pendingMacro);
      else closePicker();
    });
    foot.appendChild(saveBtn);
    picker.appendChild(foot);

    showTab("usar");
    picker.hidden = false;
  }

  // Cierra el selector al clickear fuera.
  const onDocClick = (ev: MouseEvent): void => {
    if (rebinding >= 0 && !bar.contains(ev.target as Node)) { rebinding = -1; render(); }
    if (picker.hidden) return;
    const t = ev.target as Node;
    if (!picker.contains(t) && !bar.contains(t)) closePicker();
  };
  document.addEventListener("mousedown", onDocClick);

  function render(): void {
    bar.replaceChildren();
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const cell = document.createElement("div");
      cell.className = "ao-macrobar__slot";
      const slot = slots[i];

      const key = document.createElement("span");
      key.className = "ao-macrobar__key";
      key.textContent = rebinding === i ? "…" : keyLabel(slotKey(slot, i));
      if (slot) {
        // La etiqueta de tecla es clickeable: reasigna el macro a CUALQUIER tecla.
        key.style.cursor = "pointer";
        key.title = "Click y presioná una tecla para reasignar";
        if (rebinding === i) { key.style.color = "#fff"; cell.style.outline = "2px solid #4f8ff0"; }
        key.addEventListener("click", (ev) => {
          ev.stopPropagation();
          rebinding = rebinding === i ? -1 : i;
          render();
        });
      }
      cell.appendChild(key);

      if (slot) {
        cell.classList.add("ao-macrobar__slot--filled");
        cell.title = slotLabel(slot);

        // Ícono real para items; nombre corto para hechizos/skills.
        let iconed = false;
        if (slot.kind === "item") {
          const def = getItem(slot.id);
          const icon = def && def.graphic > 0 ? cb.resolveIcon(def.graphic) : null;
          if (icon) {
            const img = document.createElement("div");
            img.className = "ao-macrobar__icon";
            img.style.width = `${icon.w.toString()}px`;
            img.style.height = `${icon.h.toString()}px`;
            img.style.backgroundImage = `url(/ao-assets/graficos/${icon.fileNum.toString()}.png)`;
            img.style.backgroundPosition = `-${icon.x.toString()}px -${icon.y.toString()}px`;
            // Escala por sprite para caber en el slot de 54px (los grandes se
            // recortaban con el scale fijo 1.35; los chicos se agrandan).
            const k = Math.min(48 / Math.max(icon.w, icon.h), 1.5);
            img.style.transform = `scale(${k.toFixed(3)})`;
            cell.appendChild(img);
            iconed = true;
          }
        }
        if (!iconed) {
          const name = document.createElement("span");
          name.className = "ao-macrobar__name";
          name.textContent = slotLabel(slot);
          cell.appendChild(name);
        }

        cell.addEventListener("click", () => {
          cb.onTrigger(slot);
        });
        // Click derecho: vaciar el slot.
        cell.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          slots[i] = null;
          persist();
          render();
        });
      } else {
        // Slot vacío: click abre el selector para elegir qué asignar.
        cell.classList.add("ao-macrobar__slot--empty");
        cell.title = "Click para asignar (usar / equipar / hechizo)";
        const plus = document.createElement("span");
        plus.className = "ao-macrobar__plus";
        plus.textContent = "+";
        cell.appendChild(plus);
        cell.addEventListener("click", () => { openPicker(i); });
      }

      // Drop target: acepta "spell:ID" (libro) y "item:ID" (inventario).
      cell.addEventListener("dragover", (ev) => {
        const types = ev.dataTransfer?.types ?? [];
        if ([...types].includes("text/plain")) {
          ev.preventDefault();
          cell.classList.add("ao-macrobar__slot--hover");
        }
      });
      cell.addEventListener("dragleave", () => {
        cell.classList.remove("ao-macrobar__slot--hover");
      });
      cell.addEventListener("drop", (ev) => {
        ev.preventDefault();
        cell.classList.remove("ao-macrobar__slot--hover");
        const data = ev.dataTransfer?.getData("text/plain") ?? "";
        const m = data.match(/^(spell|item|skill):(\d+)$/);
        if (!m) return;
        slots[i] = { kind: m[1] as MacroKind, id: parseInt(m[2]) };
        persist();
        render();
      });

      bar.appendChild(cell);
    }
  }
  render();

  // La tecla configurada de cada macro lo dispara (salvo con el chat enfocado —
  // eso lo filtra el caller antes de llamar acá vía el listener global).
  const onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    // Modo reasignar: la próxima tecla queda ligada al macro (Esc cancela).
    if (rebinding >= 0) {
      e.preventDefault();
      const slot = slots[rebinding];
      if (slot && e.code !== "Escape") { slot.key = e.code; persist(); }
      rebinding = -1;
      render();
      return;
    }
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const slot = slots[i];
      if (slot && slotKey(slot, i) === e.code) {
        e.preventDefault();
        cb.onTrigger(slot);
        return;
      }
    }
  };
  window.addEventListener("keydown", onKeyDown);

  return {
    setDefaultSkill: (skillId) => {
      if (slots[0] === null) {
        slots[0] = { kind: "skill", id: skillId };
        persist();
        render();
      }
    },
    addSpellToFirstFree: (spellId) => {
      // Si ya está en un slot, no duplicar.
      if (slots.some((s) => s?.kind === "spell" && s.id === spellId)) return true;
      const i = slots.findIndex((s) => s === null);
      if (i < 0) return false;
      slots[i] = { kind: "spell", id: spellId, key: defaultKey(i) };
      persist();
      render();
      return true;
    },
    destroy: () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onDocClick);
      picker.remove();
      bar.remove();
    },
  };
}
