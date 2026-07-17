// Misiones (Quests.DAT): diálogo de oferta del NPC + registro de misiones
// activas con progreso y abandono.

import { getItem, QUESTS, type ActiveQuest } from "@ao/shared";

export interface QuestCallbacks {
  onAccept(questId: number): void;
  onAbandon(questId: number): void;
}

export interface QuestsHandle {
  showOffer(questId: number): void;
  setState(active: ReadonlyArray<ActiveQuest>, done: ReadonlyArray<number>): void;
  toggleLog(): void;
  destroy(): void;
}

export function mountQuests(parent: HTMLElement, cb: QuestCallbacks): QuestsHandle {
  // ── Diálogo de oferta ──
  const offer = document.createElement("div");
  offer.className = "ao-questoffer";
  offer.innerHTML = `
    <div class="ao-questoffer__box">
      <div class="ao-questoffer__title"></div>
      <div class="ao-questoffer__desc"></div>
      <div class="ao-questoffer__req"></div>
      <div class="ao-questoffer__rewards"></div>
      <div class="ao-questoffer__buttons">
        <button type="button" class="ao-questoffer__accept">Aceptar misión</button>
        <button type="button" class="ao-questoffer__reject">Rechazar</button>
      </div>
    </div>
  `;
  parent.appendChild(offer);

  let offeredId = 0;
  offer.querySelector(".ao-questoffer__accept")!.addEventListener("click", () => {
    if (offeredId > 0) cb.onAccept(offeredId);
    offer.classList.remove("ao-questoffer--open");
  });
  offer.querySelector(".ao-questoffer__reject")!.addEventListener("click", () => {
    offer.classList.remove("ao-questoffer--open");
  });

  // ── Registro de misiones ──
  const log = document.createElement("div");
  log.className = "ao-questlog";
  log.innerHTML = `
    <div class="ao-questlog__title">Misiones
      <button type="button" class="ao-questlog__close">✕</button>
    </div>
    <div class="ao-questlog__list"></div>
  `;
  parent.appendChild(log);
  log.querySelector(".ao-questlog__close")!.addEventListener("click", () => {
    log.classList.remove("ao-questlog--open");
  });

  const listEl = log.querySelector<HTMLDivElement>(".ao-questlog__list")!;
  let lastActive: ReadonlyArray<ActiveQuest> = [];
  let lastDone: ReadonlyArray<number> = [];

  function renderLog(): void {
    listEl.replaceChildren();
    if (lastActive.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ao-questlog__empty";
      empty.textContent = `Sin misiones activas. Completadas: ${lastDone.length.toString()}. Buscá NPCs con [Quest] en las ciudades.`;
      listEl.appendChild(empty);
      return;
    }
    for (const aq of lastActive) {
      const def = QUESTS[aq.id];
      if (!def) continue;
      const row = document.createElement("div");
      row.className = "ao-questlog__quest";
      const kills = def.npcs
        .map((req, i) => `☠ ${(aq.kills[i] ?? 0).toString()}/${req.amount.toString()}`)
        .join(" · ");
      const objs = def.objs
        .map((req) => `📦 ${getItem(req.item)?.name ?? `#${req.item.toString()}`} ×${req.amount.toString()}`)
        .join(" · ");
      row.innerHTML = `
        <div class="ao-questlog__qname">${def.nombre}</div>
        <div class="ao-questlog__qprog">${[kills, objs].filter(Boolean).join(" · ")}</div>
        <button type="button" class="ao-questlog__abandon">Abandonar</button>
      `;
      row.querySelector(".ao-questlog__abandon")!.addEventListener("click", () => {
        cb.onAbandon(aq.id);
      });
      listEl.appendChild(row);
    }
  }

  return {
    showOffer: (questId) => {
      const def = QUESTS[questId];
      if (!def) return;
      offeredId = questId;
      offer.querySelector(".ao-questoffer__title")!.textContent = `📜 ${def.nombre}`;
      offer.querySelector(".ao-questoffer__desc")!.textContent = def.desc;
      const reqs: string[] = [];
      if (def.requiredLevel > 1) reqs.push(`Nivel ${def.requiredLevel.toString()}+`);
      for (const r of def.npcs) reqs.push(`Matar ${r.amount.toString()} criaturas`);
      for (const r of def.objs) reqs.push(`Entregar ${getItem(r.item)?.name ?? "?"} ×${r.amount.toString()}`);
      offer.querySelector(".ao-questoffer__req")!.textContent = `Requisitos: ${reqs.join(" · ")}`;
      const rewards: string[] = [];
      if (def.rewardGld > 0) rewards.push(`${def.rewardGld.toString()} oro`);
      if (def.rewardExp > 0) rewards.push(`${def.rewardExp.toString()} XP`);
      for (const r of def.rewardObjs) rewards.push(`${getItem(r.item)?.name ?? "?"} ×${r.amount.toString()}`);
      offer.querySelector(".ao-questoffer__rewards")!.textContent = `Recompensa: ${rewards.join(" · ")}`;
      offer.classList.add("ao-questoffer--open");
    },
    setState: (active, done) => {
      lastActive = active;
      lastDone = done;
      if (log.classList.contains("ao-questlog--open")) renderLog();
    },
    toggleLog: () => {
      const opening = !log.classList.contains("ao-questlog--open");
      log.classList.toggle("ao-questlog--open", opening);
      if (opening) renderLog();
    },
    destroy: () => {
      offer.remove();
      log.remove();
    },
  };
}
