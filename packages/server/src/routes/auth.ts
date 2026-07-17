import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { accounts } from "../db/schema/accounts.js";
import { env } from "../config/env.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
const EMAIL_MAX = 254;

interface AuthBody {
  email: string;
  password: string;
  turnstileToken?: string;
}

const authBodySchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    additionalProperties: false,
    properties: {
      email: { type: "string", minLength: 3, maxLength: EMAIL_MAX },
      password: { type: "string", minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX },
      // Token del captcha Cloudflare Turnstile (solo lo usa /register).
      turnstileToken: { type: "string", maxLength: 4096 },
    },
  },
} as const;

// Límite estricto anti fuerza-bruta para login/registro (además del backstop
// global). 5 intentos por minuto por IP.
const strictAuthLimit = { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } };

// Verifica el captcha Turnstile contra Cloudflare. Si no hay secret configurado
// (dev), el captcha está desactivado y siempre pasa.
async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!env.turnstile.secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: env.turnstile.secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export const registerAuthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Hash dummy precomputado para que el tiempo de respuesta sea
  // indistinguible entre "email no registrado" y "password incorrecta".
  // Mitiga ataques de enumeracion de usuarios.
  const timingSafeHash = await bcrypt.hash("__timing_safe_placeholder__", env.bcrypt.rounds);

  app.post<{ Body: AuthBody }>(
    "/register",
    { schema: authBodySchema, ...strictAuthLimit },
    async (req, reply) => {
      const email = req.body.email.trim().toLowerCase();
      const { password } = req.body;

      // Captcha anti-bots (Cloudflare Turnstile). Desactivado si no hay secret.
      if (!(await verifyTurnstile(req.body.turnstileToken, req.ip))) {
        return reply.code(403).send({ error: "CAPTCHA_FAILED" });
      }

      if (!EMAIL_RE.test(email)) {
        return reply.code(400).send({ error: "INVALID_EMAIL" });
      }

      const existing = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(sql`lower(${accounts.email})`, email))
        .limit(1);

      if (existing.length > 0) {
        return reply.code(409).send({ error: "EMAIL_TAKEN" });
      }

      const passwordHash = await bcrypt.hash(password, env.bcrypt.rounds);

      const [account] = await db
        .insert(accounts)
        .values({ email, passwordHash })
        .returning({
          id: accounts.id,
          email: accounts.email,
          createdAt: accounts.createdAt,
        });

      if (!account) {
        return reply.code(500).send({ error: "INSERT_FAILED" });
      }

      return reply.code(201).send(account);
    },
  );

  app.post<{ Body: AuthBody }>(
    "/login",
    { schema: authBodySchema, ...strictAuthLimit },
    async (req, reply) => {
      const email = req.body.email.trim().toLowerCase();
      const { password } = req.body;

      const [row] = await db
        .select({
          id: accounts.id,
          email: accounts.email,
          passwordHash: accounts.passwordHash,
          role: accounts.role,
        })
        .from(accounts)
        .where(eq(sql`lower(${accounts.email})`, email))
        .limit(1);

      // Si el email no existe, igual ejecutamos bcrypt.compare contra el
      // hash dummy para que el costo en tiempo sea identico al de un
      // login con email correcto y password mala.
      if (!row) {
        await bcrypt.compare(password, timingSafeHash);
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }

      const match = await bcrypt.compare(password, row.passwordHash);
      if (!match) {
        return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      }

      const token = app.jwt.sign({ accountId: row.id, email: row.email, role: row.role });

      return reply.send({
        token,
        account: { id: row.id, email: row.email, role: row.role },
      });
    },
  );
};
