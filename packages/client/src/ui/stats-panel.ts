import type { StatsUpdate } from "@ao/shared";

type StatKey = "str" | "agi" | "int" | "con" | "car";

const STAT_LABELS: Record<StatKey, string> = {
  str: "Fuerza",
  agi: "Agilidad",
  int: "Inteligencia",
  con: "Constitución",
  car: "Carisma",
};

export interface StatsPanelHandle {
  update(stats: StatsUpdate): void;
  destroy(): void;
}

export function mountStatsPanel(
  parent: HTMLElement,
  onAllocStat: (stat: StatKey) => void,
): StatsPanelHandle {
  const panel = document.createElement("div");
  panel.className = "ao-stats-panel";
  panel.innerHTML = `
    <div class="ao-stats-panel__title">Estadísticas</div>
    <div class="ao-stats-panel__rows" id="stats-rows"></div>
    <div class="ao-stats-panel__footer" id="stats-footer"></div>
  `;
  parent.appendChild(panel);

  function render(p: StatsUpdate): void {
    const rows = panel.querySelector<HTMLDivElement>("#stats-rows")!;
    const footer = panel.querySelector<HTMLDivElement>("#stats-footer")!;
    const hasPoints = (p.statPoints ?? 0) > 0;

    const statRows: StatKey[] = ["str", "agi", "int", "con", "car"];
    rows.innerHTML = statRows
      .map((s) => {
        const val = (p as unknown as Record<string, number>)[s] ?? 0;
        const btn = hasPoints
          ? `<button class="stat-alloc-btn" data-stat="${s}" title="Asignar punto">+</button>`
          : "";
        return `
          <div class="stat-row">
            <span class="stat-label">${STAT_LABELS[s]}</span>
            <span class="stat-value">${val.toString()}</span>
            ${btn}
          </div>`;
      })
      .join("");

    footer.innerHTML = `
      <div class="stat-row stat-row--hp">
        <span class="stat-label">HP</span>
        <span class="stat-value">${p.hp.toString()} / ${p.maxHp.toString()}</span>
      </div>
      ${
        (p.maxMana ?? 0) > 0
          ? `<div class="stat-row stat-row--mp">
               <span class="stat-label">MP</span>
               <span class="stat-value">${(p.mana ?? 0).toString()} / ${(p.maxMana ?? 0).toString()}</span>
             </div>`
          : ""
      }
      ${
        hasPoints
          ? `<div class="stat-row stat-row--points">
               <span class="stat-label" style="color:var(--gold-bright)">Puntos libres</span>
               <span class="stat-value" style="color:var(--gold-bright)">${(p.statPoints ?? 0).toString()}</span>
             </div>`
          : ""
      }
    `;

    rows.querySelectorAll<HTMLButtonElement>(".stat-alloc-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stat = btn.dataset.stat as StatKey | undefined;
        if (stat) onAllocStat(stat);
      });
    });
  }

  return {
    update: render,
    destroy: () => {
      panel.remove();
    },
  };
}
