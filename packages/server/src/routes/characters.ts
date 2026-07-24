import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { initialSkillsFor, isValidHead, RACES, type InventorySlot } from "@ao/shared";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { characters } from "../db/schema/characters.js";
import { calcInitialStatsRaced } from "../world/classes.js";

// Kit de newbie del AO original (items reales de obj.dat, flag Newbie=1):
//   460 Daga · 859 Arco · 861 Espada · 862 Bastón de Mago
//   463 Vestimentas Comunes (ropaje 1) · 857 Poción Roja · 856 Poción Azul
//   467 Manzana Roja · 468 Botella de Agua
// El arma y la armadura arrancan equipadas (el ropaje se ve al entrar).
function newbieKit(classId: number, race: number): {
  inventory: InventorySlot[];
  weapon: number;
  armor: number;
} {
  const weaponByClass: Record<number, number> = {
    1: 861, // Guerrero → Espada (Newbie)
    2: 862, // Mago → Bastón de Mago (Newbie)
    3: 460, // Clérigo → Daga (Newbie)
    4: 859, // Arquero → Arco (Newbie)
    5: 460, // Asesino → Daga (Newbie)
    6: 460, // Druida → Daga (Newbie)
    7: 861, // Paladín → Espada (Newbie)
  };
  const weapon = weaponByClass[classId] ?? 460;
  // Estatura: Enano(5)/Gnomo(4) arrancan con la Túnica (E/G) newbie (body
  // corto) en vez de las Vestimentas Comunes altas (463); si no, el newbie
  // enano no podría re-equipar su propia ropa (regla de talla del AO).
  const armor = race === 4 || race === 5 ? 1045 : 463;
  const usesMana = classId === 2 || classId === 3 || classId === 6 || classId === 7;

  const inventory: InventorySlot[] = [
    { item: weapon, qty: 1 },
    { item: armor, qty: 1 },
    { item: 857, qty: 15 }, // Poción Roja (Newbie)
    { item: 467, qty: 10 }, // Manzana Roja (Newbie)
    { item: 468, qty: 5 },  // Botella de Agua (Newbie)
  ];
  if (usesMana) inventory.push({ item: 856, qty: 15 }); // Poción Azul (Newbie)
  if (classId === 4) inventory.push({ item: 860, qty: 150 }); // Flechas (Newbie)
  // Herramientas de trabajo newbie (hacha, piquete, caña — como el kit
  // de oficios del AO) para poder talar/minar/pescar desde el arranque.
  inventory.push({ item: 561, qty: 1 }, { item: 562, qty: 1 }, { item: 563, qty: 1 });

  return { inventory, weapon, armor };
}

const NAME_RE = /^[a-zA-Z0-9]{3,16}$/u;
const MAX_CHARACTERS_PER_ACCOUNT = 5;
const VALID_CLASS_IDS = [1, 2, 3, 4, 5, 6, 7];

interface CreateCharacterBody {
  name: string;
  classId?: number;
  race?: number;
  gender?: number;
  head?: number;
}

const createCharacterSchema = {
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 3, maxLength: 16 },
      classId: { type: "integer", minimum: 1, maximum: 7 },
      race: { type: "integer", minimum: 1, maximum: 5 },
      gender: { type: "integer", minimum: 1, maximum: 2 },
      head: { type: "integer", minimum: 1, maximum: 1000 },
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
          race: characters.race,
          gender: characters.gender,
          headId: characters.headId,
          bodyId: characters.bodyId,
          macros: characters.macros,
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

      const race = req.body.race ?? 1;
      const gender = req.body.gender ?? 1;
      if (!RACES[race]) return reply.code(400).send({ error: "INVALID_RACE" });
      if (gender !== 1 && gender !== 2) return reply.code(400).send({ error: "INVALID_GENDER" });
      // Cabeza: si no vino o es inválida para la raza+género, usar la primera del rango.
      const headRange = RACES[race].heads[gender === 2 ? 2 : 1];
      const head = req.body.head !== undefined && isValidHead(race, gender, req.body.head)
        ? req.body.head
        : headRange[0];

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

      const init = calcInitialStatsRaced(classId, race, gender, head);
      const kit = newbieKit(classId, race);

      const [character] = await db
        .insert(characters)
        .values({
          accountId,
          name,
          level: 1,
          classId: init.classId,
          race,
          gender,
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
          inventory: kit.inventory,
          equippedWeapon: kit.weapon,
          equippedArmor: kit.armor,
          skills: initialSkillsFor(classId),
          // Sistema de pergaminos (fiel a AO): arranca sin hechizos; los aprende
          // usando pergaminos (objType 24) con doble-click.
          knownSpells: [],
        })
        .returning({
          id: characters.id,
          name: characters.name,
          level: characters.level,
          classId: characters.classId,
          race: characters.race,
          gender: characters.gender,
          headId: characters.headId,
          bodyId: characters.bodyId,
          macros: characters.macros,
          createdAt: characters.createdAt,
        });

      if (!character) {
        return reply.code(500).send({ error: "INSERT_FAILED" });
      }

      return reply.code(201).send(character);
    },
  );

  // Borrar un personaje de la cuenta. El WHERE incluye accountId + el
  // .returning confirma que existía Y era del dueño autenticado, así una cuenta
  // nunca puede borrar personajes de otra. Borrar la fila elimina todo su estado
  // (inventario, banco, hechizos… viven en JSONB de la misma fila); ninguna otra
  // tabla tiene FK a characters, así que no quedan datos huérfanos.
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { accountId } = req.user;
      const charId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(charId) || charId <= 0) {
        return reply.code(400).send({ error: "INVALID_ID" });
      }
      const [deleted] = await db
        .delete(characters)
        .where(and(eq(characters.id, charId), eq(characters.accountId, accountId)))
        .returning({ id: characters.id });
      if (!deleted) {
        return reply.code(404).send({ error: "CHARACTER_NOT_FOUND" });
      }
      return reply.code(204).send();
    },
  );
};
