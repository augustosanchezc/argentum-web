// Panel lateral con los jugadores conectados al mapa (T-047).
// Es puramente visual: el game scene le pasa la lista de nombres derivada
// de las entidades que conoce, y se actualiza al conectar/desconectar.

export interface PlayerListHandle {
  setPlayers(names: string[]): void;
  destroy(): void;
}

export function mountPlayerList(parent: HTMLElement): PlayerListHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-players";
  wrap.innerHTML = `
    <div class="ao-players__title">En línea (<span class="ao-players__count">0</span>)</div>
    <ul class="ao-players__list"></ul>
  `;
  parent.appendChild(wrap);

  const countEl = wrap.querySelector<HTMLSpanElement>(".ao-players__count")!;
  const listEl = wrap.querySelector<HTMLUListElement>(".ao-players__list")!;

  function setPlayers(names: string[]): void {
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    countEl.textContent = sorted.length.toString();
    listEl.replaceChildren(
      ...sorted.map((name) => {
        const li = document.createElement("li");
        li.className = "ao-players__item";
        li.textContent = name;
        return li;
      }),
    );
  }

  return {
    setPlayers,
    destroy: () => {
      wrap.remove();
    },
  };
}
