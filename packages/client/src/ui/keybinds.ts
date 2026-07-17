// Teclas configurables. Se persisten en localStorage y el panel de
// configuración (ui/key-config.ts) permite remapearlas en vivo.

export type KeyAction =
  | "north"
  | "south"
  | "west"
  | "east"
  | "attack"
  | "pickup"
  | "meditate"
  | "rest"
  | "inventory"
  | "stats";

export const ACTION_LABELS: Record<KeyAction, string> = {
  north: "Mover arriba",
  south: "Mover abajo",
  west: "Mover izquierda",
  east: "Mover derecha",
  attack: "Atacar",
  pickup: "Agarrar",
  meditate: "Meditar",
  rest: "Descansar (fogata)",
  inventory: "Mostrar/ocultar panel",
  stats: "Estadísticas",
};

// event.code por acción. Las flechas quedan SIEMPRE activas para moverse
// además de las teclas configuradas (como el AO clásico).
const DEFAULTS: Record<KeyAction, string> = {
  north: "KeyW",
  south: "KeyS",
  west: "KeyA",
  east: "KeyD",
  attack: "ControlLeft",
  pickup: "KeyG",
  meditate: "KeyM",
  rest: "KeyR",
  inventory: "KeyI",
  stats: "KeyC",
};

const STORAGE_KEY = "ao-keybinds-v1";

export type Keymap = Record<KeyAction, string>;

export function loadKeymap(): Keymap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Keymap>;
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // storage corrupto → defaults
  }
  return { ...DEFAULTS };
}

export function saveKeymap(map: Keymap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function resetKeymap(): Keymap {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULTS };
}

// Nombre legible de un event.code ("KeyG" → "G", "ControlLeft" → "Ctrl izq").
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const names: Record<string, string> = {
    ControlLeft: "Ctrl izq",
    ControlRight: "Ctrl der",
    ShiftLeft: "Shift izq",
    ShiftRight: "Shift der",
    Space: "Espacio",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  return names[code] ?? code;
}
