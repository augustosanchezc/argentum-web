import { getClass, type GuildInfoResponse } from "@ao/shared";

// Popup de clan: listado de miembros, descripción y reglas. El líder puede
// editar descripción y reglas. Se abre con la tecla de clan; muestra el clan
// del propio jugador (el server responde con GuildInfoResponse).

export interface GuildUiCallbacks {
  // El líder guarda descripción + reglas.
  onSaveText(description: string, rules: string): void;
}

export interface GuildUiHandle {
  update(info: GuildInfoResponse): void;
  open(): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

const FACTION_LABEL: Record<number, string> = { 0: "Ciudadanos", 1: "Criminales" };

export function mountGuildUi(parent: HTMLElement, cb: GuildUiCallbacks): GuildUiHandle {
  const panel = document.createElement("div");
  panel.className = "ao-guild";
  panel.innerHTML = `
    <div class="ao-guild__box">
      <div class="ao-guild__header">
        <div class="ao-guild__titles">
          <span class="ao-guild__name"></span>
          <span class="ao-guild__faction"></span>
        </div>
        <button class="ao-guild__close" aria-label="Cerrar">✕</button>
      </div>
      <div class="ao-guild__body">
        <div class="ao-guild__col ao-guild__col--members">
          <h4 class="ao-guild__h">Miembros <span class="ao-guild__count"></span></h4>
          <ul class="ao-guild__members"></ul>
        </div>
        <div class="ao-guild__col ao-guild__col--text">
          <h4 class="ao-guild__h">Descripción</h4>
          <p class="ao-guild__desc"></p>
          <textarea class="ao-guild__desc-edit" maxlength="500" rows="3" placeholder="Descripción del clan"></textarea>
          <h4 class="ao-guild__h">Reglas</h4>
          <p class="ao-guild__rules"></p>
          <textarea class="ao-guild__rules-edit" maxlength="1000" rows="5" placeholder="Reglas del clan"></textarea>
          <div class="ao-guild__actions">
            <button class="ao-guild__edit">Editar</button>
            <button class="ao-guild__save">Guardar</button>
            <button class="ao-guild__cancel">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  parent.appendChild(panel);

  const nameEl = panel.querySelector<HTMLElement>(".ao-guild__name")!;
  const factionEl = panel.querySelector<HTMLElement>(".ao-guild__faction")!;
  const countEl = panel.querySelector<HTMLElement>(".ao-guild__count")!;
  const membersEl = panel.querySelector<HTMLUListElement>(".ao-guild__members")!;
  const descEl = panel.querySelector<HTMLElement>(".ao-guild__desc")!;
  const rulesEl = panel.querySelector<HTMLElement>(".ao-guild__rules")!;
  const descEdit = panel.querySelector<HTMLTextAreaElement>(".ao-guild__desc-edit")!;
  const rulesEdit = panel.querySelector<HTMLTextAreaElement>(".ao-guild__rules-edit")!;
  const editBtn = panel.querySelector<HTMLButtonElement>(".ao-guild__edit")!;
  const saveBtn = panel.querySelector<HTMLButtonElement>(".ao-guild__save")!;
  const cancelBtn = panel.querySelector<HTMLButtonElement>(".ao-guild__cancel")!;
  const closeBtn = panel.querySelector<HTMLButtonElement>(".ao-guild__close")!;

  let isLeader = false;
  let editing = false;
  let last: GuildInfoResponse | null = null;

  function applyEditMode(): void {
    panel.classList.toggle("ao-guild--editing", editing);
    // El botón Editar solo aparece para el líder y fuera del modo edición.
    editBtn.style.display = isLeader && !editing ? "" : "none";
  }

  function render(info: GuildInfoResponse): void {
    last = info;
    isLeader = info.isLeader;
    nameEl.textContent = info.name;
    factionEl.textContent = FACTION_LABEL[info.faction] ?? "";
    factionEl.className = `ao-guild__faction ao-guild__faction--${info.faction === 1 ? "crim" : "ciu"}`;
    countEl.textContent = `${info.members.length.toString()}/${info.maxMembers.toString()}`;

    membersEl.replaceChildren();
    for (const m of info.members) {
      const li = document.createElement("li");
      li.className = `ao-guild__member${m.online ? " ao-guild__member--online" : ""}`;
      const cls = getClass(m.classId)?.name ?? "";
      li.innerHTML = `
        <span class="ao-guild__dot" title="${m.online ? "En línea" : "Desconectado"}"></span>
        <span class="ao-guild__mname">${m.leader ? "👑 " : ""}${m.name}</span>
        <span class="ao-guild__mmeta">Nv ${m.level.toString()} · ${cls}</span>
      `;
      membersEl.appendChild(li);
    }

    descEl.textContent = info.description || "—";
    rulesEl.textContent = info.rules || "—";
    descEdit.value = info.description;
    rulesEdit.value = info.rules;
    editing = false;
    applyEditMode();
  }

  editBtn.addEventListener("click", () => { editing = true; applyEditMode(); });
  cancelBtn.addEventListener("click", () => {
    if (last) { descEdit.value = last.description; rulesEdit.value = last.rules; }
    editing = false;
    applyEditMode();
  });
  saveBtn.addEventListener("click", () => {
    cb.onSaveText(descEdit.value.trim(), rulesEdit.value.trim());
    // El server responde con GuildInfoResponse → render() vuelve a modo vista.
  });
  closeBtn.addEventListener("click", () => { panel.classList.remove("ao-guild--open"); });

  return {
    update: (info) => {
      render(info);
      panel.classList.add("ao-guild--open");
    },
    open: () => { panel.classList.add("ao-guild--open"); },
    close: () => { panel.classList.remove("ao-guild--open"); },
    isOpen: () => panel.classList.contains("ao-guild--open"),
    destroy: () => { panel.remove(); },
  };
}
