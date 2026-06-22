import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { characters } from "../db/schema/characters.js";

const NAME_RE = /^[a-zA-Z0-9]{3,16}$/u;
const MAX_CHARACTERS_PER_ACCOUNT = 3;

interface CreateCharacterBody {
  name: string;
}

const createCharacterSchema = {
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 3, maxLength: 16 },
    },
  },
} as const;

// eslint-disable-next-line @typescript-eslint/require-await
export const registerCharactersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/",
    { preHandler: [app.authenticate] },
    async (req) => {
      const { accountId } = req.user;
      const rows = await db
        .select({
          id: characters.id,
          name: characters.name,
          level: characters.level,
          createdAt: characters.createdAt,
        })
        .from(characters)
        .where(eq(characters.accountId, accountId))
        .orderBy(characters.id);
      return { characters: rows };
    },
  );

  app.post<{ Body: CreateCharacterBody }>(
    "/",
    { preHandler: [app.authenticate], schema: createCharacterSchema },
    async (req, reply) => {
      const { accountId } = req.user;
      const name = req.body.name.trim();

      if (!NAME_RE.test(name)) {
        return reply.code(400).send({ error: "INVALID_NAME" });
      }

      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(characters)
        .where(eq(characters.accountId, accountId));
      const currentCount = countRow?.count ?? 0;
      if (currentCount >= MAX_CHARACTERS_PER_ACCOUNT) {
        return reply.code(409).send({ error: "MAX_CHARACTERS_REACHED" });
      }

      const existing = await db
        .select({ id: characters.id })
        .from(characters)
        .where(eq(sql`lower(${characters.name})`, name.toLowerCase()))
        .limit(1);
      if (existing.length > 0) {
        return reply.code(409).send({ error: "NAME_TAKEN" });
      }

      const [character] = await db
        .insert(characters)
        .values({ accountId, name, level: 1 })
        .returning({
          id: characters.id,
          name: characters.name,
          level: characters.level,
          createdAt: characters.createdAt,
        });

      if (!character) {
        return reply.code(500).send({ error: "INSERT_FAILED" });
      }

      return reply.code(201).send(character);
    },
  );
};
