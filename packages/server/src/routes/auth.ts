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

interface RegisterBody {
  email: string;
  password: string;
}

const registerSchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    additionalProperties: false,
    properties: {
      email: { type: "string", minLength: 3, maxLength: EMAIL_MAX },
      password: { type: "string", minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX },
    },
  },
} as const;

// eslint-disable-next-line @typescript-eslint/require-await
export const registerAuthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post<{ Body: RegisterBody }>(
    "/register",
    { schema: registerSchema },
    async (req, reply) => {
      const email = req.body.email.trim().toLowerCase();
      const { password } = req.body;

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
};
