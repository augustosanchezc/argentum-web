import * as Sentry from "@sentry/node";
import { env } from "./config/env.js";

// Inicializar Sentry solo si SENTRY_DSN está configurado.
// En desarrollo es vacío y Sentry queda deshabilitado.
export function initSentry(): void {
  if (!env.sentry.dsn) return;

  Sentry.init({
    dsn: env.sentry.dsn,
    environment: env.nodeEnv,
    // Captura el 100% de las transacciones en producción.
    // Ajustar hacia abajo si el volumen es alto.
    tracesSampleRate: env.nodeEnv === "production" ? 0.1 : 1.0,
  });
}

export { Sentry };
