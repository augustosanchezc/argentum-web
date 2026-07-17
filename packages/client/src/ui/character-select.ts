import {
  ApiError,
  type CharacterSummary,
  createCharacter,
  listCharacters,
} from "../api";
import { clearToken } from "../auth";
import { CLASSES, GENDERS, RACES, raceAttributes } from "@ao/shared";
import { loadSpriteData, charSpriteHtml } from "./char-preview";

const MAX_CHARS = 5;

const ERROR_MESSAGES: Record<string, string> = {
  NAME_TAKEN: "Ese nombre ya está tomado.",
  INVALID_NAME: "El nombre debe tener 3-16 letras o números, sin espacios.",
  MAX_CHARACTERS_REACHED: "Ya tenés el máximo de 5 personajes.",
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
  let spritesReady = false;
  let error: string | null = null;

  // Estado del formulario de creación.
  let fName = "";
  let fGender = 1;
  let fRace = 1;
  let fClass = 1;
  let fHead = RACES[1]!.heads[1][0];

  const card = document.createElement("div");
  card.className = "card card-wide fade-in";

  function headRange(): readonly [number, number] {
    return RACES[fRace]!.heads[fGender === 2 ? 2 : 1];
  }
  function clampHead(): void {
    const [lo, hi] = headRange();
    if (fHead < lo || fHead > hi) fHead = lo;
  }
  function cycleHead(dir: number): void {
    const [lo, hi] = headRange();
    fHead += dir;
    if (fHead > hi) fHead = lo;
    if (fHead < lo) fHead = hi;
  }
  function previewBody(): number {
    return fGender === 2 ? RACES[fRace]!.body[2] : RACES[fRace]!.body[1];
  }

  function setError(code: string | null): void {
    error = code;
    render();
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    render();
    try {
      const [result] = await Promise.all([listCharacters(), loadSpriteData().then(() => { spritesReady = true; })]);
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

  async function onCreate(btn: HTMLButtonElement): Promise<void> {
    if (!fName.trim()) { setError("INVALID_NAME"); return; }
    btn.disabled = true;
    btn.textContent = "Creando...";
    setError(null);
    try {
      clampHead();
      const created = await createCharacter({ name: fName.trim(), classId: fClass, race: fRace, gender: fGender, head: fHead });
      characters = [...characters, created];
      selectedId = created.id;
      fName = "";
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
      btn.textContent = "Crear personaje";
    }
  }

  function render(): void {
    if (loading) {
      card.innerHTML = `<div class="brand"><div class="brand-title">Argentum Online</div><div class="brand-sub">Cargando personajes...</div></div>`;
      return;
    }
    clampHead();
    const canCreate = characters.length < MAX_CHARS;
    const selected = characters.find((c) => c.id === selectedId);
    const attrs = raceAttributes(fRace);

    const charsHtml = characters.map((c) => {
      const cls = CLASSES[c.classId ?? 1];
      const spr = spritesReady ? charSpriteHtml(c.bodyId ?? 21, c.headId ?? 1, 1, 66) : "";
      return `
        <div class="char-card${c.id === selectedId ? " selected" : ""}" data-id="${c.id}">
          ${spr}
          <div class="char-name">${escapeHtml(c.name)}</div>
          <div class="char-level">Nv ${c.level.toString()}${cls ? ` · ${escapeHtml(cls.name)}` : ""}</div>
          <div class="char-meta">${RACES[c.race ?? 1]?.name ?? ""}</div>
        </div>`;
    }).join("");

    const emptySlots = Array.from({ length: MAX_CHARS - characters.length }, () => `
      <div class="char-card empty"><div class="char-name">— vacío —</div><div class="char-meta">slot libre</div></div>`).join("");

    const optBtns = (items: [number, string, string?][], sel: number, attr: string): string =>
      items.map(([id, label, title]) => `<button type="button" class="opt-btn${id === sel ? " active" : ""}" data-${attr}="${id.toString()}"${title ? ` title="${escapeHtml(title)}"` : ""}>${escapeHtml(label)}</button>`).join("");

    const createPanel = canCreate ? `
      <div class="create-panel">
        <div class="create-preview">
          ${spritesReady ? charSpriteHtml(previewBody(), fHead, 2.4, 150) : ""}
          <div class="head-selector">
            <button type="button" class="opt-btn head-arrow" data-head="-1">◀</button>
            <span class="head-lbl">Cabeza</span>
            <button type="button" class="opt-btn head-arrow" data-head="1">▶</button>
          </div>
          <div class="attr-line">FUE ${attrs.str.toString()} · AGI ${attrs.agi.toString()} · INT ${attrs.int.toString()} · CON ${attrs.con.toString()} · CAR ${attrs.car.toString()}</div>
        </div>
        <div class="create-form">
          <input id="create-name" type="text" minlength="3" maxlength="16" value="${escapeHtml(fName)}"
                 placeholder="nombre (3-16, sin espacios)" autocomplete="off" />
          <div class="opt-group"><span class="opt-lbl">Género</span><div class="opt-row">${optBtns([[1, GENDERS[1] ?? "Hombre"], [2, GENDERS[2] ?? "Mujer"]], fGender, "gender")}</div></div>
          <div class="opt-group"><span class="opt-lbl">Raza</span><div class="opt-row">${optBtns(Object.values(RACES).map((r) => [r.id, r.name, r.description] as [number, string, string]), fRace, "race")}</div></div>
          <div class="opt-group"><span class="opt-lbl">Clase</span><div class="opt-row">${optBtns(Object.values(CLASSES).map((c) => [c.id, c.name, c.description] as [number, string, string]), fClass, "class")}</div></div>
          <div class="opt-desc">${escapeHtml(RACES[fRace]?.description ?? "")}<br>${escapeHtml(CLASSES[fClass]?.description ?? "")}</div>
          <button type="button" class="button" id="create-btn">Crear personaje</button>
        </div>
      </div>` : `<div class="muted">Llegaste al máximo de ${MAX_CHARS.toString()} personajes.</div>`;

    card.innerHTML = `
      <div class="brand"><div class="brand-title">Tus personajes</div><div class="brand-sub">elegí uno o creá uno nuevo (hasta ${MAX_CHARS.toString()})</div></div>
      ${error ? `<div class="error-msg">${humanize(error)}</div>` : ""}
      <div class="chars-grid">${charsHtml}${emptySlots}</div>
      ${createPanel}
      <div class="divider">acción</div>
      <div class="char-actions">
        <button type="button" class="button button-secondary" id="logout-btn">Cerrar sesión</button>
        <button type="button" class="button" id="play-btn" ${selected ? "" : "disabled"}>${selected ? `Jugar con ${escapeHtml(selected.name)}` : "Elegí un personaje"}</button>
      </div>`;

    // Wiring
    card.querySelectorAll<HTMLDivElement>(".char-card[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number.parseInt(el.dataset.id ?? "", 10);
        if (!Number.isNaN(id)) { selectedId = id; render(); }
      });
    });

    const nameInput = card.querySelector<HTMLInputElement>("#create-name");
    if (nameInput) {
      nameInput.addEventListener("input", () => { fName = nameInput.value; });
    }
    card.querySelectorAll<HTMLButtonElement>("[data-gender]").forEach((b) => b.addEventListener("click", () => { fGender = Number(b.dataset.gender); clampHead(); render(); }));
    card.querySelectorAll<HTMLButtonElement>("[data-race]").forEach((b) => b.addEventListener("click", () => { fRace = Number(b.dataset.race); clampHead(); render(); }));
    card.querySelectorAll<HTMLButtonElement>("[data-class]").forEach((b) => b.addEventListener("click", () => { fClass = Number(b.dataset.class); render(); }));
    card.querySelectorAll<HTMLButtonElement>("[data-head]").forEach((b) => b.addEventListener("click", () => { cycleHead(Number(b.dataset.head)); render(); }));
    card.querySelector<HTMLButtonElement>("#create-btn")?.addEventListener("click", (ev) => { ev.preventDefault(); void onCreate(ev.currentTarget as HTMLButtonElement); });

    card.querySelector<HTMLButtonElement>("#logout-btn")?.addEventListener("click", () => { cb.onLogout(); });
    card.querySelector<HTMLButtonElement>("#play-btn")?.addEventListener("click", () => { if (selected) cb.onPlay(selected); });
  }

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.appendChild(card);
  root.appendChild(overlay);

  void load();

  return () => { overlay.remove(); };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
