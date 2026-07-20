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

  const wrap = document.createElement("div");
  wrap.className = "lp-root";

  function render(): void {
    const isLogin = mode === "login";
    wrap.innerHTML = `
      <div class="lp-header">
        <div class="lp-brand">
          <div class="lp-logo"></div>
          <span class="lp-word">AOTUM</span>
          <span class="lp-beta">BETA</span>
        </div>
        <button type="button" class="lp-backlink" id="auth-toggle">
          ${isLogin ? "← Volver al inicio" : "← Volver a iniciar sesión"}
        </button>
      </div>

      <div class="lp-two-col">
        <div class="lp-visual">
          <span class="lp-mono">[ arte / screenshot del mundo ]</span>
          <div class="lp-eyebrow">EL MUNDO TE ESPERA</div>
          <div class="lp-visual-title">Retomá donde<br>lo dejaste</div>
        </div>

        <div class="lp-formcol">
          <form class="lp-form" id="auth-form" novalidate>
            <div>
              <h1>${isLogin ? "Iniciar sesión" : "Crear cuenta"}</h1>
              <p class="lp-form-sub">${isLogin ? "Entrá con tu cuenta para jugar." : "Creá tu cuenta para empezar a jugar."}</p>
            </div>

            <div class="lp-error" id="login-error" style="display:none"></div>

            <div class="lp-field">
              <label class="lp-label" for="auth-email">EMAIL</label>
              <input class="lp-input" id="auth-email" type="email" required minlength="3" maxlength="254"
                     placeholder="tu@email.com" autocomplete="email" />
            </div>

            <div class="lp-field">
              <div class="lp-label-row">
                <label class="lp-label" for="auth-password">CONTRASEÑA</label>
                ${isLogin ? `<a class="lp-link" data-forgot>¿La olvidaste?</a>` : ""}
              </div>
              <input class="lp-input" id="auth-password" type="password" required minlength="8" maxlength="200"
                     placeholder="${isLogin ? "••••••••" : "Al menos 8 caracteres"}" autocomplete="${isLogin ? "current-password" : "new-password"}" />
            </div>

            ${!isLogin ? `
            <label class="lp-consent">
              <input type="checkbox" id="auth-consent" required />
              <span>Acepto los
                <a href="/docs/legal/terminos" target="_blank" rel="noopener noreferrer">Términos de Uso</a>
                y la
                <a href="/docs/legal/privacidad" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
              </span>
            </label>
            ${TURNSTILE_SITEKEY ? `<div class="cf-turnstile" data-sitekey="${TURNSTILE_SITEKEY}"></div>` : ""}
            ` : ""}

            <button type="submit" class="lp-cta lp-cta--full" id="auth-submit">
              ${isLogin ? "ENTRAR" : "CREAR CUENTA Y ENTRAR"}
            </button>

            <div class="lp-divider">
              <span></span><em>${isLogin ? "¿PRIMERA VEZ?" : "¿YA TENÉS CUENTA?"}</em><span></span>
            </div>

            <button type="button" class="lp-ghost" id="auth-secondary">
              ${isLogin ? "Crear cuenta y personaje" : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </div>
    `;

    const form = wrap.querySelector<HTMLFormElement>("#auth-form")!;
    const emailInput = wrap.querySelector<HTMLInputElement>("#auth-email")!;
    const passwordInput = wrap.querySelector<HTMLInputElement>("#auth-password")!;
    const submitBtn = wrap.querySelector<HTMLButtonElement>("#auth-submit")!;
    const errorBox = wrap.querySelector<HTMLDivElement>("#login-error")!;
    const toggleBtn = wrap.querySelector<HTMLButtonElement>("#auth-toggle")!;
    const secondaryBtn = wrap.querySelector<HTMLButtonElement>("#auth-secondary")!;
    const consentCheckbox = wrap.querySelector<HTMLInputElement>("#auth-consent");

    emailInput.focus();
    if (!isLogin) ensureTurnstileScript();

    const toggle = (): void => {
      mode = mode === "login" ? "register" : "login";
      render();
    };
    toggleBtn.addEventListener("click", toggle);
    secondaryBtn.addEventListener("click", toggle);

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
        submitBtn.textContent = mode === "login" ? "ENTRAR" : "CREAR CUENTA Y ENTRAR";
      }
    });
  }

  render();
  root.appendChild(wrap);

  return () => {
    wrap.remove();
  };
}
