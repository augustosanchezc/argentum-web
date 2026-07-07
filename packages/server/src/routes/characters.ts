import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { characters } from "../db/schema/characters.js";
import { calcInitialStats } from "../world/classes.js";

const NAME_RE = /^[a-zA-Z0-9]{3,16}$/u;
const MAX_CHARACTERS_PER_ACCOUNT = 3;
const VALID_CLASS_IDS = [1, 2, 3, 4, 5, 6];

interface CreateCharacterBody {
  name: string;
  classId?: number;
}

const createCharacterSchema = {
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 3, maxLength: 16 },
      classId: { type: "integer", minimum: 1, maximum: 6 },
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
          classId: characters.classId,
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
      const classId = req.body.classId ?? 1;

      if (!NAME_RE.test(name)) {
        return reply.code(400).send({ error: "INVALID_NAME" });
      }

      if (!VALID_CLASS_IDS.includes(classId)) {
        return reply.code(400).send({ error: "INVALID_CLASS" });
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

      const init = calcInitialStats(classId);

      const [character] = await db
        .insert(characters)
        .values({
          accountId,
          name,
          level: 1,
          classId: init.classId,
          str: init.str,
          agi: init.agi,
          int_: init.int_,
          con: init.con,
          car: init.car,
          maxHp: init.maxHp,
          hp: init.maxHp,
          maxMana: init.maxMana,
          mana: init.maxMana,
          bodyId: init.bodyId,
          headId: init.headId,
        })
        .returning({
          id: characters.id,
          name: characters.name,
          level: characters.level,
          classId: characters.classId,
          createdAt: characters.createdAt,
        });

      if (!character) {
        return reply.code(500).send({ error: "INSERT_FAILED" });
      }

      return reply.code(201).send(character);
    },
  );
};
