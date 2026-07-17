import { ApiError, login, register } from "../api";
import { setToken } from "../auth";

type Mode = "login" | "register";

// Captcha Cloudflare Turnstile: si hay site key configurada (prod), el registro
// muestra el widget y exige el token. Sin site key (dev), no aparece.
const TURNSTILE_SITEKEY = (import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined) || "";

let turnstileScriptRequested = false;
function ensureTurnstileScript(): void {
  if (turnstileScriptRequested || !TURNSTILE_SITEKEY) return;
  turnstileScriptRequested = true;
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Email o contraseña incorrectos.",
  EMAIL_TAKEN: "Ya hay una cuenta con ese email.",
  INVALID_EMAIL: "El email no es válido.",
  INVALID_TOKEN: "Sesión expirada. Inicia sesión de nuevo.",
  CAPTCHA_FAILED: "No se pudo verificar el captcha. Probá de nuevo.",
  RATE_LIMITED: "Demasiados intentos. Esperá un minuto y probá de nuevo.",
  UNKNOWN_ERROR: "No se pudo completar la operación. Probá de nuevo.",
};

function humanize(code: string): string {
  return ERROR_MESSAGES[code] ?? `Error: ${code}`;
}

export function renderLogin(root: HTMLElement, onLoggedIn: () => void): () => void {
  let mode: Mode = "login";

  const card = document.createElement("div");
  card.className = "card card-narrow fade-in";

  function render(): void {
    const isLogin = mode === "login";
    card.innerHTML = `
      <div class="brand">
        <div class="brand-title">Argentum Online</div>
        <div class="brand-sub">${isLogin ? "Iniciar sesión" : "Crear cuenta"}</div>
      </div>

      <div class="error-msg" id="login-error" style="display:none"></div>

      <form id="auth-form" novalidate>
        <div class="form-row">
          <label for="auth-email">Email</label>
          <input id="auth-email" type="email" required minlength="3" maxlength="254"
                 placeholder="tu@email.com" autocomplete="email" />
        </div>
        <div class="form-row">
          <label for="auth-password">Contraseña</label>
          <input id="auth-password" type="password" required minlength="8" maxlength="200"
                 placeholder="Al menos 8 caracteres" autocomplete="${isLogin ? "current-password" : "new-password"}" />
        </div>

        ${!isLogin ? `
        <div class="form-row form-row--consent">
          <label class="consent-label">
            <input type="checkbox" id="auth-consent" required />
            Acepto los
            <a href="/docs/legal/terminos" target="_blank" rel="noopener noreferrer">Términos de Uso</a>
            y la
            <a href="/docs/legal/privacidad" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
          </label>
        </div>
        ${TURNSTILE_SITEKEY ? `<div class="form-row"><div class="cf-turnstile" data-sitekey="${TURNSTILE_SITEKEY}"></div></div>` : ""}
        ` : ""}

        <button type="submit" class="button" id="auth-submit">
          ${isLogin ? "Entrar" : "Crear cuenta y entrar"}
        </button>
      </form>

      <div class="divider">o</div>

      <button type="button" class="link-button" id="auth-toggle">
        ${isLogin ? "¿Sos nuevo? Crear cuenta" : "¿Ya tenés cuenta? Iniciar sesión"}
      </button>
    `;

    const form = card.querySelector<HTMLFormElement>("#auth-form")!;
    const emailInput = card.querySelector<HTMLInputElement>("#auth-email")!;
    const passwordInput = card.querySelector<HTMLInputElement>("#auth-password")!;
    const submitBtn = card.querySelector<HTMLButtonElement>("#auth-submit")!;
    const errorBox = card.querySelector<HTMLDivElement>("#login-error")!;
    const toggleBtn = card.querySelector<HTMLButtonElement>("#auth-toggle")!;
    const consentCheckbox = card.querySelector<HTMLInputElement>("#auth-consent");

    emailInput.focus();
    if (!isLogin) ensureTurnstileScript();

    toggleBtn.addEventListener("click", () => {
      mode = mode === "login" ? "register" : "login";
      render();
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errorBox.style.display = "none";
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Validar checkbox de consentimiento en modo registro.
      if (mode === "register" && consentCheckbox && !consentCheckbox.checked) {
        errorBox.textContent = "Debés aceptar los Términos de Uso y la Política de Privacidad.";
        errorBox.style.display = "block";
        return;
      }

      // Captcha Turnstile (solo si hay site key). El widget inyecta un input
      // oculto `cf-turnstile-response` en el form con el token.
      let turnstileToken: string | undefined;
      if (mode === "register" && TURNSTILE_SITEKEY) {
        turnstileToken = form.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value || undefined;
        if (!turnstileToken) {
          errorBox.textContent = "Completá el captcha para continuar.";
          errorBox.style.display = "block";
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "...";

      try {
        if (mode === "register") {
          await register(email, password, turnstileToken);
        }
        const result = await login(email, password);
        setToken(result.token);
        onLoggedIn();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : "UNKNOWN_ERROR";
        errorBox.textContent = humanize(code);
        errorBox.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "login" ? "Entrar" : "Crear cuenta y entrar";
      }
    });
  }

  render();

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.appendChild(card);
  root.appendChild(overlay);

  return () => {
    overlay.remove();
  };
}
