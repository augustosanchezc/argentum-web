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
  // Solo el número de conectados — sin lista de nombres.
  wrap.innerHTML = `<div class="ao-players__title">En línea: <span class="ao-players__count">0</span></div>`;
  parent.appendChild(wrap);

  const countEl = wrap.querySelector<HTMLSpanElement>(".ao-players__count")!;

  function setPlayers(names: string[]): void {
    countEl.textContent = names.length.toString();
  }

  return {
    setPlayers,
    destroy: () => {
      wrap.remove();
    },
  };
}
