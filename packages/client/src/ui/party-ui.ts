import type { PartyMemberData } from "@ao/shared";

// Panel de party (E-4.3).

export interface PartyUiCallbacks {
  onAcceptInvite(): void;
  onDeclineInvite(): void;
  onLeave(): void;
}

export interface PartyUiHandle {
  showInvite(inviterName: string): void;
  hideInvite(): void;
  updateParty(members: ReadonlyArray<PartyMemberData>): void;
  clearParty(): void;
  isInParty(): boolean;
  destroy(): void;
}

export function mountPartyUi(parent: HTMLElement, cb: PartyUiCallbacks): PartyUiHandle {
  // Panel de party (esquina superior derecha).
  const panel = document.createElement("div");
  panel.className = "ao-party";
  panel.innerHTML = `
    <div class="ao-party__header">
      <span class="ao-party__title">Party</span>
      <button class="ao-party__leave" aria-label="Salir de party">Salir</button>
    </div>
    <ul class="ao-party__list"></ul>
  `;
  parent.appendChild(panel);

  // Notificación de invitación.
  const inviteToast = document.createElement("div");
  inviteToast.className = "ao-party-invite";
  inviteToast.innerHTML = `
    <span class="ao-party-invite__text"></span>
    <button class="ao-party-invite__accept">Aceptar</button>
    <button class="ao-party-invite__decline">Rechazar</button>
  `;
  parent.appendChild(inviteToast);

  const listEl = panel.querySelector<HTMLUListElement>(".ao-party__list")!;
  const leaveBtn = panel.querySelector<HTMLButtonElement>(".ao-party__leave")!;
  const inviteText = inviteToast.querySelector<HTMLElement>(".ao-party-invite__text")!;
  const acceptBtn = inviteToast.querySelector<HTMLButtonElement>(".ao-party-invite__accept")!;
  const declineBtn = inviteToast.querySelector<HTMLButtonElement>(".ao-party-invite__decline")!;

  let inParty = false;

  leaveBtn.addEventListener("click", () => cb.onLeave());
  acceptBtn.addEventListener("click", () => {
    inviteToast.classList.remove("ao-party-invite--visible");
    cb.onAcceptInvite();
  });
  declineBtn.addEventListener("click", () => {
    inviteToast.classList.remove("ao-party-invite--visible");
    cb.onDeclineInvite();
  });

  return {
    showInvite: (inviterName) => {
      inviteText.textContent = `${inviterName} te invita a una party`;
      inviteToast.classList.add("ao-party-invite--visible");
    },
    hideInvite: () => {
      inviteToast.classList.remove("ao-party-invite--visible");
    },
    updateParty: (members) => {
      inParty = members.length > 0;
      panel.classList.toggle("ao-party--visible", inParty);
      listEl.replaceChildren();
      for (const m of members) {
        const li = document.createElement("li");
        li.className = "ao-party__member";
        const frac = m.maxHp > 0 ? Math.max(0, Math.min(1, m.hp / m.maxHp)) : 0;
        const pct = Math.round(frac * 100);
        const color = frac > 0.5 ? "#4cb87e" : frac > 0.25 ? "#e0863a" : "#c93838";
        li.innerHTML = `
          <span class="ao-party__name">${m.name}</span>
          <div class="ao-party__hpbar-bg">
            <div class="ao-party__hpbar-fg" style="width:${pct.toString()}%;background:${color}"></div>
          </div>
          <span class="ao-party__hp">${m.hp.toString()}/${m.maxHp.toString()}</span>
        `;
        listEl.appendChild(li);
      }
    },
    clearParty: () => {
      inParty = false;
      panel.classList.remove("ao-party--visible");
      listEl.replaceChildren();
    },
    isInParty: () => inParty,
    destroy: () => {
      panel.remove();
      inviteToast.remove();
    },
  };
}
