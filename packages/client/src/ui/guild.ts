import { getClass, type GuildInfoResponse, type GuildListResponse } from "@ao/shared";

// Popup de clanes. Dos modos según membresía (el server rutea con un solo pedido):
//  · Directorio (GuildListResponse): NO estás en un clan → lista de todos los
//    clanes con info general + botón "Solicitar unirse".
//  · Mi clan (GuildInfoResponse): estás en un clan → miembros online ordenados
//    por nivel, descripción y reglas; líder/oficiales gestionan solicitudes;
//    el líder otorga/quita rango y edita descripción/reglas.

export interface GuildUiCallbacks {
  onSaveText(description: string, rules: string): void;
  onRequestJoin(guildId: number): void;
  onAcceptRequest(characterId: number): void;
  onRejectRequest(characterId: number): void;
  onSetRank(characterId: number, rank: number): void;
}

export interface GuildUiHandle {
  showInfo(info: GuildInfoResponse): void;
  showDirectory(list: GuildListResponse): void;
  open(): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

const FACTION_LABEL: Record<number, string> = { 0: "Ciudadanos", 1: "Criminales" };
const factionClass = (f: number): string => (f === 1 ? "ao-guild__faction--crim" : "ao-guild__faction--ciu");
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

export function mountGuildUi(parent: HTMLElement, cb: GuildUiCallbacks): GuildUiHandle {
  const panel = document.createElement("div");
  panel.className = "ao-guild";
  panel.innerHTML = `
    <div class="ao-guild__box">
      <div class="ao-guild__header">
        <span class="ao-guild__htitle"></span>
        <button class="ao-guild__close" aria-label="Cerrar">✕</button>
      </div>
      <div class="ao-guild__view ao-guild__view--dir"></div>
      <div class="ao-guild__view ao-guild__view--clan"></div>
    </div>
  `;
  parent.appendChild(panel);

  const titleEl = panel.querySelector<HTMLElement>(".ao-guild__htitle")!;
  const dirEl = panel.querySelector<HTMLElement>(".ao-guild__view--dir")!;
  const clanEl = panel.querySelector<HTMLElement>(".ao-guild__view--clan")!;
  panel.querySelector<HTMLButtonElement>(".ao-guild__close")!
    .addEventListener("click", () => panel.classList.remove("ao-guild--open"));

  // ── Directorio ───────────────────────────────────────────────────────────
  function renderDirectory(list: GuildListResponse): void {
    titleEl.textContent = "Clanes disponibles";
    dirEl.style.display = "";
    clanEl.style.display = "none";
    if (list.guilds.length === 0) {
      dirEl.innerHTML = `<p class="ao-guild__empty">Todavía no hay clanes fundados.</p>`;
      return;
    }
    dirEl.innerHTML = `<ul class="ao-guild__dirlist"></ul>`;
    const ul = dirEl.querySelector<HTMLUListElement>(".ao-guild__dirlist")!;
    for (const g of list.guilds) {
      const li = document.createElement("li");
      li.className = "ao-guild__dircard";
      const full = g.memberCount >= g.maxMembers;
      const btn = g.requested
        ? `<button class="ao-guild__reqbtn" disabled>Solicitado</button>`
        : g.canJoin
          ? `<button class="ao-guild__reqbtn" data-id="${g.id.toString()}">Solicitar unirse</button>`
          : `<button class="ao-guild__reqbtn" disabled>${full ? "Lleno" : "Otra facción"}</button>`;
      li.innerHTML = `
        <div class="ao-guild__dirhead">
          <span class="ao-guild__name">${esc(g.name)}</span>
          <span class="ao-guild__faction ${factionClass(g.faction)}">${FACTION_LABEL[g.faction] ?? ""}</span>
          <span class="ao-guild__dircount">${g.memberCount.toString()}/${g.maxMembers.toString()}</span>
        </div>
        <div class="ao-guild__dirmeta">Líder: ${esc(g.leaderName)}</div>
        <p class="ao-guild__dirdesc">${esc(g.description) || "<span class='ao-guild__muted'>Sin descripción</span>"}</p>
        <div class="ao-guild__diractions">${btn}</div>
      `;
      const b = li.querySelector<HTMLButtonElement>(".ao-guild__reqbtn[data-id]");
      if (b) b.addEventListener("click", () => { cb.onRequestJoin(g.id); b.disabled = true; b.textContent = "Solicitado"; });
      ul.appendChild(li);
    }
  }

  // ── Mi clan ───────────────────────────────────────────────────────────────
  function renderClan(info: GuildInfoResponse): void {
    titleEl.textContent = "Mi Clan";
    dirEl.style.display = "none";
    clanEl.style.display = "";

    // Miembros: online primero, ordenados por nivel desc.
    const members = [...info.members].sort((a, b) =>
      (a.online === b.online ? 0 : a.online ? -1 : 1) || b.level - a.level);
    const memberRows = members.map((m) => {
      const cls = getClass(m.classId)?.name ?? "";
      const tag = m.leader ? "👑" : m.rank >= 1 ? "⭐" : "";
      // Controles de rango (solo el líder, sobre miembros que no son él).
      const rankBtn = info.isLeader && !m.leader
        ? `<button class="ao-guild__rankbtn" data-id="${m.characterId.toString()}" data-rank="${m.rank >= 1 ? "0" : "1"}">${m.rank >= 1 ? "Quitar rango" : "Hacer oficial"}</button>`
        : "";
      return `<li class="ao-guild__member${m.online ? " ao-guild__member--online" : ""}">
        <span class="ao-guild__dot"></span>
        <span class="ao-guild__mname">${tag ? tag + " " : ""}${esc(m.name)}</span>
        <span class="ao-guild__mmeta">Nv ${m.level.toString()} · ${cls}</span>
        ${rankBtn}
      </li>`;
    }).join("");

    // Solicitudes pendientes (solo si puede gestionar).
    const requestsBlock = info.canManage
      ? `<div class="ao-guild__reqs">
           <h4 class="ao-guild__h">Solicitudes (${info.requests.length.toString()})</h4>
           <ul class="ao-guild__reqlist">${
             info.requests.length === 0
               ? `<li class="ao-guild__muted">Sin solicitudes pendientes.</li>`
               : info.requests.map((r) => {
                   const cls = getClass(r.classId)?.name ?? "";
                   return `<li class="ao-guild__reqitem">
                     <span class="ao-guild__mname">${esc(r.name)}</span>
                     <span class="ao-guild__mmeta">Nv ${r.level.toString()} · ${cls}</span>
                     <button class="ao-guild__acc" data-id="${r.characterId.toString()}">Aceptar</button>
                     <button class="ao-guild__rej" data-id="${r.characterId.toString()}">Rechazar</button>
                   </li>`;
                 }).join("")
           }</ul>
         </div>`
      : "";

    clanEl.innerHTML = `
      <div class="ao-guild__clanhead">
        <span class="ao-guild__name">${esc(info.name)}</span>
        <span class="ao-guild__faction ${factionClass(info.faction)}">${FACTION_LABEL[info.faction] ?? ""}</span>
        <span class="ao-guild__count">${info.members.length.toString()}/${info.maxMembers.toString()}</span>
      </div>
      <div class="ao-guild__body">
        <div class="ao-guild__col ao-guild__col--members">
          <h4 class="ao-guild__h">Miembros</h4>
          <ul class="ao-guild__members">${memberRows}</ul>
          ${requestsBlock}
        </div>
        <div class="ao-guild__col ao-guild__col--text">
          <h4 class="ao-guild__h">Descripción</h4>
          <p class="ao-guild__desc">${esc(info.description) || "—"}</p>
          <textarea class="ao-guild__desc-edit" maxlength="500" rows="3" placeholder="Descripción del clan">${esc(info.description)}</textarea>
          <h4 class="ao-guild__h">Reglas</h4>
          <p class="ao-guild__rules">${esc(info.rules) || "—"}</p>
          <textarea class="ao-guild__rules-edit" maxlength="1000" rows="5" placeholder="Reglas del clan">${esc(info.rules)}</textarea>
          <div class="ao-guild__actions">
            <button class="ao-guild__edit"${info.isLeader ? "" : " style=\"display:none\""}>Editar</button>
            <button class="ao-guild__save">Guardar</button>
            <button class="ao-guild__cancel">Cancelar</button>
          </div>
        </div>
      </div>
    `;

    // Wiring: edición de texto (líder).
    const descEdit = clanEl.querySelector<HTMLTextAreaElement>(".ao-guild__desc-edit")!;
    const rulesEdit = clanEl.querySelector<HTMLTextAreaElement>(".ao-guild__rules-edit")!;
    clanEl.querySelector<HTMLButtonElement>(".ao-guild__edit")!
      .addEventListener("click", () => clanEl.classList.add("ao-guild__view--editing"));
    clanEl.querySelector<HTMLButtonElement>(".ao-guild__cancel")!
      .addEventListener("click", () => {
        descEdit.value = info.description; rulesEdit.value = info.rules;
        clanEl.classList.remove("ao-guild__view--editing");
      });
    clanEl.querySelector<HTMLButtonElement>(".ao-guild__save")!
      .addEventListener("click", () => cb.onSaveText(descEdit.value.trim(), rulesEdit.value.trim()));

    // Wiring: solicitudes (aceptar/rechazar).
    clanEl.querySelectorAll<HTMLButtonElement>(".ao-guild__acc").forEach((b) =>
      b.addEventListener("click", () => cb.onAcceptRequest(Number(b.dataset.id))));
    clanEl.querySelectorAll<HTMLButtonElement>(".ao-guild__rej").forEach((b) =>
      b.addEventListener("click", () => cb.onRejectRequest(Number(b.dataset.id))));

    // Wiring: rangos (líder).
    clanEl.querySelectorAll<HTMLButtonElement>(".ao-guild__rankbtn").forEach((b) =>
      b.addEventListener("click", () => cb.onSetRank(Number(b.dataset.id), Number(b.dataset.rank))));
  }

  return {
    showInfo: (info) => { renderClan(info); panel.classList.add("ao-guild--open"); },
    showDirectory: (list) => { renderDirectory(list); panel.classList.add("ao-guild--open"); },
    open: () => panel.classList.add("ao-guild--open"),
    close: () => panel.classList.remove("ao-guild--open"),
    isOpen: () => panel.classList.contains("ao-guild--open"),
    destroy: () => panel.remove(),
  };
}
