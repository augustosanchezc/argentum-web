// Página de inicio / landing (referencia del usuario: "Arte Inicial 1").
// Se muestra después del login: barra de navegación, tarjetas de acción
// (Mundo Abierto → personajes, Arenas) y un panel "De qué se trata".
// Tema azul homogéneo (arte 4), en línea con el resto del cliente.

interface HomeCallbacks {
  onEnterWorld: () => void; // "Ir a personajes" → selección de personaje
  onLogout: () => void;
}

const NAV = [
  { key: "inicio", label: "Inicio", icon: "⌂" },
  { key: "personajes", label: "Personajes", icon: "☰" },
  { key: "arenas", label: "Arenas", icon: "⚔" },
  { key: "ranking", label: "Ranking", icon: "🏆" },
  { key: "wiki", label: "Wiki", icon: "📖" },
  { key: "discord", label: "Discord", icon: "💬" },
] as const;

// Secciones todavía no implementadas → placeholder "próximamente".
const COMING_SOON = "Esta sección está en construcción. Pronto vas a poder usarla.";

export function renderHome(root: HTMLElement, cb: HomeCallbacks): () => void {
  const wrap = document.createElement("div");
  wrap.className = "ao-home";

  const navButtons = NAV.map(
    (n) => `<button class="ao-home__nav-item${n.key === "inicio" ? " active" : ""}" data-nav="${n.key}"><span>${n.icon}</span>${n.label}</button>`,
  ).join("");

  wrap.innerHTML = `
    <header class="ao-home__top">
      <div class="ao-home__brand"><span class="ao-home__logo">AO</span> AO Web</div>
      <nav class="ao-home__nav">${navButtons}</nav>
      <div class="ao-home__account">
        <span class="ao-home__user">Mi cuenta</span>
        <button class="ao-home__logout" data-nav="logout" title="Cerrar sesión">⇥</button>
      </div>
    </header>

    <main class="ao-home__body">
      <section class="ao-home__cards">
        <div class="ao-home__card ao-home__card--world">
          <div class="ao-home__card-tag">MUNDO ABIERTO</div>
          <p class="ao-home__card-desc">Explorá el mundo de Argentum: ciudades, dungeons, criaturas y jugadores.</p>
          <button class="ao-home__card-btn" data-act="world">Ir a personajes</button>
        </div>
        <div class="ao-home__card ao-home__card--arenas">
          <div class="ao-home__card-tag">ARENAS</div>
          <p class="ao-home__card-desc">Combate PvP en arenas. Próximamente.</p>
          <button class="ao-home__card-btn" data-act="arenas" disabled>Ir a Arenas</button>
        </div>
      </section>

      <section class="ao-home__about">
        <div class="ao-home__about-head">
          <span class="ao-home__about-tag">DE QUÉ SE TRATA</span>
        </div>
        <h1 class="ao-home__about-title">AO Web — Beta</h1>
        <div class="ao-home__about-text">
          <p>Un port web de Argentum Online Libre, fiel a los datos y el balance del juego original (todo se parsea de la fuente open source de AO Libre). Corre 100% en el navegador.</p>
          <p>Es una beta en desarrollo: se van sumando funciones día a día — sonidos, oficios, ordenar hechizos/items y todo lo necesario para una mejor jugabilidad.</p>
          <p>Cualquier feedback o reporte de bug es bienvenido.</p>
        </div>
      </section>
    </main>
  `;

  const placeholder = (title: string): void => {
    // Aviso simple para secciones aún no construidas.
    alert(`${title}\n\n${COMING_SOON}`);
  };

  wrap.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((b) => {
    b.addEventListener("click", () => {
      const key = b.dataset.nav;
      if (key === "logout") { cb.onLogout(); return; }
      if (key === "personajes") { cb.onEnterWorld(); return; }
      if (key === "inicio") return;
      placeholder(b.textContent?.trim() ?? "Sección");
    });
  });
  wrap.querySelector<HTMLButtonElement>("[data-act='world']")?.addEventListener("click", () => { cb.onEnterWorld(); });

  root.appendChild(wrap);
  return () => { wrap.remove(); };
}
