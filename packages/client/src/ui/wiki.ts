// Wiki del juego (overlay público, se abre desde el nav "WIKI" de la landing).
// Igual patrón que openRanking: crea un overlay .lp-wiki-overlay y devuelve una
// función de cleanup que lo remueve. 100% presentación sobre datos de @ao/shared:
// no hay lógica de juego acá.
//
// Primera entrega: shell + nav interno + dos secciones data-driven completas
// (Clases y Hechizos). Items / Criaturas / Mecánicas quedan como placeholders
// deshabilitados ("próximamente").
import { CLASSES, AO_SPELLS, spellLearnLevel, classUsesMagic, type ClassDef, type AoSpellDef } from "@ao/shared";

type Section = "clases" | "hechizos";

interface NavItem {
  readonly key: Section | string;
  readonly label: string;
  readonly enabled: boolean;
}

const NAV: readonly NavItem[] = [
  { key: "clases", label: "Clases", enabled: true },
  { key: "hechizos", label: "Hechizos", enabled: true },
  { key: "items", label: "Ítems", enabled: false },
  { key: "criaturas", label: "Criaturas", enabled: false },
  { key: "mecanicas", label: "Mecánicas", enabled: false },
];

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

// ── Sección Clases ─────────────────────────────────────────────────────────
function renderClases(): string {
  const cards = Object.values(CLASSES)
    .sort((a, b) => a.id - b.id)
    .map((c: ClassDef) => {
      const magic = classUsesMagic(c.id);
      const badge = magic
        ? `<span class="lp-wiki-badge lp-wiki-badge--magic">✦ Usa magia</span>`
        : `<span class="lp-wiki-badge lp-wiki-badge--nomagic">⚔ Sin magia</span>`;
      // Atributos base (fijos en la creación, decisión de diseño).
      const attrs: ReadonlyArray<[string, number]> = [
        ["Fuerza", c.str],
        ["Agilidad", c.agi],
        ["Inteligencia", c.int],
        ["Constitución", c.con],
        ["Carisma", c.car],
      ];
      const attrRows = attrs
        .map(([k, v]) => `<div class="lp-wiki-stat"><span>${esc(k)}</span><b>${v.toString()}</b></div>`)
        .join("");
      // HP / maná de progresión.
      const vitals: ReadonlyArray<[string, string]> = [
        ["HP base", c.baseHp.toString()],
        ["HP / nivel", `~${c.modVida.toString()}`],
        ["Maná base", c.baseMp.toString()],
        ["Maná / nivel", magic ? `${c.manaK.toString()}× INT` : "—"],
      ];
      const vitalRows = vitals
        .map(([k, v]) => `<div class="lp-wiki-stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
        .join("");
      return `
        <article class="lp-wiki-card">
          <div class="lp-wiki-card__head">
            <h3 class="lp-wiki-card__name">${esc(c.name)}</h3>
            ${badge}
          </div>
          <p class="lp-wiki-card__desc">${esc(c.description)}</p>
          <div class="lp-wiki-statgrid">${attrRows}</div>
          <div class="lp-wiki-statgrid lp-wiki-statgrid--vitals">${vitalRows}</div>
        </article>`;
    })
    .join("");
  return `
    <p class="lp-wiki-intro">Las ${Object.keys(CLASSES).length.toString()} clases jugables. Los atributos son fijos desde la creación (la mejor tirada del AO original); lo que sube por nivel es la vida, el maná y las habilidades.</p>
    <div class="lp-wiki-cards">${cards}</div>`;
}

// ── Sección Hechizos ───────────────────────────────────────────────────────
// Descripción corta del efecto derivada de los flags/campos del hechizo.
function spellEffect(s: AoSpellDef): string {
  const parts: string[] = [];
  if (s.revivir) parts.push("Resucita");
  if (s.invisibilidad) parts.push("Invisibilidad");
  if (s.removerParalisis) parts.push("Remueve parálisis");
  if (s.curaVeneno) parts.push("Cura veneno");
  if (s.paraliza) parts.push("Paraliza al objetivo");
  if (s.inmoviliza) parts.push("Inmoviliza");
  if (s.envenena) parts.push("Envenena");
  if (s.ceguera) parts.push("Ciega");
  if (s.estupidez) parts.push("Aturde");
  if (s.agiBoost) parts.push("Aumenta agilidad");
  if (s.strBoost) parts.push("Aumenta fuerza");
  if (s.tipo === 4) parts.push("Invoca criatura");
  // HP: 1 = cura, 2 = daño. Sólo mostramos el rango si es un valor "de juego".
  const hasRange = s.maxHp > 0 && s.maxHp < 9999;
  const range = hasRange ? ` (${s.minHp.toString()}–${s.maxHp.toString()})` : "";
  if (s.subeHp === 1) parts.push(`Cura HP${range}`);
  else if (s.subeHp === 2) parts.push(`Daño mágico${range}`);
  return parts.length > 0 ? parts.join(" · ") : "Efecto especial";
}

const TARGET_LABEL: Record<number, string> = {
  1: "Aliado", 2: "Criatura", 3: "Cualquiera", 4: "Terreno",
};

interface LearnableSpell {
  readonly spell: AoSpellDef;
  readonly level: number;
}

function learnableSpells(): LearnableSpell[] {
  const out: LearnableSpell[] = [];
  for (const s of Object.values(AO_SPELLS)) {
    const level = spellLearnLevel(s.id);
    if (level === undefined) continue; // hechizo de NPC/GM: no aprendible
    out.push({ spell: s, level });
  }
  // Orden por nivel de aprendizaje ascendente; a igualdad, por nombre.
  out.sort((a, b) => (a.level - b.level) || a.spell.name.localeCompare(b.spell.name));
  return out;
}

function spellRow(ls: LearnableSpell): string {
  const s = ls.spell;
  const words = s.magicWords.trim();
  const wordsHtml = words ? `<span class="lp-wiki-spell__words">${esc(words)}</span>` : "";
  const tgt = TARGET_LABEL[s.target] ?? "";
  return `
    <div class="lp-wiki-spell" data-name="${esc(s.name.toLowerCase())}">
      <span class="lp-wiki-spell__lvl" title="Nivel de aprendizaje">Nv ${ls.level.toString()}</span>
      <span class="lp-wiki-spell__main">
        <span class="lp-wiki-spell__name">${esc(s.name)}</span>
        ${wordsHtml}
      </span>
      <span class="lp-wiki-spell__effect">${esc(spellEffect(s))}${tgt ? ` <em>· ${esc(tgt)}</em>` : ""}</span>
      <span class="lp-wiki-spell__mana">${s.manaCost.toString()} maná</span>
    </div>`;
}

function renderHechizos(): string {
  const spells = learnableSpells();
  const rows = spells.map(spellRow).join("");
  return `
    <p class="lp-wiki-intro">Hechizos aprendibles por jugadores (${spells.length.toString()} en total), ordenados por nivel de aprendizaje. En el AO se aprenden con pergaminos; el nivel indicado es cuando tu habilidad de Magia alcanza para castearlo.</p>
    <div class="lp-wiki-filter">
      <input type="text" class="lp-wiki-search" id="lp-wiki-spell-search" placeholder="Filtrar por nombre…" autocomplete="off" spellcheck="false" aria-label="Filtrar hechizos por nombre">
    </div>
    <div class="lp-wiki-spells" id="lp-wiki-spell-list">
      <div class="lp-wiki-spell lp-wiki-spell--head">
        <span class="lp-wiki-spell__lvl">Nivel</span>
        <span class="lp-wiki-spell__main">Hechizo</span>
        <span class="lp-wiki-spell__effect">Efecto</span>
        <span class="lp-wiki-spell__mana">Costo</span>
      </div>
      ${rows}
      <div class="lp-wiki-empty" id="lp-wiki-spell-empty" hidden>Ningún hechizo coincide con el filtro.</div>
    </div>`;
}

// ── Shell ──────────────────────────────────────────────────────────────────
export function openWiki(root: HTMLElement): () => void {
  let section: Section = "clases";
  let closed = false;

  const overlay = document.createElement("div");
  overlay.className = "lp-wiki-overlay";

  const navHtml = NAV
    .map((n) => {
      if (!n.enabled) {
        return `<button type="button" class="lp-wiki-tab" disabled title="Próximamente">${esc(n.label)} <span class="lp-wiki-soon">pronto</span></button>`;
      }
      const sel = n.key === section ? " sel" : "";
      return `<button type="button" class="lp-wiki-tab${sel}" data-sec="${esc(n.key)}">${esc(n.label)}</button>`;
    })
    .join("");

  overlay.innerHTML = `
    <div class="lp-wiki" role="dialog" aria-label="Wiki de AoTum">
      <div class="lp-wiki__head">
        <h2 class="lp-wiki__title">📖 Wiki</h2>
        <button type="button" class="lp-wiki__close" title="Cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="lp-wiki__nav">${navHtml}</div>
      <div class="lp-wiki__body" id="lp-wiki-body"></div>
    </div>`;

  const bodyEl = overlay.querySelector<HTMLDivElement>("#lp-wiki-body")!;

  function wireSection(): void {
    if (section !== "hechizos") return;
    const input = bodyEl.querySelector<HTMLInputElement>("#lp-wiki-spell-search");
    const list = bodyEl.querySelector<HTMLDivElement>("#lp-wiki-spell-list");
    const empty = bodyEl.querySelector<HTMLDivElement>("#lp-wiki-spell-empty");
    if (!input || !list || !empty) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      let visible = 0;
      list.querySelectorAll<HTMLDivElement>(".lp-wiki-spell[data-name]").forEach((row) => {
        const match = q === "" || (row.dataset.name ?? "").includes(q);
        row.hidden = !match;
        if (match) visible += 1;
      });
      empty.hidden = visible > 0;
    });
  }

  function render(): void {
    bodyEl.scrollTop = 0;
    bodyEl.innerHTML = section === "clases" ? renderClases() : renderHechizos();
    wireSection();
  }

  // Nav interno.
  overlay.querySelectorAll<HTMLButtonElement>("[data-sec]").forEach((b) => {
    b.addEventListener("click", () => {
      const key = b.dataset.sec;
      if (key !== "clases" && key !== "hechizos") return;
      section = key;
      overlay.querySelectorAll<HTMLButtonElement>("[data-sec]").forEach((x) => x.classList.toggle("sel", x === b));
      render();
    });
  });

  const close = (): void => { if (closed) return; closed = true; overlay.remove(); };
  overlay.querySelector<HTMLButtonElement>(".lp-wiki__close")?.addEventListener("click", close);
  // Click fuera del panel cierra (no tapa permanentemente).
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  root.appendChild(overlay);
  render();
  return close;
}
