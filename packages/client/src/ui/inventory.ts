import { getAoSpell, getItem, type InventorySlot } from "@ao/shared";

// Panel lateral clásico del AO (siempre visible, tecla I lo oculta):
//   - Cabecera: nombre, nivel, oro.
//   - Barras: HP, maná, hambre, sed, XP. Chips de drogas activas.
//   - Botones: switch Inventario/Hechizos, Estadísticas, Teclas.
//   - Tab Inventario: grilla drag-and-drop + zona de tirar.
//   - Tab Hechizos: libro real (Hechizos.dat); click = seleccionar para
//     lanzar (después click en el objetivo); drag → barra de macros.

// 24 slots en grilla de 6 columnas (densidad del cliente AO clásico).
const SLOT_COUNT = 24;

export interface InventoryData {
  gold: number;
  slots: ReadonlyArray<InventorySlot>;
  equippedWeapon: number | null;
  equippedArmor: number | null;
  equippedHelmet?: number | null;
  equippedShield?: number | null;
}

export interface PanelStats {
  name: string;
  level: number;
  xpInto: number;
  xpForNext: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  hunger: number;
  thirst: number;
  sta: number;
  maxSta: number;
  strBonus: number;
  agiBonus: number;
  buffExpiresAt: number;
  // Atributos base (para los chips FUE/AGI del panel).
  str: number;
  agi: number;
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
  resolveIcon(graphicId: number): IconRect | null;
  // Objeto clickeado en el inventario (para la tecla "Usar / Equipar").
  onSelectItem?(item: number): void;
  // Hechizo seleccionado para lanzar (null = deseleccionado).
  onSelectSpell(spellId: number | null): void;
  // Doble-click en un hechizo del libro: agregarlo a la barra de macros.
  onAddSpellMacro?(spellId: number): void;
  onOpenStats(): void;
  onOpenKeys(): void;
  onOpenQuests(): void;
  // Volver a la pantalla de selección de personajes.
  onChangeCharacter(): void;
  // Botones Party / Clanes del box de vitales.
  onOpenParty(): void;
  onOpenClanes(): void;
  // Click en el minimapa → abre el mapa-mundi.
  onOpenWorldMap(): void;
}

export interface InventoryHandle {
  setData(data: InventoryData): void;
  setSlots(gold: number, slots: InventoryData["slots"]): void;
  setStats(stats: PanelStats): void;
  setSpells(spellIds: ReadonlyArray<number>): void;
  clearSpellSelection(): void;
  // Texto de zona actual (nombre del mapa) en el box de vitales.
  setLocation(text: string): void;
  // Contenedor donde se aloja el panel de party (integrado al panel derecho).
  getPartySlot(): HTMLElement;
  // Contenedor donde el juego monta el minimapa (sección inferior del panel).
  getMinimapSlot(): HTMLElement;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

function itemColor(item: number): string {
  const def = getItem(item);
  if (!def) return "#333";
  const hue = (def.id * 47) % 360;
  const l = def.type === "potion" ? 55 : def.type === "weapon" ? 40 : 35;
  return `hsl(${hue.toString()}, 55%, ${l.toString()}%)`;
}

const TYPE_LABEL: Record<string, string> = {
  weapon: "Arma", armor: "Armadura", helmet: "Casco", shield: "Escudo",
  arrow: "Munición", potion: "Poción", food: "Comida", drink: "Bebida", misc: "Objeto",
};

// Rango "a-b" o "a" si min==max; "" si ambos indefinidos.
function range(min: number | undefined, max: number | undefined): string {
  const lo = min ?? max ?? 0;
  const hi = max ?? min ?? 0;
  if (hi <= 0 && lo <= 0) return "";
  return lo === hi ? lo.toString() : `${lo.toString()}-${hi.toString()}`;
}

// Filas de stats de un item, para el tooltip de inspección (click).
function itemStatsRows(def: ReturnType<typeof getItem>): string {
  if (!def) return "";
  // Solo se muestra Ataque (armas) o Defensa (armaduras/cascos/escudos), y solo
  // si el item lo tiene. El resto de items no muestra ninguna fila, y NUNCA se
  // muestra el valor en oro ni el código del item.
  const rows: Array<[string, string]> = [];
  if (def.type === "weapon") {
    const dmg = range(def.minHit, def.maxHit);
    if (dmg) rows.push(["Ataque", dmg]);
  } else if (def.type === "armor" || def.type === "helmet" || def.type === "shield") {
    const d = range(def.defenseMin, def.defenseMax);
    if (d) rows.push(["Defensa", d]);
  }
  return rows.map(([k, v]) => `<div class="ao-inv__d-row"><span>${k}</span><b>${v}</b></div>`).join("");
}

// HTML del detalle de un item (nombre + tipo + stats), para el panel estático.
function itemDetailHtml(def: ReturnType<typeof getItem>): string {
  if (!def) return "";
  return (
    `<div class="ao-inv__d-name">${def.name}</div>` +
    `<div class="ao-inv__d-type">${TYPE_LABEL[def.type] ?? def.type}</div>` +
    `<div class="ao-inv__d-rows">${itemStatsRows(def)}</div>`
  );
}

export function mountInventory(
  parent: HTMLElement,
  cb: InventoryCallbacks,
): InventoryHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-inv ao-inv--open";

  // Detalle de item ESTÁTICO: al hacer click en un objeto, sus funciones se
  // muestran en un área fija del panel (nunca como popup ni con el código).
  const detailHintHtml = `<span class="ao-inv__detail-hint">Click en un objeto para ver sus detalles</span>`;
  function showDetail(itemId: number): void {
    const el = wrap.querySelector<HTMLDivElement>(".ao-inv__detail");
    const def = getItem(itemId);
    if (!el) return;
    el.innerHTML = def ? itemDetailHtml(def) : detailHintHtml;
  }
  // Orden del cliente AO clásico (referencia del usuario): nombre + nivel →
  // barra de XP → pestañas → inventario/conjuros → barras HP/MP/HAM/SED con
  // oro → drogas activas → minimapa con zona y coordenadas.
  // Estructura del cliente moderno (referencia "Arte 1" del usuario):
  // badge de nivel + nombre → tabs → grilla → FUE/AGI → retrato+ubicación →
  // SALUD/MANÁ con números → energía/hambre/sed → oro → party → acciones.
  // Diseño "Arte 3": panel en 3 recuadros con esquinas curvas.
  //  Box 1 = identidad (badge nivel + nombre + config + experiencia)
  //  Box 2 = inventario/hechizos + botón Lanzar amarillo
  //  Box 3 = vitales (vida/maná + minimapa + party/clanes + oro/def/daño + drogas)
  wrap.innerHTML = `
    <div class="ao-box ao-box--id">
      <div class="ao-id__row">
        <div class="ao-panel__lvlbadge"><b class="ao-panel__level">1</b><small>NIVEL</small></div>
        <div class="ao-id__col">
          <span class="ao-panel__tag">PERSONAJE</span>
          <span class="ao-panel__name">—</span>
        </div>
        <button type="button" class="ao-id__cfg" data-role="cfg" title="Configuración" aria-label="Configuración">⚙</button>
      </div>
      <div class="ao-id__xprow"><span class="ao-id__xplbl">EXPERIENCIA</span><span class="ao-id__xppct">—</span></div>
      <div class="ao-bar ao-bar--xp"><i></i></div>
      <div class="ao-id__menu" hidden>
        <button type="button" data-role="keys">⚙ Configurar teclas</button>
        <button type="button" data-role="stats">📊 Estadísticas</button>
        <button type="button" data-role="quests">📜 Misiones</button>
        <button type="button" data-role="changechar">↺ Cambiar personaje</button>
      </div>
    </div>

    <div class="ao-box ao-box--items">
      <div class="ao-panel__buttons">
        <button type="button" class="ao-panel__tabbtn ao-panel__tabbtn--active" data-tab="inv">Inventario</button>
        <button type="button" class="ao-panel__tabbtn" data-tab="spells">Hechizos</button>
      </div>
      <div class="ao-panel__tab" data-tabpane="inv">
        <div class="ao-inv__grid" role="grid"></div>
        <div class="ao-inv__detail" data-role="detail"><span class="ao-inv__detail-hint">Click en un objeto para ver sus detalles</span></div>
        <div class="ao-inv__trash" data-role="trash">Arrastrá acá para tirar al suelo</div>
      </div>
      <div class="ao-panel__tab" data-tabpane="spells" hidden>
        <div class="ao-spells__list"></div>
      </div>
      <button type="button" class="ao-spells__cast">Lanzar</button>
    </div>

    <div class="ao-box ao-box--vitals">
      <div class="ao-panel__zone">—</div>
      <div class="ao-vitals__main">
        <div class="ao-vitals__bars">
          <div class="ao-bar ao-bar--hp ao-bar--big"><i></i><span>VIDA</span></div>
          <div class="ao-bar ao-bar--mp ao-bar--big"><i></i><span>MANÁ</span></div>
        </div>
        <div class="ao-vitals__map">
          <div class="ao-panel__minimap-slot" title="Click: ver mapa del mundo"></div>
          <button type="button" class="ao-vitals__mapbtn" data-role="worldmap">🗺 Ver mapa</button>
        </div>
      </div>
      <div class="ao-vitals__pbtns">
        <button type="button" class="ao-vitals__pbtn" data-role="party">👥 Party</button>
        <button type="button" class="ao-vitals__pbtn" data-role="clanes">🛡 Clanes</button>
      </div>
      <div class="ao-panel__party-slot"></div>
      <div class="ao-vitals__stats">
        <span class="ao-stat" title="Oro">🪙 <b class="ao-inv__gold">0</b></span>
        <span class="ao-stat" title="Defensa"><span class="ao-stat__ic">🛡</span> <b class="ao-stat__def">0</b></span>
        <span class="ao-stat" title="Daño"><span class="ao-stat__ic">⚔</span> <b class="ao-stat__dmg">0/0</b></span>
      </div>
      <div class="ao-vitals__drugs">
        <span class="ao-drug ao-drug--str" title="Fuerza (poción verde)" hidden>💪 <b>+0</b> <em>0s</em></span>
        <span class="ao-drug ao-drug--agi" title="Agilidad (poción amarilla)" hidden>🏃 <b>+0</b> <em>0s</em></span>
      </div>
    </div>
  `;
  parent.appendChild(wrap);

  const nameEl = wrap.querySelector<HTMLSpanElement>(".ao-panel__name")!;
  const levelEl = wrap.querySelector<HTMLElement>(".ao-panel__level")!;
  const goldEl = wrap.querySelector<HTMLElement>(".ao-inv__gold")!;
  const minimapSlot = wrap.querySelector<HTMLDivElement>(".ao-panel__minimap-slot")!;
  const gridEl = wrap.querySelector<HTMLDivElement>(".ao-inv__grid")!;
  // Click simple = ver detalle; doble-click = usar (poteo). Se detecta por
  // ÍNDICE DE SLOT + tiempo (no por el nodo DOM) con delegación en gridEl —que
  // persiste—, así el doble-click sobrevive al `replaceChildren` que dispara
  // cada InventoryUpdate. Antes, al usar 1 poción el re-render reemplazaba la
  // celda y el `dblclick` nativo se cortaba ("tomaba solo 1").
  let lastClickSlot = -1;
  let lastClickAt = 0;
  gridEl.addEventListener("click", (ev) => {
    const cellEl = (ev.target as HTMLElement).closest<HTMLElement>(".ao-inv__cell");
    if (!cellEl?.dataset.slot) return;
    const idx = Number(cellEl.dataset.slot);
    const slot = idx >= 0 && idx < last.slots.length ? last.slots[idx] : null;
    if (!slot) return;
    const def = getItem(slot.item);
    if (!def) return;
    const now = Date.now();
    if (idx === lastClickSlot && now - lastClickAt < 400) {
      lastClickSlot = -1;
      lastClickAt = 0;
      cb.onUse(def.id);
    } else {
      lastClickSlot = idx;
      lastClickAt = now;
      showDetail(def.id);
      cb.onSelectItem?.(def.id);
    }
  });

  const trashEl = wrap.querySelector<HTMLDivElement>(".ao-inv__trash")!;
  const spellsEl = wrap.querySelector<HTMLDivElement>(".ao-spells__list")!;

  // Hechizos: click simple = seleccionar + armar casteo; DOBLE-click = agregar
  // el hechizo a la barra de macros (primer slot libre), con la tecla que el
  // usuario podrá reasignar. Delegación por spellId + tiempo (sobrevive al
  // replaceChildren de renderSpells), igual que la grilla de items.
  let lastClickSpell = -1;
  let lastClickSpellAt = 0;
  spellsEl.addEventListener("click", (ev) => {
    const row = (ev.target as HTMLElement).closest<HTMLElement>(".ao-spells__row");
    if (!row?.dataset.spellId) return;
    const id = Number(row.dataset.spellId);
    const now = Date.now();
    if (id === lastClickSpell && now - lastClickSpellAt < 400) {
      lastClickSpell = -1;
      lastClickSpellAt = 0;
      cb.onAddSpellMacro?.(id);
    } else {
      lastClickSpell = id;
      lastClickSpellAt = now;
      selectedSpell = id;
      renderSpells();
      cb.onSelectSpell(id);
    }
  });
  const zoneEl = wrap.querySelector<HTMLDivElement>(".ao-panel__zone")!;
  const xpFill = wrap.querySelector<HTMLElement>(".ao-bar--xp i")!;
  const xpPctEl = wrap.querySelector<HTMLElement>(".ao-id__xppct")!;
  const defEl = wrap.querySelector<HTMLElement>(".ao-stat__def")!;
  const dmgEl = wrap.querySelector<HTMLElement>(".ao-stat__dmg")!;
  const drugStrEl = wrap.querySelector<HTMLElement>(".ao-drug--str")!;
  const drugAgiEl = wrap.querySelector<HTMLElement>(".ao-drug--agi")!;

  const bar = (cls: string): { fill: HTMLElement; label: HTMLElement } => {
    const root = wrap.querySelector<HTMLDivElement>(`.ao-bar--${cls}`)!;
    return { fill: root.querySelector("i")!, label: root.querySelector("span")! };
  };
  const bars = { hp: bar("hp"), mp: bar("mp") };

  let open = true;
  let last: InventoryData = { gold: 0, slots: [], equippedWeapon: null, equippedArmor: null, equippedHelmet: null, equippedShield: null };
  let stats: PanelStats | null = null;
  let spellIds: ReadonlyArray<number> = [];
  let selectedSpell: number | null = null;
  let draggingFrom: number | null = null;

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabBtns = [...wrap.querySelectorAll<HTMLButtonElement>(".ao-panel__tabbtn")];
  const tabPanes = [...wrap.querySelectorAll<HTMLDivElement>(".ao-panel__tab")];
  for (const btn of tabBtns) {
    btn.addEventListener("click", () => {
      for (const b of tabBtns) b.classList.toggle("ao-panel__tabbtn--active", b === btn);
      for (const pane of tabPanes) pane.hidden = pane.dataset.tabpane !== btn.dataset.tab;
    });
  }
  // Engranaje de configuración: despliega un menú con teclas/stats/misiones/cambiar.
  const cfgMenu = wrap.querySelector<HTMLDivElement>(".ao-id__menu")!;
  wrap.querySelector<HTMLButtonElement>('[data-role="cfg"]')!.addEventListener("click", (e) => {
    e.stopPropagation();
    cfgMenu.hidden = !cfgMenu.hidden;
  });
  // Cierra el menú de config al clickear afuera. Handler nombrado para poder
  // removerlo en destroy() — si no, queda colgado en `document` reteniendo el
  // subárbol del inventario en cada remonte de sesión (leak acumulativo).
  const onDocClick = (e: MouseEvent): void => {
    if (!cfgMenu.hidden && !wrap.querySelector(".ao-box--id")!.contains(e.target as Node)) cfgMenu.hidden = true;
  };
  document.addEventListener("click", onDocClick);
  const menuAction = (role: string, fn: () => void): void => {
    wrap.querySelector<HTMLButtonElement>(`.ao-id__menu [data-role="${role}"]`)!.addEventListener("click", () => {
      cfgMenu.hidden = true;
      fn();
    });
  };
  menuAction("keys", () => cb.onOpenKeys());
  menuAction("stats", () => cb.onOpenStats());
  menuAction("quests", () => cb.onOpenQuests());
  menuAction("changechar", () => cb.onChangeCharacter());

  // Botones Party / Clanes y minimapa (click abre el mapa-mundi).
  wrap.querySelector<HTMLButtonElement>('[data-role="party"]')!.addEventListener("click", () => cb.onOpenParty());
  wrap.querySelector<HTMLButtonElement>('[data-role="clanes"]')!.addEventListener("click", () => cb.onOpenClanes());
  minimapSlot.addEventListener("click", () => cb.onOpenWorldMap());
  wrap.querySelector<HTMLButtonElement>('[data-role="worldmap"]')!.addEventListener("click", () => cb.onOpenWorldMap());

  // «Lanzar»: arma el modo casteo. Si no elegiste ninguno, toma el primero
  // de la lista (para una sola magia, apretar Lanzar siempre la arma).
  wrap.querySelector<HTMLButtonElement>(".ao-spells__cast")!.addEventListener("click", () => {
    if (selectedSpell === null && spellIds.length > 0) {
      selectedSpell = spellIds[0]!;
      renderSpells();
    }
    if (selectedSpell !== null) cb.onSelectSpell(selectedSpell);
  });

  // ── Barras y buffs ───────────────────────────────────────────────────────
  function setBar(b: { fill: HTMLElement; label: HTMLElement }, val: number, max: number, text: string): void {
    const frac = max > 0 ? Math.max(0, Math.min(1, val / max)) : 0;
    b.fill.style.width = `${(frac * 100).toFixed(1)}%`;
    b.label.textContent = text;
  }

  let buffTimer: ReturnType<typeof setInterval> | null = null;

  function renderStats(): void {
    if (!stats) return;
    nameEl.textContent = stats.name;
    levelEl.textContent = stats.level.toString();
    setBar(bars.hp, stats.hp, stats.maxHp, `VIDA ${stats.hp.toString()}/${stats.maxHp.toString()}`);
    if (stats.maxMana > 0) {
      bars.mp.fill.parentElement!.style.display = "";
      setBar(bars.mp, stats.mana, stats.maxMana, `MANÁ ${stats.mana.toString()}/${stats.maxMana.toString()}`);
    } else {
      bars.mp.fill.parentElement!.style.display = "none";
    }
    // Experiencia: barra + "32% (3.572.131 / 11.328.807)".
    const pct = stats.xpForNext > 0 ? Math.floor((stats.xpInto / stats.xpForNext) * 100) : 100;
    xpFill.style.width = `${(stats.xpForNext > 0 ? Math.min(100, (stats.xpInto / stats.xpForNext) * 100) : 100).toFixed(1)}%`;
    xpPctEl.textContent = `${pct.toString()}% (${stats.xpInto.toLocaleString("es")} / ${stats.xpForNext.toLocaleString("es")})`;
    renderDrugs();
  }

  // Drogas activas (poción verde = Fuerza · amarilla = Agilidad) con timer.
  function renderDrugs(): void {
    if (!stats) return;
    const now = Date.now();
    const secs = Math.max(0, Math.ceil((stats.buffExpiresAt - now) / 1000));
    const showStr = stats.buffExpiresAt > now && stats.strBonus > 0;
    const showAgi = stats.buffExpiresAt > now && stats.agiBonus > 0;
    drugStrEl.hidden = !showStr;
    drugAgiEl.hidden = !showAgi;
    if (showStr) drugStrEl.innerHTML = `💪 <b>+${stats.strBonus.toString()}</b> <em>${secs.toString()}s</em>`;
    if (showAgi) drugAgiEl.innerHTML = `🏃 <b>+${stats.agiBonus.toString()}</b> <em>${secs.toString()}s</em>`;
    if ((showStr || showAgi) && !buffTimer) {
      buffTimer = setInterval(renderDrugs, 1000);
    } else if (!showStr && !showAgi && buffTimer) {
      clearInterval(buffTimer);
      buffTimer = null;
    }
  }

  // ── Hechizos ─────────────────────────────────────────────────────────────
  function renderSpells(): void {
    spellsEl.replaceChildren();
    if (spellIds.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ao-spells__empty";
      empty.textContent = "Tu clase no usa magia.";
      spellsEl.appendChild(empty);
      return;
    }
    for (const id of spellIds) {
      const spell = getAoSpell(id);
      if (!spell) continue;
      const row = document.createElement("div");
      row.className = "ao-spells__row";
      row.dataset.spellId = id.toString();
      if (selectedSpell === id) row.classList.add("ao-spells__row--selected");
      row.draggable = true;
      row.title = `«${spell.magicWords}» — maná ${spell.manaCost.toString()} · doble-click: agregar a macros`;
      row.innerHTML = `
        <span class="ao-spells__name">${spell.name}</span>
        <span class="ao-spells__mana">${spell.manaCost.toString()} MP</span>
      `;
      // Click/doble-click se manejan por delegación en spellsEl (ver arriba):
      // simple = seleccionar+armar casteo; doble = agregar a la barra de macros.
      row.addEventListener("dragstart", (ev) => {
        ev.dataTransfer?.setData("text/plain", `spell:${id.toString()}`);
      });
      spellsEl.appendChild(row);
    }
  }

  // ── Inventario (grilla) ──────────────────────────────────────────────────
  function isEquipped(item: number): boolean {
    return (
      last.equippedWeapon === item ||
      last.equippedArmor === item ||
      last.equippedHelmet === item ||
      last.equippedShield === item
    );
  }

  // Info de Defensa y Daño (arte 3): defensa total (armadura+casco+escudo) y
  // daño del arma equipada (min/max hit).
  function renderDefDmg(): void {
    const defOf = (id: number | null | undefined): number =>
      id !== null && id !== undefined ? getItem(id)?.defense ?? 0 : 0;
    const totalDef = defOf(last.equippedArmor) + defOf(last.equippedHelmet) + defOf(last.equippedShield);
    defEl.textContent = totalDef.toString();
    const w = last.equippedWeapon !== null ? getItem(last.equippedWeapon) : undefined;
    dmgEl.textContent =
      w && w.type === "weapon"
        ? `${(w.minHit ?? 0).toString()}/${(w.maxHit ?? 0).toString()}`
        : "0/0";
  }

  function render(): void {
    goldEl.textContent = last.gold.toLocaleString("es");
    renderDefDmg();
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

          // click/doble-click se manejan por delegación en gridEl (ver arriba).
          cell.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            cb.onSell(def.id);
          });
          cell.addEventListener("dragstart", (ev) => {
            draggingFrom = i;
            cell.classList.add("ao-inv__cell--dragging");
            // "item:ID" para que la barra de macros lo acepte; el reorden
            // interno usa draggingFrom.
            ev.dataTransfer?.setData("text/plain", `item:${def.id.toString()}`);
            if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
          });
          cell.addEventListener("dragend", () => {
            draggingFrom = null;
            cell.classList.remove("ao-inv__cell--dragging");
          });
        }
      }

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
        cb.onReorder(draggingFrom, i);
      });

      gridEl.appendChild(cell);
    }
  }

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
    // Actualiza solo oro + slots, preservando el equipo conocido. Lo usa el
    // banco (su paquete no trae el equipo) para no borrar el resaltado de
    // equipados ni mostrar Def/Daño 0 hasta el próximo InventoryUpdate.
    setSlots: (gold, slots) => {
      last = { ...last, gold, slots };
      render();
    },
    setStats: (s) => {
      stats = s;
      renderStats();
    },
    setSpells: (ids) => {
      spellIds = ids;
      if (selectedSpell !== null && !ids.includes(selectedSpell)) {
        selectedSpell = null;
        cb.onSelectSpell(null);
      }
      renderSpells();
    },
    clearSpellSelection: () => {
      if (selectedSpell !== null) {
        selectedSpell = null;
        renderSpells();
      }
    },
    setLocation: (text) => {
      zoneEl.textContent = text;
    },
    getPartySlot: () => wrap.querySelector<HTMLDivElement>(".ao-panel__party-slot")!,
    getMinimapSlot: () => minimapSlot,
    toggle: () => {
      setOpen(!open);
    },
    isOpen: () => open,
    destroy: () => {
      if (buffTimer) clearInterval(buffTimer);
      document.removeEventListener("click", onDocClick);
      wrap.remove();
    },
  };
}
