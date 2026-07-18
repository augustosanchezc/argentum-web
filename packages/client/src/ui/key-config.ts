// Panel de configuración de teclas: modal con la lista de acciones;
// click en una fila → "presioná una tecla" → guarda en localStorage.

import {
  ACTION_LABELS,
  keyLabel,
  loadKeymap,
  resetKeymap,
  saveKeymap,
  type KeyAction,
  type Keymap,
} from "./keybinds.js";
import { audio } from "../audio.js";

export interface KeyConfigHandle {
  open(): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function mountKeyConfig(
  parent: HTMLElement,
  onChange: (map: Keymap) => void,
): KeyConfigHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-keyconfig";
  wrap.innerHTML = `
    <div class="ao-keyconfig__box">
      <div class="ao-keyconfig__title">Configuración de teclas
        <button class="ao-keyconfig__close" type="button">✕</button>
      </div>
      <div class="ao-keyconfig__rows"></div>
      <div class="ao-keyconfig__audio">
        <div class="ao-keyconfig__audiohead">Audio</div>
        <div class="ao-keyconfig__audiorow">
          <label class="ao-keyconfig__audiolbl"><input type="checkbox" id="ao-cfg-musicon"> Música</label>
          <input type="range" min="0" max="100" id="ao-cfg-musicvol" class="ao-keyconfig__slider">
        </div>
        <div class="ao-keyconfig__audiorow">
          <label class="ao-keyconfig__audiolbl"><input type="checkbox" id="ao-cfg-sfxon"> Sonido / ambiente</label>
          <input type="range" min="0" max="100" id="ao-cfg-sfxvol" class="ao-keyconfig__slider">
        </div>
      </div>
      <div class="ao-keyconfig__footer">
        <button class="ao-keyconfig__reset" type="button">Restaurar por defecto</button>
        <span class="ao-keyconfig__hint">Las flechas siempre mueven, además de WASD.</span>
      </div>
    </div>
  `;
  parent.appendChild(wrap);

  const rowsEl = wrap.querySelector<HTMLDivElement>(".ao-keyconfig__rows")!;
  let map = loadKeymap();
  let capturing: KeyAction | null = null;

  function render(): void {
    rowsEl.replaceChildren();
    for (const action of Object.keys(ACTION_LABELS) as KeyAction[]) {
      const row = document.createElement("div");
      row.className = "ao-keyconfig__row";
      const isCapturing = capturing === action;
      row.innerHTML = `
        <span class="ao-keyconfig__action">${ACTION_LABELS[action]}</span>
        <button class="ao-keyconfig__key${isCapturing ? " ao-keyconfig__key--capturing" : ""}" type="button">
          ${isCapturing ? "presioná una tecla..." : keyLabel(map[action])}
        </button>
      `;
      row.querySelector("button")!.addEventListener("click", () => {
        capturing = action;
        render();
      });
      rowsEl.appendChild(row);
    }
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!capturing || !wrap.classList.contains("ao-keyconfig--open")) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code !== "Escape") {
      map = { ...map, [capturing]: e.code };
      saveKeymap(map);
      onChange(map);
    }
    capturing = null;
    render();
  };
  // capture=true para ganarle al handler global del juego.
  window.addEventListener("keydown", onKeyDown, true);

  wrap.querySelector(".ao-keyconfig__close")!.addEventListener("click", () => {
    close();
  });
  wrap.querySelector(".ao-keyconfig__reset")!.addEventListener("click", () => {
    map = resetKeymap();
    onChange(map);
    render();
  });

  // Controles de audio: música y sonido/ambiente — on/off + volumen (persisten).
  const musicOnEl = wrap.querySelector<HTMLInputElement>("#ao-cfg-musicon")!;
  const musicVolEl = wrap.querySelector<HTMLInputElement>("#ao-cfg-musicvol")!;
  const sfxOnEl = wrap.querySelector<HTMLInputElement>("#ao-cfg-sfxon")!;
  const sfxVolEl = wrap.querySelector<HTMLInputElement>("#ao-cfg-sfxvol")!;
  musicOnEl.checked = audio.musicOn;
  musicVolEl.value = Math.round(audio.musicVol * 100).toString();
  sfxOnEl.checked = audio.sfxOn;
  sfxVolEl.value = Math.round(audio.volume * 100).toString();
  const applyMusic = (): void => { audio.setMusic(musicOnEl.checked, Number(musicVolEl.value) / 100); };
  const applySfx = (): void => { audio.setSfx(sfxOnEl.checked, Number(sfxVolEl.value) / 100); };
  musicOnEl.addEventListener("change", applyMusic);
  musicVolEl.addEventListener("input", applyMusic);
  sfxOnEl.addEventListener("change", applySfx);
  sfxVolEl.addEventListener("input", applySfx);

  function open(): void {
    wrap.classList.add("ao-keyconfig--open");
    render();
  }
  function close(): void {
    capturing = null;
    wrap.classList.remove("ao-keyconfig--open");
  }

  return {
    open,
    close,
    isOpen: () => wrap.classList.contains("ao-keyconfig--open"),
    destroy: () => {
      window.removeEventListener("keydown", onKeyDown, true);
      wrap.remove();
    },
  };
}
