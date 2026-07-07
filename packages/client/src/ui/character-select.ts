import {
  ApiError,
  type CharacterSummary,
  createCharacter,
  listCharacters,
} from "../api";
import { clearToken } from "../auth";
import { CLASSES } from "@ao/shared";

const ERROR_MESSAGES: Record<string, string> = {
  NAME_TAKEN: "Ese nombre ya está tomado.",
  INVALID_NAME: "El nombre debe tener 3-16 letras o números, sin espacios.",
  MAX_CHARACTERS_REACHED: "Ya tenés el máximo de 3 personajes.",
  INVALID_TOKEN: "Sesión expirada.",
  UNKNOWN_ERROR: "No se pudo crear el personaje.",
};

function humanize(code: string): string {
  return ERROR_MESSAGES[code] ?? `Error: ${code}`;
}

interface Callbacks {
  onPlay: (character: CharacterSummary) => void;
  onLogout: () => void;
  onAuthExpired: () => void;
}

export function renderCharacterSelect(root: HTMLElement, cb: Callbacks): () => void {
  let characters: CharacterSummary[] = [];
  let selectedId: number | null = null;
  let loading = true;
  let error: string | null = null;

  const card = document.createElement("div");
  card.className = "card card-wide fade-in";

  function setError(code: string | null): void {
    error = code;
    render();
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    render();
    try {
      const result = await listCharacters();
      characters = result.characters;
      selectedId = characters[0]?.id ?? null;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        cb.onAuthExpired();
        return;
      }
      error = err instanceof ApiError ? err.code : "UNKNOWN_ERROR";
    } finally {
      loading = false;
      render();
    }
  }

  let selectedClassId = 1;

  async function onCreate(name: string, input: HTMLInputElement, btn: HTMLButtonElement): Promise<void> {
    if (!name.trim()) return;
    btn.disabled = true;
    btn.textContent = "...";
    setError(null);
    try {
      const created = await createCharacter(name.trim(), selectedClassId);
      characters = [...characters, created];
      selectedId = created.id;
      input.value = "";
      render();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        cb.onAuthExpired();
        return;
      }
      setError(err instanceof ApiError ? err.code : "UNKNOWN_ERROR");
    } finally {
      btn.disabled = false;
      btn.textContent = "Crear";
    }
  }

  function render(): void {
    if (loading) {
      card.innerHTML = `
        <div class="brand">
          <div class="brand-title">Argentum Online</div>
          <div class="brand-sub">Cargando personajes...</div>
        </div>
      `;
      return;
    }

    const canCreate = characters.length < 3;
    const selected = characters.find((c) => c.id === selectedId);

    const charsHtml = characters
      .map(
        (c) => {
          const cls = CLASSES[c.classId ?? 1];
          return `
          <div class="char-card${c.id === selectedId ? " selected" : ""}" data-id="${c.id}">
            <div class="char-name">${escapeHtml(c.name)}</div>
            <div class="char-level">Nivel ${c.level.toString()} ${cls ? `· ${cls.name}` : ""}</div>
            <div class="char-meta">creado ${new Date(c.createdAt).toLocaleDateString("es")}</div>
          </div>`;
        },
      )
      .join("");

    const emptySlots = Array.from({ length: 3 - characters.length }, () => `
      <div class="char-card empty">
        <div class="char-name">— vacío —</div>
        <div class="char-meta">slot libre</div>
      </div>
    `).join("");

    card.innerHTML = `
      <div class="brand">
        <div class="brand-title">Tus personajes</div>
        <div class="brand-sub">elegí uno o creá uno nuevo</div>
      </div>

      ${error ? `<div class="error-msg">${humanize(error)}</div>` : ""}

      <div class="chars-grid">
        ${charsHtml}
        ${emptySlots}
      </div>

      ${
        canCreate
          ? `
        <form class="create-form" id="create-form" novalidate>
          <input id="create-name" type="text" minlength="3" maxlength="16" required
                 placeholder="nombre del personaje (3-16, sin espacios)" autocomplete="off" />
          <div class="class-selector" id="class-selector">
            ${Object.values(CLASSES).map((cls) => `
              <div class="class-option${cls.id === selectedClassId ? " selected" : ""}"
                   data-class-id="${cls.id.toString()}"
                   title="${escapeHtml(cls.description)}">
                <div class="class-option-name">${escapeHtml(cls.name)}</div>
                <div class="class-option-desc">${escapeHtml(cls.description)}</div>
              </div>`).join("")}
          </div>
          <button type="submit" class="button" id="create-btn">Crear</button>
        </form>
      `
          : `<div class="muted">Llegaste al máximo de 3 personajes.</div>`
      }

      <div class="divider">acción</div>

      <div class="char-actions">
        <button type="button" class="button button-secondary" id="logout-btn">Cerrar sesión</button>
        <button type="button" class="button" id="play-btn" ${selected ? "" : "disabled"}>
          ${selected ? `Jugar con ${escapeHtml(selected.name)}` : "Elegí un personaje"}
        </button>
      </div>
    `;

    card.querySelectorAll<HTMLDivElement>(".char-card[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number.parseInt(el.dataset.id ?? "", 10);
        if (!Number.isNaN(id)) {
          selectedId = id;
          render();
        }
      });
    });

    const createForm = card.querySelector<HTMLFormElement>("#create-form");
    if (createForm) {
      const input = createForm.querySelector<HTMLInputElement>("#create-name")!;
      const btn = createForm.querySelector<HTMLButtonElement>("#create-btn")!;
      createForm.addEventListener("submit", (ev) => {
        ev.preventDefault();
        void onCreate(input.value, input, btn);
      });
      card.querySelectorAll<HTMLDivElement>(".class-option").forEach((opt) => {
        opt.addEventListener("click", () => {
          const id = Number.parseInt(opt.dataset.classId ?? "1", 10);
          if (!Number.isNaN(id)) {
            selectedClassId = id;
            card.querySelectorAll<HTMLDivElement>(".class-option").forEach((o) => {
              o.classList.toggle("selected", Number.parseInt(o.dataset.classId ?? "0", 10) === id);
            });
          }
        });
      });
    }

    card.querySelector<HTMLButtonElement>("#logout-btn")?.addEventListener("click", () => {
      cb.onLogout();
    });

    card.querySelector<HTMLButtonElement>("#play-btn")?.addEventListener("click", () => {
      if (selected) cb.onPlay(selected);
    });
  }

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.appendChild(card);
  root.appendChild(overlay);

  void load();

  return () => {
    overlay.remove();
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
