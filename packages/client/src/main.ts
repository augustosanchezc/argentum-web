import "./style.css";
import * as Sentry from "@sentry/browser";
import { loadItemOverrides } from "@ao/shared";
import { ApiError, type CharacterSummary, listCharacters } from "./api";
import { clearToken, getToken } from "./auth";

// Sentry se activa solo si la variable de entorno está definida en build time.
// Para producción: VITE_SENTRY_DSN=https://xxx@sentry.io/yyy pnpm build
const sentryDsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    integrations: [Sentry.browserTracingIntegration()],
  });
}
import { renderLogin } from "./ui/login";
import { renderHome } from "./ui/home";
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
    void showHome();
  });
}

async function showHome(): Promise<void> {
  await teardown();
  cleanup = renderHome(root!, {
    onEnterWorld: () => { void showCharacters(); },
    onLogout: () => {
      clearToken();
      void showLogin();
    },
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
  gameInstance = await startGameScene(
    root!,
    character,
    () => {
      clearToken();
      void showLogin();
    },
    () => {
      // "Cambiar personaje" desde el panel del juego.
      void showCharacters();
    },
  );
}

async function bootstrap(): Promise<void> {
  // Overrides de items editados en el panel admin: para mostrar los mismos
  // valores (nombre, daño, defensa…) que usa el server. No es crítico.
  try {
    const res = await fetch("/item-overrides");
    if (res.ok) loadItemOverrides((await res.json()) as Record<string, never>);
  } catch {
    // sin overrides / server no disponible: se usa el balance base
  }

  const token = getToken();
  if (!token) {
    await showLogin();
    return;
  }
  // Verificamos el token con un GET /characters; si 401, vamos a login.
  try {
    await listCharacters();
    await showHome();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
    }
    await showLogin();
  }
}

bootstrap().catch((err) => {
  console.error("[ao-client] bootstrap fallido:", err);
});
