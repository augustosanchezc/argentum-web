import { CHAT_TEXT_MAX_LENGTH } from "@ao/shared";

export interface ChatMessage {
  fromName: string;
  text: string;
  timestamp: number; // epoch ms (server)
  isSelf: boolean;
}

export interface ChatHandle {
  appendMessage(msg: ChatMessage): void;
  showError(reason: string): void;
  isInputFocused(): boolean;
  destroy(): void;
}

export interface MountChatOptions {
  parent: HTMLElement;
  onSend: (text: string) => void;
  selfCharacterName: string;
}

// Maximo de mensajes en el DOM. Mas viejos se recortan para no acumular
// nodos indefinidamente en sesiones largas.
const MAX_MESSAGES_IN_DOM = 200;

function fmtTime(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export function mountChat(opts: MountChatOptions): ChatHandle {
  const wrap = document.createElement("div");
  wrap.className = "ao-chat";
  wrap.innerHTML = `
    <div class="ao-chat__messages" role="log" aria-live="polite"></div>
    <form class="ao-chat__form" autocomplete="off">
      <span class="ao-chat__prefix">&gt;</span>
      <input
        class="ao-chat__input"
        type="text"
        maxlength="${CHAT_TEXT_MAX_LENGTH.toString()}"
        placeholder="Enter para chatear, Esc para cerrar"
        aria-label="Mensaje de chat"
      />
    </form>
  `;
  opts.parent.appendChild(wrap);

  const messagesEl = wrap.querySelector<HTMLDivElement>(".ao-chat__messages")!;
  const formEl = wrap.querySelector<HTMLFormElement>(".ao-chat__form")!;
  const inputEl = wrap.querySelector<HTMLInputElement>(".ao-chat__input")!;

  function scrollToBottom(): void {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendMessage(msg: ChatMessage): void {
    const row = document.createElement("div");
    row.className = msg.isSelf
      ? "ao-chat__msg ao-chat__msg--self"
      : "ao-chat__msg";
    const time = document.createElement("span");
    time.className = "ao-chat__time";
    time.textContent = fmtTime(msg.timestamp);
    const name = document.createElement("span");
    name.className = "ao-chat__name";
    name.textContent = msg.fromName;
    const text = document.createElement("span");
    text.className = "ao-chat__text";
    text.textContent = msg.text;
    row.append(time, name, text);
    messagesEl.appendChild(row);

    // Recorte de buffer
    while (messagesEl.childElementCount > MAX_MESSAGES_IN_DOM) {
      messagesEl.firstElementChild?.remove();
    }
    scrollToBottom();
  }

  function showError(reason: string): void {
    const row = document.createElement("div");
    row.className = "ao-chat__msg ao-chat__msg--error";
    const map: Record<string, string> = {
      RATE_LIMITED: "Más lento, esperá un segundo.",
      EMPTY: "El mensaje está vacío.",
      TOO_LONG: `El mensaje supera ${CHAT_TEXT_MAX_LENGTH.toString()} caracteres.`,
      BLOCKED: "Ese mensaje contiene lenguaje no permitido.",
    };
    row.textContent = map[reason] ?? `Error: ${reason}`;
    messagesEl.appendChild(row);
    while (messagesEl.childElementCount > MAX_MESSAGES_IN_DOM) {
      messagesEl.firstElementChild?.remove();
    }
    scrollToBottom();
  }

  function openInput(): void {
    wrap.classList.add("ao-chat--input-open");
    inputEl.focus();
  }
  function closeInput(): void {
    wrap.classList.remove("ao-chat--input-open");
    inputEl.value = "";
    inputEl.blur();
  }

  const onSubmit = (e: SubmitEvent): void => {
    e.preventDefault();
    const text = inputEl.value;
    if (text.trim().length > 0) {
      opts.onSend(text);
    }
    closeInput();
  };
  formEl.addEventListener("submit", onSubmit);

  // Hotkeys globales:
  //  - Enter: abre input (si no esta enfocado).
  //  - Esc: cierra input y devuelve foco al juego.
  // Mientras el input esta enfocado, los keydown del input se manejan
  // localmente (Enter submit, Esc close), y stopPropagation evita
  // que WASD del game scene los procese.
  const onGlobalKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Enter" && document.activeElement !== inputEl) {
      e.preventDefault();
      openInput();
    }
  };
  window.addEventListener("keydown", onGlobalKeyDown);

  const onInputKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Escape") {
      e.preventDefault();
      closeInput();
      return;
    }
    // Bloqueamos propagacion para que WASD escrito en el chat
    // no mueva al personaje.
    e.stopPropagation();
  };
  inputEl.addEventListener("keydown", onInputKeyDown);

  // Mensaje de bienvenida visible aunque todavia no llegue nada
  // del server — feedback inmediato de que el chat existe.
  appendMessage({
    fromName: "sistema",
    text: `Bienvenido ${opts.selfCharacterName}. Enter para chatear.`,
    timestamp: Date.now(),
    isSelf: false,
  });

  return {
    appendMessage,
    showError,
    isInputFocused: () => document.activeElement === inputEl,
    destroy: () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
      inputEl.removeEventListener("keydown", onInputKeyDown);
      formEl.removeEventListener("submit", onSubmit);
      wrap.remove();
    },
  };
}
