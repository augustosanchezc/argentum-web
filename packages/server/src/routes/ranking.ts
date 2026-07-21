import type { FastifyPluginAsync } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { characters } from "../db/schema/characters.js";

// Ranking PÚBLICO (sin auth, se ve en la landing): top 50 personajes por NIVEL o
// por KILLS PvP (citizensKilled + criminalsKilled), opcionalmente filtrado por
// clase (classId 1-7). Se registra con prefijo /ranking en app.ts.
export const registerRankingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { sort?: string; classId?: string } }>("/", async (req) => {
    const sort = req.query.sort === "kills" ? "kills" : "level";
    const classIdRaw = req.query.classId ? Number.parseInt(req.query.classId, 10) : NaN;
    const classId =
      Number.isInteger(classIdRaw) && classIdRaw >= 1 && classIdRaw <= 7 ? classIdRaw : undefined;

    const kills = sql<number>`${characters.citizensKilled} + ${characters.criminalsKilled}`;
    const rows = await db
      .select({
        name: characters.name,
        level: characters.level,
        classId: characters.classId,
        kills,
      })
      .from(characters)
      .where(classId ? eq(characters.classId, classId) : undefined)
      .orderBy(
        ...(sort === "kills"
          ? [desc(kills), desc(characters.level)]
          : [desc(characters.level), desc(characters.xp)]),
      )
      .limit(50);

    return { ranking: rows };
  });
};
