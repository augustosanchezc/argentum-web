function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function optionalInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env var ${name} is not a valid integer: ${value}`);
  }
  return parsed;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  logLevel: optional("LOG_LEVEL", "info"),
  server: {
    host: optional("SERVER_HOST", "0.0.0.0"),
    port: optionalInt("SERVER_PORT", 3000),
  },
  database: {
    url: required("DATABASE_URL"),
  },
  jwt: {
    secret: required("JWT_SECRET"),
    ttlSeconds: optionalInt("JWT_TTL_SECONDS", 86400),
  },
  bcrypt: {
    rounds: optionalInt("BCRYPT_ROUNDS", 12),
  },
  sentry: {
    dsn: optional("SENTRY_DSN", ""),
  },
  // Email a promover a Dios/Admin (role 3) al arrancar — bootstrap del
  // primer administrador del panel.
  adminEmail: optional("ADMIN_EMAIL", ""),
  // Allowlist de IPs para el panel /admin (coma-separadas). Vacío = sin
  // restricción por IP (dev). En prod, poner la(s) IP(s) del admin.
  adminIpAllowlist: optional("ADMIN_IP_ALLOWLIST", ""),
  // Cloudflare Turnstile (captcha del registro). Secreto vacío = captcha
  // desactivado (dev). En prod, setear el secret del widget.
  turnstile: {
    secret: optional("TURNSTILE_SECRET", ""),
  },
} as const;

export type AppEnv = typeof env;
