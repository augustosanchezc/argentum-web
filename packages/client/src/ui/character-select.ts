import {
  ApiError,
  type CharacterSummary,
  createCharacter,
  deleteCharacter,
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
  CHARACTER_NOT_FOUND: "Ese personaje ya no existe.",
  DELETE_FAILED: "No se pudo borrar el personaje.",
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

  const wrap = document.createElement("div");
  wrap.className = "lp-root";

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
    btn.textContent = "CREANDO...";
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
      btn.textContent = "CREAR PERSONAJE";
    }
  }

  async function onDelete(id: number): Promise<void> {
    const target = characters.find((c) => c.id === id);
    if (!target) return;
    // Confirmación (acción irreversible). Nativo, como el resto de avisos.
    if (!window.confirm(`¿Seguro que querés borrar a ${target.name}? Se pierde todo su progreso y no se puede deshacer.`)) return;
    setError(null);
    try {
      await deleteCharacter(id);
      characters = characters.filter((c) => c.id !== id);
      if (selectedId === id) selectedId = characters[0]?.id ?? null;
      render();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        cb.onAuthExpired();
        return;
      }
      setError(err instanceof ApiError ? err.code : "DELETE_FAILED");
    }
  }

  function render(): void {
    if (loading) {
      wrap.innerHTML = `
        <div class="lp-header">
          <div class="lp-brand"><div class="lp-logo"></div><span class="lp-word">AOTUM</span><span class="lp-beta">BETA</span></div>
        </div>
        <div class="lp-create"><div class="lp-title-sub" style="padding:44px">Cargando personajes...</div></div>`;
      return;
    }
    clampHead();
    const canCreate = characters.length < MAX_CHARS;
    const selected = characters.find((c) => c.id === selectedId);
    const attrs = raceAttributes(fRace);
    const raceName = RACES[fRace]?.name ?? "";
    const className = CLASSES[fClass]?.name ?? "";

    // Personajes existentes (no está en el diseño, pero el flujo lo requiere).
    const charsHtml = characters.map((c) => {
      const cls = CLASSES[c.classId ?? 1];
      const spr = spritesReady ? charSpriteHtml(c.bodyId ?? 21, c.headId ?? 1, 1, 60) : "";
      return `
        <button type="button" class="lp-char${c.id === selectedId ? " sel" : ""}" data-id="${c.id.toString()}">
          <span class="lp-char-del" data-del="${c.id.toString()}" role="button" tabindex="0" title="Borrar personaje" aria-label="Borrar ${escapeHtml(c.name)}">✕</span>
          ${spr}
          <div class="lp-char-name">${escapeHtml(c.name)}</div>
          <div class="lp-char-meta">Nv ${c.level.toString()}${cls ? ` · ${escapeHtml(cls.name)}` : ""}</div>
        </button>`;
    }).join("");

    const existingSection = characters.length
      ? `<div class="lp-group">
           <label class="lp-label">TUS PERSONAJES</label>
           <div class="lp-chars">${charsHtml}</div>
         </div>`
      : "";

    // Grilla de clases reales (7). Diseño: repeat(4,1fr), tarjeta nombre + rol.
    const classCards = Object.values(CLASSES).map((c) => `
      <button type="button" class="lp-class${c.id === fClass ? " sel" : ""}" data-class="${c.id.toString()}">
        <div class="lp-class-name">${escapeHtml(c.name)}</div>
        <div class="lp-class-role">${escapeHtml(c.description)}</div>
      </button>`).join("");

    const racePills = Object.values(RACES).map((r) => `
      <button type="button" class="lp-pill${r.id === fRace ? " sel" : ""}" data-race="${r.id.toString()}" title="${escapeHtml(r.description)}">${escapeHtml(r.name)}</button>`).join("");

    const genderPills = [1, 2].map((g) => `
      <button type="button" class="lp-pill${g === fGender ? " sel" : ""}" data-gender="${g.toString()}">${escapeHtml(GENDERS[g] ?? (g === 2 ? "Mujer" : "Hombre"))}</button>`).join("");

    const createFields = canCreate ? `
      <div class="lp-group">
        <label class="lp-label" for="create-name">NOMBRE</label>
        <input class="lp-input" id="create-name" type="text" minlength="3" maxlength="16" value="${escapeHtml(fName)}"
               placeholder="Elegí un nombre único" autocomplete="off" style="max-width:420px" />
      </div>
      <div class="lp-group">
        <label class="lp-label">CLASE</label>
        <div class="lp-classes">${classCards}</div>
      </div>
      <div class="lp-rowcols">
        <div class="lp-group">
          <label class="lp-label">RAZA</label>
          <div class="lp-pills">${racePills}</div>
        </div>
        <div class="lp-group">
          <label class="lp-label">GÉNERO</label>
          <div class="lp-pills">${genderPills}</div>
        </div>
      </div>`
      : `<div class="lp-title-sub">Llegaste al máximo de ${MAX_CHARS.toString()} personajes. Elegí uno para jugar.</div>`;

    // Atributos fijos por raza (fieles al AO original): panel de solo lectura,
    // sin "tirar dados". Se recalcula al cambiar de raza.
    const attrRows = [
      ["Fuerza", attrs.str],
      ["Agilidad", attrs.agi],
      ["Inteligencia", attrs.int],
      ["Carisma", attrs.car],
      ["Constitución", attrs.con],
    ].map(([label, val]) => `<div class="lp-attr"><span>${label as string}</span><span>${(val as number).toString()}</span></div>`).join("");

    wrap.innerHTML = `
      <div class="lp-header">
        <div class="lp-brand"><div class="lp-logo"></div><span class="lp-word">AOTUM</span><span class="lp-beta">BETA</span></div>
        <div class="lp-stepper">
          <span class="done">01 CUENTA</span><i></i>
          <span class="active">02 PERSONAJE</span><i></i>
          <span class="pending">03 JUGAR</span>
        </div>
        <button type="button" class="lp-backlink" id="logout-btn">Salir</button>
      </div>

      <div class="lp-create">
        <div class="lp-create-main">
          <div>
            <h1 class="lp-title">Creá tu personaje</h1>
            <p class="lp-title-sub">Datos y balance idénticos al Argentum Online original.</p>
          </div>
          ${error ? `<div class="lp-error">${humanize(error)}</div>` : ""}
          ${existingSection}
          ${createFields}
        </div>

        <div class="lp-side">
          <div class="lp-preview">
            ${spritesReady ? charSpriteHtml(previewBody(), fHead, 2.4, 150) : `<span class="lp-mono">[ sprite del personaje ]</span>`}
            ${canCreate ? `
            <div class="lp-head-sel">
              <button type="button" class="lp-head-arrow" data-head="-1">◀</button>
              <span class="lp-head-lbl">CABEZA</span>
              <button type="button" class="lp-head-arrow" data-head="1">▶</button>
            </div>` : ""}
          </div>

          <div class="lp-attrs">
            <div class="lp-attrs-title">ATRIBUTOS · ${escapeHtml(className.toUpperCase())} ${escapeHtml(raceName.toUpperCase())}</div>
            ${attrRows}
            <div class="lp-note">Atributos fijos según raza — fieles al AO original.</div>
          </div>

          ${canCreate ? `<button type="button" class="lp-cta lp-cta--full" id="create-btn">CREAR PERSONAJE</button>` : ""}
          <button type="button" class="lp-cta lp-cta--full" id="play-btn" ${selected ? "" : "disabled"}>${selected ? `JUGAR CON ${escapeHtml(selected.name.toUpperCase())}` : "ELEGÍ UN PERSONAJE"}</button>
        </div>
      </div>
    `;

    // Wiring — personajes existentes.
    wrap.querySelectorAll<HTMLButtonElement>(".lp-char[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number.parseInt(el.dataset.id ?? "", 10);
        if (!Number.isNaN(id)) { selectedId = id; render(); }
      });
    });
    // Wiring — botón borrar de cada tarjeta. stopPropagation para NO seleccionar
    // la tarjeta al borrar. Enter/espacio también disparan (es role="button").
    wrap.querySelectorAll<HTMLElement>(".lp-char-del[data-del]").forEach((el) => {
      const trigger = (ev: Event): void => {
        ev.stopPropagation();
        ev.preventDefault();
        const id = Number.parseInt(el.dataset.del ?? "", 10);
        if (!Number.isNaN(id)) void onDelete(id);
      };
      el.addEventListener("click", trigger);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") trigger(ev);
      });
    });

    // Wiring — formulario de creación.
    const nameInput = wrap.querySelector<HTMLInputElement>("#create-name");
    if (nameInput) {
      nameInput.addEventListener("input", () => { fName = nameInput.value; });
    }
    wrap.querySelectorAll<HTMLButtonElement>("[data-gender]").forEach((b) => b.addEventListener("click", () => { fGender = Number(b.dataset.gender); clampHead(); render(); }));
    wrap.querySelectorAll<HTMLButtonElement>("[data-race]").forEach((b) => b.addEventListener("click", () => { fRace = Number(b.dataset.race); clampHead(); render(); }));
    wrap.querySelectorAll<HTMLButtonElement>("[data-class]").forEach((b) => b.addEventListener("click", () => { fClass = Number(b.dataset.class); render(); }));
    wrap.querySelectorAll<HTMLButtonElement>("[data-head]").forEach((b) => b.addEventListener("click", () => { cycleHead(Number(b.dataset.head)); render(); }));
    wrap.querySelector<HTMLButtonElement>("#create-btn")?.addEventListener("click", (ev) => { ev.preventDefault(); void onCreate(ev.currentTarget as HTMLButtonElement); });

    wrap.querySelector<HTMLButtonElement>("#logout-btn")?.addEventListener("click", () => { cb.onLogout(); });
    wrap.querySelector<HTMLButtonElement>("#play-btn")?.addEventListener("click", () => { if (selected) cb.onPlay(selected); });
  }

  root.appendChild(wrap);

  void load();

  return () => { wrap.remove(); };
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
