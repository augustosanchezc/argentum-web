// Sección Ranking (pública, se abre desde la landing). Top de personajes por
// NIVEL o KILLS PvP, filtrable por clase. Los primeros 5 se muestran como una
// "grada de competencia" (medallas 1º-3º + tier destacado 4º-5º).
import { getRanking, ApiError, type RankingEntry } from "../api";
import { CLASSES } from "@ao/shared";

type Sort = "level" | "kills";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

export function openRanking(root: HTMLElement): () => void {
  let sort: Sort = "level";
  let classId = 0; // 0 = todas
  let closed = false;

  const overlay = document.createElement("div");
  overlay.className = "lp-rank-overlay";

  const classPills = [{ id: 0, name: "Todas" }, ...Object.values(CLASSES).map((c) => ({ id: c.id, name: c.name }))]
    .map((c) => `<button type="button" class="lp-pill${c.id === classId ? " sel" : ""}" data-class="${c.id.toString()}">${escapeHtml(c.name)}</button>`)
    .join("");

  overlay.innerHTML = `
    <div class="lp-rank">
      <div class="lp-rank__head">
        <h2 class="lp-rank__title">🏆 Ranking</h2>
        <button type="button" class="lp-rank__close" title="Cerrar">✕</button>
      </div>
      <div class="lp-rank__controls">
        <div class="lp-rank__sort">
          <button type="button" class="lp-pill sel" data-sort="level">Por nivel</button>
          <button type="button" class="lp-pill" data-sort="kills">Por kills</button>
        </div>
        <div class="lp-rank__classes">${classPills}</div>
      </div>
      <div class="lp-rank__list" id="lp-rank-list"></div>
    </div>
  `;

  const listEl = overlay.querySelector<HTMLDivElement>("#lp-rank-list")!;

  function render(entries: RankingEntry[]): void {
    if (entries.length === 0) {
      listEl.innerHTML = `<div class="lp-rank__empty">Todavía no hay personajes en este ranking.</div>`;
      return;
    }
    const rows = entries.map((e, i) => {
      const pos = i + 1;
      const top = pos <= 5 ? ` lp-rankrow--top lp-rankrow--${pos.toString()}` : "";
      const badge = MEDALS[pos] ?? `<span class="lp-rankrow__num">${pos.toString()}</span>`;
      const cls = CLASSES[e.classId]?.name ?? "—";
      // Métrica principal (la del orden) resaltada; la otra, secundaria.
      const lvl = `Nv ${e.level.toString()}`;
      const kills = `${e.kills.toString()} kills`;
      const main = sort === "level" ? lvl : kills;
      const sub = sort === "level" ? kills : lvl;
      return `
        <div class="lp-rankrow${top}">
          <span class="lp-rankrow__pos">${badge}</span>
          <span class="lp-rankrow__name">${escapeHtml(e.name)}</span>
          <span class="lp-rankrow__class">${escapeHtml(cls)}</span>
          <span class="lp-rankrow__main">${main}</span>
          <span class="lp-rankrow__sub">${sub}</span>
        </div>`;
    }).join("");
    listEl.innerHTML = `
      <div class="lp-rankrow lp-rankrow--head">
        <span class="lp-rankrow__pos">#</span>
        <span class="lp-rankrow__name">Personaje</span>
        <span class="lp-rankrow__class">Clase</span>
        <span class="lp-rankrow__main">${sort === "level" ? "Nivel" : "Kills"}</span>
        <span class="lp-rankrow__sub">${sort === "level" ? "Kills" : "Nivel"}</span>
      </div>
      ${rows}`;
  }

  async function load(): Promise<void> {
    listEl.innerHTML = `<div class="lp-rank__empty">Cargando ranking…</div>`;
    try {
      const res = await getRanking(sort, classId || undefined);
      if (closed) return;
      render(res.ranking);
    } catch (err) {
      if (closed) return;
      const msg = err instanceof ApiError ? `Error ${err.status.toString()}` : "No se pudo cargar el ranking.";
      listEl.innerHTML = `<div class="lp-rank__empty">${escapeHtml(msg)}</div>`;
    }
  }

  // Wiring
  overlay.querySelectorAll<HTMLButtonElement>("[data-sort]").forEach((b) => {
    b.addEventListener("click", () => {
      sort = b.dataset.sort === "kills" ? "kills" : "level";
      overlay.querySelectorAll<HTMLButtonElement>("[data-sort]").forEach((x) => x.classList.toggle("sel", x === b));
      void load();
    });
  });
  overlay.querySelectorAll<HTMLButtonElement>("[data-class]").forEach((b) => {
    b.addEventListener("click", () => {
      classId = Number.parseInt(b.dataset.class ?? "0", 10) || 0;
      overlay.querySelectorAll<HTMLButtonElement>("[data-class]").forEach((x) => x.classList.toggle("sel", x === b));
      void load();
    });
  });

  const close = (): void => { if (closed) return; closed = true; overlay.remove(); };
  overlay.querySelector<HTMLButtonElement>(".lp-rank__close")?.addEventListener("click", close);
  // Click fuera del panel cierra.
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  root.appendChild(overlay);
  void load();
  return close;
}
