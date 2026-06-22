import { ApiError, type CharacterSummary, listCharacters } from "./api";
import { clearToken, getToken } from "./auth";
import { renderLogin } from "./ui/login";
import { renderCharacterSelect } from "./ui/character-select";
import { startGameScene, type GameSceneResult } from "./scenes/game";

const root = document.getElementById("app");
if (!root) throw new Error("No se encontró el contenedor #app");

let cleanup: (() => void) | (() => Promise<void>) | null = null;
let gameInstance: GameSceneResult | null = null;
let topbar: HTMLDivElement | null = null;

async function teardown(): Promise<void> {
  if (cleanup) {
    await cleanup();
    cleanup = null;
  }
  if (gameInstance) {
    await gameInstance.destroy();
    gameInstance = null;
  }
  if (topbar) {
    topbar.remove();
    topbar = null;
  }
}

async function showLogin(): Promise<void> {
  await teardown();
  cleanup = renderLogin(root!, () => {
    void showCharacters();
  });
}

async function showCharacters(): Promise<void> {
  await teardown();
  cleanup = renderCharacterSelect(root!, {
    onPlay: (character) => {
      void showGame(character);
    },
    onLogout: () => {
      clearToken();
      void showLogin();
    },
    onAuthExpired: () => {
      void showLogin();
    },
  });
}

async function showGame(character: CharacterSummary): Promise<void> {
  await teardown();
  gameInstance = await startGameScene(root!, character);

  topbar = document.createElement("div");
  topbar.className = "topbar";
  topbar.innerHTML = `
    <div class="topbar-name">jugando como <strong>${escapeHtml(character.name)}</strong> · nivel ${character.level}</div>
    <button class="logout-btn" id="topbar-back">Volver a personajes</button>
  `;
  document.body.appendChild(topbar);
  topbar.querySelector<HTMLButtonElement>("#topbar-back")?.addEventListener("click", () => {
    void showCharacters();
  });
}

async function bootstrap(): Promise<void> {
  const token = getToken();
  if (!token) {
    await showLogin();
    return;
  }
  // Verificamos el token con un GET /characters; si 401, vamos a login.
  try {
    await listCharacters();
    await showCharacters();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
    }
    await showLogin();
  }
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

bootstrap().catch((err) => {
  console.error("[ao-client] bootstrap fallido:", err);
});
