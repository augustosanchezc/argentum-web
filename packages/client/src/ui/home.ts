// Landing pública (se muestra tras el login). Rediseño hi-fi "MMO moderno"
// del handoff de diseño: header + hero a 2 columnas + franja de 4 features.
// Prefijo .lp- en el CSS para no colisionar con el HUD in-game.

interface HomeCallbacks {
  onEnterWorld: () => void; // "JUGAR AHORA" / "PERSONAJES" → selección de personaje
  onLogout: () => void; // "MI CUENTA" / cerrar sesión
}

import { startLiveMap } from "./live-map";
import { openRanking } from "./ranking";

// Secciones todavía no implementadas → placeholder "próximamente".
const COMING_SOON = "Esta sección está en construcción. Pronto vas a poder usarla.";

export function renderHome(root: HTMLElement, cb: HomeCallbacks): () => void {
  const wrap = document.createElement("div");
  wrap.className = "lp-root";

  wrap.innerHTML = `
    <div class="lp-header">
      <div class="lp-brand">
        <div class="lp-logo"></div>
        <span class="lp-word">AOTUM</span>
        <span class="lp-beta">BETA</span>
      </div>
      <nav class="lp-nav">
        <a class="active" data-nav="inicio">INICIO</a>
        <a data-nav="personajes">PERSONAJES</a>
        <a data-nav="ranking">RANKING</a>
        <a data-nav="wiki">WIKI</a>
      </nav>
      <button type="button" class="lp-btn-account" data-nav="cuenta">MI CUENTA</button>
    </div>

    <div class="lp-hero">
      <div>
        <div class="lp-status">
          <span class="lp-dot" id="lp-status-dot"></span>
          <span class="lp-status-label" id="lp-status-label">SERVIDOR ONLINE</span>
        </div>
        <h1 class="lp-h1">Jugá Argentum<br>sin instalar <span>nada</span></h1>
        <p class="lp-lead">Port web de Argentum Online Libre, fiel a los datos y el balance del original. Todo se parsea de la fuente open source y corre 100% en el navegador.</p>
        <div class="lp-cta-row">
          <button type="button" class="lp-cta" data-act="play">JUGAR AHORA</button>
          <button type="button" class="lp-ghost" data-nav="ranking">Ver ranking</button>
        </div>
        <div class="lp-stats">
          <div><div class="lp-stat-num">100%</div><div class="lp-stat-lbl">EN EL NAVEGADOR</div></div>
          <div><div class="lp-stat-num">Open</div><div class="lp-stat-lbl">SOURCE DATA</div></div>
          <div><div class="lp-stat-num">Diaria</div><div class="lp-stat-lbl">FRECUENCIA DE UPDATES</div></div>
        </div>
      </div>
      <div class="lp-shot"><canvas id="lp-live" class="lp-live-canvas"></canvas><span class="lp-shot-tag">EN VIVO · Ullathorpe</span></div>
    </div>

    <div class="lp-features">
      <div class="lp-feature">
        <h3>Mundo abierto</h3>
        <p>Ciudades, dungeons, criaturas y jugadores.</p>
      </div>
      <div class="lp-feature">
        <h3>Balance original</h3>
        <p>Datos parseados directo de AO Libre.</p>
      </div>
      <div class="lp-feature">
        <h3>Beta en desarrollo</h3>
        <p>Sonidos, oficios y más, sumándose día a día.</p>
      </div>
      <div class="lp-feature lp-feature--accent">
        <h3>Tu feedback importa</h3>
        <p>Cualquier reporte de bug es bienvenido. <a data-nav="feedback">Reportar →</a></p>
      </div>
    </div>
  `;

  const placeholder = (title: string): void => {
    alert(`${title}\n\n${COMING_SOON}`);
  };

  let closeRanking: (() => void) | undefined;
  wrap.querySelectorAll<HTMLElement>("[data-nav]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const key = el.dataset.nav;
      if (key === "personajes") { cb.onEnterWorld(); return; }
      if (key === "cuenta") { cb.onLogout(); return; }
      if (key === "inicio") return;
      if (key === "ranking") { closeRanking?.(); closeRanking = openRanking(wrap); return; }
      placeholder(el.textContent?.trim() ?? "Sección");
    });
  });
  wrap.querySelector<HTMLButtonElement>("[data-act='play']")?.addEventListener("click", () => { cb.onEnterWorld(); });

  // Indicador "SERVIDOR ONLINE": estado real vía /health. 200 → cian; fallo → rojo.
  const dot = wrap.querySelector<HTMLElement>("#lp-status-dot");
  const label = wrap.querySelector<HTMLElement>("#lp-status-label");
  let cancelled = false;
  void fetch("/health", { method: "GET" })
    .then((res) => {
      if (cancelled || !dot || !label) return;
      if (!res.ok) throw new Error("offline");
    })
    .catch(() => {
      if (cancelled || !dot || !label) return;
      dot.classList.add("lp-dot--off");
      label.classList.add("lp-status-label--off");
      label.textContent = "SERVIDOR OFFLINE";
    });

  // Foto en vivo del mundo (map 1, 50,50) refrescada cada minuto.
  let stopLive: (() => void) | undefined;
  const liveCanvas = wrap.querySelector<HTMLCanvasElement>("#lp-live");
  if (liveCanvas) {
    stopLive = startLiveMap(liveCanvas, { map: 1, x: 50, y: 50, refreshMs: 60_000 });
  }

  root.appendChild(wrap);
  return () => { cancelled = true; stopLive?.(); closeRanking?.(); wrap.remove(); };
}
