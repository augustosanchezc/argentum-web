import {
  CLASSES,
  GENDERS,
  RACES,
  SKILL_NAMES,
  type SkillKey,
  type StatsUpdate,
} from "@ao/shared";

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

// Barra de progreso (HP/MP/energía/xp) con color propio.
function bar(cur: number, max: number, color: string): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return `<div class="ao-sp__bar"><div class="ao-sp__barfill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>`;
}

export function mountStatsPanel(
  parent: HTMLElement,
  onAllocStat: (stat: StatKey) => void,
): StatsPanelHandle {
  const panel = document.createElement("div");
  panel.className = "ao-stats-panel";
  parent.appendChild(panel);

  function render(p: StatsUpdate): void {
    const hasPoints = (p.statPoints ?? 0) > 0;
    const cls = CLASSES[p.classId]?.name ?? "—";
    const race = RACES[p.race]?.name ?? "—";
    const gen = GENDERS[p.gender as 1 | 2] ?? "";
    const maxLevel = 50;
    const atLevelCap = p.level >= maxLevel;

    // Vitales
    const vitals: string[] = [];
    vitals.push(vitalRow("Vida", p.hp, p.maxHp, "#e5484d", "#ff6b6f"));
    if ((p.maxMana ?? 0) > 0) vitals.push(vitalRow("Maná", p.mana, p.maxMana, "#2f6fd6", "#4f8ff0"));
    vitals.push(vitalRow("Energía", p.sta, p.maxSta, "#3f9a4f", "#5fd06f"));
    vitals.push(vitalRow("Hambre", p.hunger, 100, "#c98b2f", "#f0b45f"));
    vitals.push(vitalRow("Sed", p.thirst, 100, "#2f95c9", "#5fc0f0"));

    // Atributos con bonus temporal de drogas/hechizos
    const attrKeys: StatKey[] = ["str", "agi", "int", "con", "car"];
    const attrRows = attrKeys.map((s) => {
      const base = (p as unknown as Record<string, number>)[s] ?? 0;
      const bonus = s === "str" ? (p.strBonus ?? 0) : s === "agi" ? (p.agiBonus ?? 0) : 0;
      const buffed = bonus > 0;
      const shown = base + bonus; // TOTAL: atributo de origen + droga (poción)
      // La agilidad drogada se muestra como "Celeridad" (nombre AO del buff).
      const label = s === "agi" && buffed ? "Celeridad" : STAT_LABELS[s];
      const btn = hasPoints
        ? `<button class="ao-sp__alloc" data-stat="${s}" title="Asignar punto">+</button>`
        : "";
      return `
        <div class="ao-sp__row">
          <span class="ao-sp__k">${label}</span>
          <span class="ao-sp__v${buffed ? " ao-sp__v--buff" : ""}">${shown.toString()}</span>
          ${btn}
        </div>`;
    }).join("");

    // Skills por uso: sólo las practicadas, de mayor a menor.
    const skills = p.skills ?? {};
    const skillEntries = (Object.entries(skills) as Array<[SkillKey, number]>)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const skillsHtml = skillEntries.length === 0
      ? `<div class="ao-sp__row"><span class="ao-sp__k ao-sp__faint">Todavía sin práctica</span></div>`
      : skillEntries.map(([k, v]) => `
          <div class="ao-sp__row">
            <span class="ao-sp__k">${SKILL_NAMES[k] ?? k}</span>
            <span class="ao-sp__v">${v.toString()}</span>
          </div>`).join("");

    panel.innerHTML = `
      <div class="ao-sp__head">
        <button class="ao-sp__close" type="button" title="Cerrar">✕</button>
        <div class="ao-sp__title">Estadísticas</div>
        <div class="ao-sp__sub">${cls} · ${race} · ${gen}</div>
      </div>

      <div class="ao-sp__lvlrow">
        <span class="ao-sp__lvl">Nivel ${p.level.toString()}${atLevelCap ? " · MÁX" : ""}</span>
        <span class="ao-sp__gold">${p.gold.toLocaleString("es")} oro</span>
      </div>
      ${atLevelCap
        ? `<div class="ao-sp__xptxt">Experiencia máxima alcanzada</div>`
        : `${bar(p.xp, p.xpForNextLevel, "linear-gradient(90deg,#7a5fd0,#a78bfa)")}
           <div class="ao-sp__xptxt">${p.xp.toLocaleString("es")} / ${p.xpForNextLevel.toLocaleString("es")} exp</div>`}

      <div class="ao-sp__sectitle">Vitales</div>
      ${vitals.join("")}

      <div class="ao-sp__sectitle">Atributos${hasPoints ? ` <span class="ao-sp__pts">${(p.statPoints ?? 0).toString()} pts libres</span>` : ""}</div>
      ${attrRows}

      <div class="ao-sp__sectitle">Habilidades <small>(suben con el uso)</small></div>
      <div class="ao-sp__skills">${skillsHtml}</div>
    `;

    panel.querySelectorAll<HTMLButtonElement>(".ao-sp__alloc").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stat = btn.dataset.stat as StatKey | undefined;
        if (stat) onAllocStat(stat);
      });
    });
    panel.querySelector<HTMLButtonElement>(".ao-sp__close")?.addEventListener("click", () => {
      panel.classList.remove("ao-stats-panel--open");
    });
  }

  return {
    update: render,
    destroy: () => {
      panel.remove();
    },
  };
}

// Fila de vital con etiqueta, valores y barra de color.
function vitalRow(label: string, cur: number, max: number, dark: string, light: string): string {
  return `
    <div class="ao-sp__vital">
      <div class="ao-sp__row">
        <span class="ao-sp__k">${label}</span>
        <span class="ao-sp__v">${Math.max(0, Math.round(cur)).toString()} / ${Math.round(max).toString()}</span>
      </div>
      ${bar(cur, max, `linear-gradient(90deg,${dark},${light})`)}
    </div>`;
}
