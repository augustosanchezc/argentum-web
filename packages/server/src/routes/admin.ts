import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { eq, ilike, sql } from "drizzle-orm";
import { ITEMS, getItem, type InventorySlot } from "@ao/shared";
import { db } from "../db/index.js";
import { accounts } from "../db/schema/accounts.js";
import { characters } from "../db/schema/characters.js";
import { guilds } from "../db/schema/guilds.js";
import { sessions } from "../ws/sessions.js";
import { NPC_DEFS } from "../world/npcs.generated.js";
import { getEffectiveNpcDef, setNpcOverride, getNpcType, resetAllNpcExp } from "../world/npcs.js";
import { setItemOverridePersisted } from "../world/item-overrides.js";
import { getGameConfig, setIntervals, resetIntervals } from "../world/game-config.js";
import { getMapSpawnConfig, setMapSpawnConfig } from "../world/map-spawns.js";
import { loadedMapIds, getMap } from "../world/maps.js";
import { env } from "../config/env.js";
import { addItem } from "../world/inventory.js";
import { PANEL_HTML } from "./admin-panel.js";

// Panel de administración de personajes y GMs.
// Jerarquía del AO: 0 jugador · 1 Consejero · 2 Semidiós · 3 Dios/Admin.
// Lectura: role >= 1 · kick: role >= 2 · mutaciones (roles, stats): role 3.

interface JwtPayload {
  accountId: number;
  email: string;
}

// Verifica el JWT y lee el role FRESCO de la DB (una promoción desde el
// panel vale sin re-login).
async function requireRole(
  req: FastifyRequest,
  reply: FastifyReply,
  minRole: number,
): Promise<{ accountId: number; role: number } | null> {
  try {
    await req.jwtVerify();
  } catch {
    await reply.code(401).send({ error: "INVALID_TOKEN" });
    return null;
  }
  const payload = req.user as JwtPayload;
  const [acc] = await db
    .select({ role: accounts.role })
    .from(accounts)
    .where(eq(accounts.id, payload.accountId));
  if (!acc || acc.role < minRole) {
    await reply.code(403).send({ error: "FORBIDDEN" });
    return null;
  }
  return { accountId: payload.accountId, role: acc.role };
}

export const registerAdminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Defensa en profundidad: allowlist de IPs para TODO /admin (panel + API).
  // Si ADMIN_IP_ALLOWLIST está vacío (dev), no restringe. En prod, además,
  // Caddy filtra por IP delante. trustProxy da la IP real detrás del proxy.
  const adminAllowlist = env.adminIpAllowlist.split(",").map((s) => s.trim()).filter(Boolean);
  if (adminAllowlist.length > 0) {
    app.addHook("onRequest", async (req, reply) => {
      if (!adminAllowlist.includes(req.ip)) {
        await reply.code(403).send({ error: "IP_NOT_ALLOWED" });
      }
    });
  }

  // ── Panel (HTML servido por el server — sin build del cliente) ─────────
  app.get("/", async (_req, reply) => {
    await reply.header("content-type", "text/html; charset=utf-8").send(PANEL_HTML);
  });

  // ── API ────────────────────────────────────────────────────────────────
  app.get<{ Querystring: { search?: string } }>("/api/characters", async (req, reply) => {
    const auth = await requireRole(req, reply, 3);
    if (!auth) return;
    const search = (req.query.search ?? "").trim();
    const base = db
      .select({
        id: characters.id,
        name: characters.name,
        level: characters.level,
        classId: characters.classId,
        gold: characters.gold,
        faction: characters.faction,
        guildId: characters.guildId,
        mapId: characters.mapId,
        accountId: characters.accountId,
        email: accounts.email,
        role: accounts.role,
        guildName: guilds.name,
      })
      .from(characters)
      .innerJoin(accounts, eq(characters.accountId, accounts.id))
      .leftJoin(guilds, eq(characters.guildId, guilds.id))
      .orderBy(sql`${characters.level} DESC`)
      .limit(200);
    const rows = search
      ? await base.where(ilike(characters.name, `%${search}%`))
      : await base;
    return reply.send(
      rows.map((r) => ({ ...r, online: sessions.getByCharacterId(r.id) !== undefined })),
    );
  });

  app.get("/api/online", async (req, reply) => {
    const auth = await requireRole(req, reply, 3);
    if (!auth) return;
    const out = [];
    for (const s of sessions.all()) {
      out.push({
        characterId: s.characterId,
        name: s.characterName,
        level: s.level,
        mapId: s.mapId,
        x: s.position.x,
        y: s.position.y,
        hp: s.hp,
        maxHp: s.maxHp,
      });
    }
    return reply.send(out);
  });

  app.post<{ Params: { id: string }; Body: { role: number } }>(
    "/api/accounts/:id/role",
    {
      schema: {
        body: {
          type: "object",
          required: ["role"],
          additionalProperties: false,
          properties: { role: { type: "integer", minimum: 0, maximum: 3 } },
        },
      },
    },
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      const accountId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(accountId)) return reply.code(400).send({ error: "BAD_ID" });
      if (accountId === auth.accountId && req.body.role < 3) {
        return reply.code(400).send({ error: "NO_SELF_DEMOTE" });
      }
      const updated = await db
        .update(accounts)
        .set({ role: req.body.role })
        .where(eq(accounts.id, accountId))
        .returning({ id: accounts.id, role: accounts.role });
      if (updated.length === 0) return reply.code(404).send({ error: "NOT_FOUND" });
      // Sesiones online de esa cuenta: el role in-game se actualiza en vivo.
      for (const s of sessions.all()) {
        if (s.accountId === accountId) s.role = req.body.role;
      }
      return reply.send(updated[0]);
    },
  );

  // Campos escalares editables del personaje: clave → [min, max]. La clave es
  // la del schema Drizzle (int_ = columna "int"). Los que se sincronizan en vivo
  // a la sesión online están en LIVE_FIELDS; posición/hambre se aplican al reloguear.
  const EDITABLE: Record<string, [number, number]> = {
    gold: [0, 2_000_000_000], level: [1, 47], xp: [0, 2_000_000_000],
    hp: [0, 1_000_000], maxHp: [1, 1_000_000], mana: [0, 1_000_000], maxMana: [0, 1_000_000],
    str: [1, 99], agi: [1, 99], int_: [1, 99], con: [1, 99], car: [1, 99],
    statPoints: [0, 9999], hunger: [0, 100], thirst: [0, 100], faction: [0, 2],
    mapId: [1, 1000], posX: [1, 100], posY: [1, 100], bodyId: [0, 100_000], headId: [0, 100_000],
  };
  const LIVE_FIELDS = new Set([
    "gold", "level", "xp", "hp", "maxHp", "mana", "maxMana",
    "str", "agi", "int_", "con", "car", "statPoints", "faction",
  ]);

  app.post<{ Params: { id: string }; Body: Record<string, number> }>(
    "/api/characters/:id/update",
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      const characterId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(characterId)) return reply.code(400).send({ error: "BAD_ID" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {};
      for (const [key, val] of Object.entries(req.body ?? {})) {
        const range = EDITABLE[key];
        if (!range || typeof val !== "number" || !Number.isFinite(val)) continue;
        patch[key] = Math.max(range[0], Math.min(Math.round(val), range[1]));
      }
      if (Object.keys(patch).length === 0) return reply.code(400).send({ error: "EMPTY" });
      const updated = await db
        .update(characters)
        .set(patch)
        .where(eq(characters.id, characterId))
        .returning({ id: characters.id });
      if (updated.length === 0) return reply.code(404).send({ error: "NOT_FOUND" });
      // Sincronizar a la sesión online los campos escalares seguros.
      const online = sessions.getByCharacterId(characterId);
      if (online) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = online as any;
        for (const [k, v] of Object.entries(patch)) {
          if (LIVE_FIELDS.has(k) && k in s) s[k] = v;
        }
      }
      return reply.send({ id: characterId, applied: patch, online: online !== undefined });
    },
  );

  // Detalle completo de un personaje (para la ficha de edición).
  app.get<{ Params: { id: string } }>("/api/characters/:id", async (req, reply) => {
    const auth = await requireRole(req, reply, 3);
    if (!auth) return;
    const characterId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(characterId)) return reply.code(400).send({ error: "BAD_ID" });
    const [row] = await db
      .select()
      .from(characters)
      .innerJoin(accounts, eq(characters.accountId, accounts.id))
      .where(eq(characters.id, characterId));
    if (!row) return reply.code(404).send({ error: "NOT_FOUND" });
    return reply.send({
      ...row.characters,
      email: row.accounts.email,
      role: row.accounts.role,
      online: sessions.getByCharacterId(characterId) !== undefined,
    });
  });

  // Dar un item al personaje (se apila si corresponde). Online: se aplica al reloguear.
  app.post<{ Params: { id: string }; Body: { item: number; qty: number } }>(
    "/api/characters/:id/give",
    {
      schema: {
        body: {
          type: "object", required: ["item", "qty"], additionalProperties: false,
          properties: {
            item: { type: "integer", minimum: 1 },
            qty: { type: "integer", minimum: 1, maximum: 10_000 },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      const characterId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(characterId)) return reply.code(400).send({ error: "BAD_ID" });
      if (!getItem(req.body.item)) return reply.code(400).send({ error: "NO_SUCH_ITEM" });
      const [row] = await db
        .select({ inv: characters.inventory })
        .from(characters)
        .where(eq(characters.id, characterId));
      if (!row) return reply.code(404).send({ error: "NOT_FOUND" });
      const newInv = addItem(row.inv as InventorySlot[], req.body.item, req.body.qty);
      await db.update(characters).set({ inventory: newInv }).where(eq(characters.id, characterId));
      const online = sessions.getByCharacterId(characterId);
      if (online) online.inventory = addItem(online.inventory, req.body.item, req.body.qty);
      return reply.send({ id: characterId, item: req.body.item, qty: req.body.qty, online: online !== undefined });
    },
  );

  // ── Catálogo de items (NPCs.dat / obj.dat reales del AO) ────────────────
  app.get<{ Querystring: { search?: string; type?: string } }>("/api/items", async (req, reply) => {
    const auth = await requireRole(req, reply, 3);
    if (!auth) return;
    const q = (req.query.search ?? "").trim().toLowerCase();
    const typeFilter = (req.query.type ?? "").trim();
    const out = [];
    for (const idStr of Object.keys(ITEMS)) {
      const id = Number(idStr);
      const d = getItem(id); // valores EFECTIVOS (base + override)
      if (!d) continue;
      if (typeFilter && d.type !== typeFilter) continue;
      if (q && !d.name.toLowerCase().includes(q) && idStr !== q) continue;
      out.push({
        id, name: d.name, type: d.type, objType: d.objType, value: d.value, graphic: d.graphic,
        minHit: d.minHit ?? 0, maxHit: d.maxHit ?? 0, defense: d.defense ?? 0,
        heal: d.heal ?? 0, manaHeal: d.manaHeal ?? 0, damageBonus: d.damageBonus ?? 0,
      });
      if (out.length >= 400) break;
    }
    return reply.send(out);
  });

  // Editar un item (persiste un override sobre obj.dat). Afecta el balance del
  // server al instante; el cliente lo toma al reconectar (pide /item-overrides).
  const ITEM_EDITABLE: Record<string, [number, number]> = {
    value: [0, 2_000_000_000], minHit: [0, 1_000_000], maxHit: [0, 1_000_000],
    defense: [0, 1_000_000], heal: [0, 1_000_000], manaHeal: [0, 1_000_000], damageBonus: [0, 1_000_000],
  };
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/items/:id/update",
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || !ITEMS[id]) return reply.code(404).send({ error: "NOT_FOUND" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {};
      const body = req.body ?? {};
      if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 60);
      for (const [key, range] of Object.entries(ITEM_EDITABLE)) {
        const v = body[key];
        if (typeof v === "number" && Number.isFinite(v)) {
          patch[key] = Math.max(range[0], Math.min(Math.round(v), range[1]));
        }
      }
      if (Object.keys(patch).length === 0) return reply.code(400).send({ error: "EMPTY" });
      setItemOverridePersisted(id, patch);
      return reply.send({ id, applied: patch });
    },
  );

  // ── Catálogo de NPCs y Criaturas (NPCs.dat real del AO + overrides) ─────
  // "Criatura" = monstruo/animal (npcType 0, no comercia); "NPC" = interactivo
  // (vendedor, banquero, sacerdote, guardia, especial). Filtra por ?kind=.
  const isCreature = (npcType: number, comercia: boolean): boolean => npcType === 0 && !comercia;

  app.get<{ Querystring: { search?: string; kind?: string; hostile?: string } }>("/api/npcs", async (req, reply) => {
    const auth = await requireRole(req, reply, 3);
    if (!auth) return;
    const q = (req.query.search ?? "").trim().toLowerCase();
    const kind = req.query.kind; // "creature" | "npc" | undefined
    const hostile = req.query.hostile; // "1" | "0" | undefined (filtro)
    const out = [];
    for (const numStr of Object.keys(NPC_DEFS)) {
      const number = Number(numStr);
      const d = getEffectiveNpcDef(number);
      if (!d) continue;
      const creature = isCreature(d.npcType, d.comercia);
      if (kind === "creature" && !creature) continue;
      if (kind === "npc" && creature) continue;
      if (hostile === "1" && !d.hostile) continue;
      if (hostile === "0" && d.hostile) continue;
      if (q && !d.name.toLowerCase().includes(q) && numStr !== q) continue;
      const shopIds = d.shopItems ?? [];
      out.push({
        number, name: d.name, npcType: d.npcType, kind: creature ? "creature" : "npc",
        body: d.body, head: d.head,
        maxHp: d.maxHp, minHit: d.minHit, maxHit: d.maxHit, def: d.def,
        giveExp: d.giveExp, giveGld: d.giveGld, poderAtaque: d.poderAtaque, poderEvasion: d.poderEvasion,
        movement: d.movement, hostile: d.hostile, comercia: d.comercia, shopItems: shopIds,
        // Items que vende, con nombre resuelto (para el editor de vendedores).
        shop: shopIds.map((id) => ({ id, name: getItem(id)?.name ?? ("#" + id.toString()) })),
        // Tabla de drops con nombre y probabilidad (chance por posición, override-able).
        drops: (d.drops ?? []).map((dr, i) => ({
          item: dr.item,
          qty: dr.qty,
          chance: (dr as { chance?: number }).chance ?? [0.6, 0.35, 0.2, 0.1, 0.05][i] ?? 0.05,
          name: getItem(dr.item)?.name ?? ("#" + dr.item.toString()),
        })),
      });
      if (out.length >= 500) break;
    }
    return reply.send(out);
  });

  // Editar una criatura/NPC (persiste un override sobre NPCs.dat). Los NPCs que
  // aparezcan después usan los nuevos valores.
  const NPC_EDITABLE: Record<string, [number, number]> = {
    maxHp: [1, 100_000_000], minHit: [0, 1_000_000], maxHit: [0, 1_000_000], def: [0, 1_000_000],
    giveExp: [0, 2_000_000_000], giveGld: [0, 2_000_000_000],
    poderAtaque: [0, 1_000_000], poderEvasion: [0, 1_000_000], movement: [0, 4],
  };
  app.post<{ Params: { number: string }; Body: Record<string, unknown> }>(
    "/api/npcs/:number/update",
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      const number = Number.parseInt(req.params.number, 10);
      if (!Number.isFinite(number)) return reply.code(400).send({ error: "BAD_NUMBER" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {};
      const body = req.body ?? {};
      if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 60);
      if (typeof body.hostile === "boolean") patch.hostile = body.hostile;
      for (const [key, range] of Object.entries(NPC_EDITABLE)) {
        const v = body[key];
        if (typeof v === "number" && Number.isFinite(v)) {
          patch[key] = Math.max(range[0], Math.min(Math.round(v), range[1]));
        }
      }
      // Items que vende el NPC (vendedor): lista de códigos de item válidos.
      if (Array.isArray(body.shopItems)) {
        const ids: number[] = [];
        for (const raw of body.shopItems) {
          const id = Number(raw);
          if (Number.isFinite(id) && id > 0 && getItem(id) && !ids.includes(id)) ids.push(id);
          if (ids.length >= 60) break;
        }
        patch.shopItems = ids;
      }
      // Tabla de drops: [{ item, qty, chance }]. Se guarda entera como override.
      if (Array.isArray(body.drops)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drops: Array<{ item: number; qty: number; chance: number }> = [];
        for (const raw of body.drops as Array<Record<string, unknown>>) {
          const item = Number(raw.item);
          const qty = Number(raw.qty);
          const chance = Number(raw.chance);
          if (!Number.isFinite(item) || item <= 0 || !getItem(item)) continue;
          drops.push({
            item,
            qty: Math.max(1, Math.min(Math.round(Number.isFinite(qty) ? qty : 1), 100_000)),
            chance: Math.max(0, Math.min(Number.isFinite(chance) ? chance : 0.5, 1)),
          });
          if (drops.length >= 5) break; // MAX_NPC_DROPS del AO
        }
        patch.drops = drops;
      }
      if (Object.keys(patch).length === 0) return reply.code(400).send({ error: "EMPTY" });
      const eff = setNpcOverride(number, patch);
      if (!eff) return reply.code(404).send({ error: "NOT_FOUND" });
      return reply.send({ number, applied: patch });
    },
  );

  // Multiplicar exp y oro de TODAS las criaturas (o NPCs) por un factor, de una
  // sola vez. Multiplica los valores EFECTIVOS actuales (repetir compone). Se
  // guarda como override, así el original queda intacto (borrable).
  app.post<{ Body: { mult: number; onlyCreatures?: boolean; exp?: boolean; gold?: boolean } }>(
    "/api/npcs/bulk-multiply",
    {
      schema: {
        body: {
          type: "object", required: ["mult"], additionalProperties: false,
          properties: {
            mult: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
            onlyCreatures: { type: "boolean" },
            exp: { type: "boolean" },
            gold: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      const mult = req.body.mult;
      const onlyCreatures = req.body.onlyCreatures !== false; // default: sólo criaturas
      const doExp = req.body.exp !== false; // default: sí
      const doGold = req.body.gold !== false; // default: sí
      let count = 0;
      for (const numStr of Object.keys(NPC_DEFS)) {
        const number = Number(numStr);
        const d = getEffectiveNpcDef(number);
        if (!d) continue;
        if (onlyCreatures && !isCreature(d.npcType, d.comercia)) continue;
        if ((d.giveExp ?? 0) === 0 && (d.giveGld ?? 0) === 0) continue; // sin recompensa: nada que multiplicar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch: Record<string, any> = {};
        if (doExp) patch.giveExp = Math.min(2_000_000_000, Math.round((d.giveExp ?? 0) * mult));
        if (doGold) patch.giveGld = Math.min(2_000_000_000, Math.round((d.giveGld ?? 0) * mult));
        if (Object.keys(patch).length === 0) continue;
        setNpcOverride(number, patch);
        count++;
      }
      return reply.send({ count, mult });
    },
  );

  // Guardar en lote la experiencia editada de varias criaturas de una sola vez
  // (botón "Guardar todo" de la solapa Criaturas). { values: { "<num>": exp } }.
  app.post<{ Body: { values: Record<string, number> } }>(
    "/api/npcs/bulk-set-exp",
    {
      schema: {
        body: {
          type: "object", required: ["values"], additionalProperties: false,
          properties: { values: { type: "object", additionalProperties: { type: "number" } } },
        },
      },
    },
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      let count = 0;
      for (const [numStr, raw] of Object.entries(req.body.values)) {
        const number = Number(numStr);
        if (!Number.isFinite(number) || !NPC_DEFS[number]) continue;
        const exp = Math.round(Number(raw));
        if (!Number.isFinite(exp)) continue;
        setNpcOverride(number, { giveExp: Math.max(0, Math.min(exp, 2_000_000_000)) });
        count++;
      }
      return reply.send({ count });
    },
  );

  // Volver la experiencia de TODAS las criaturas a los valores originales de
  // AO Libre (borra sólo el override de giveExp). Botón "Exp original".
  app.post("/api/npcs/reset-exp", async (req, reply) => {
    const auth = await requireRole(req, reply, 3);
    if (!auth) return;
    const count = resetAllNpcExp();
    return reply.send({ count });
  });

  // ── Ajustes de jugabilidad (intervalos) — solapa "Ajustes" del panel ──
  app.get("/api/config", async (req, reply) => {
    const auth = await requireRole(req, reply, 3);
    if (!auth) return;
    return reply.send({ intervals: getGameConfig() });
  });

  app.post<{ Body: { intervals?: Record<string, unknown>; reset?: boolean } }>(
    "/api/config/update",
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      const body = req.body ?? {};
      if (body.reset) resetIntervals();
      else if (body.intervals) setIntervals(body.intervals);
      else return reply.code(400).send({ error: "EMPTY" });
      return reply.send({ intervals: getGameConfig() });
    },
  );

  // ── Respawn aleatorio de criaturas por mapa — solapa "Spawns" ──────────
  // Lista de mapas con criaturas (para elegir) + catálogo de criaturas (pool).
  app.get("/api/map-spawns", async (req, reply) => {
    const auth = await requireRole(req, reply, 3);
    if (!auth) return;

    // Catálogo de criaturas de caza (NpcType 0, no comercia) para el pool.
    const creatures: Array<{ number: number; name: string }> = [];
    for (const numStr of Object.keys(NPC_DEFS)) {
      const number = Number(numStr);
      const t = getNpcType(number);
      if (t && t.isCreature) creatures.push({ number, name: t.name });
    }
    creatures.sort((a, b) => a.name.localeCompare(b.name, "es"));

    // Mapas cargados que tienen al menos una criatura nativa (o config previa).
    const maps: Array<{
      id: number; name: string; natives: number[]; enabled: boolean; pool: number[];
    }> = [];
    for (const id of loadedMapIds()) {
      const map = getMap(id);
      if (!map) continue;
      const nativeSet = new Set<number>();
      for (const sp of map.npcSpawns) {
        const t = getNpcType(sp.npcNumber);
        if (t && t.isCreature) nativeSet.add(sp.npcNumber);
      }
      const cfg = getMapSpawnConfig(id);
      if (nativeSet.size === 0 && !cfg) continue;
      maps.push({
        id,
        name: map.name,
        natives: Array.from(nativeSet).sort((a, b) => a - b),
        enabled: cfg?.enabled ?? false,
        pool: cfg?.pool ?? [],
      });
    }
    maps.sort((a, b) => a.id - b.id);

    return reply.send({ maps, creatures });
  });

  app.post<{ Body: { mapId?: number; enabled?: boolean; pool?: number[] } }>(
    "/api/map-spawns/update",
    async (req, reply) => {
      const auth = await requireRole(req, reply, 3);
      if (!auth) return;
      const body = req.body ?? {};
      const mapId = Number(body.mapId);
      if (!Number.isFinite(mapId) || !getMap(mapId)) return reply.code(400).send({ error: "BAD_MAP" });
      const pool = Array.isArray(body.pool) ? body.pool.map(Number).filter((n) => Number.isFinite(n)) : [];
      const cfg = setMapSpawnConfig(mapId, !!body.enabled, pool);
      return reply.send({ mapId, ...cfg });
    },
  );

  app.post<{ Params: { id: string } }>("/api/characters/:id/kick", async (req, reply) => {
    const auth = await requireRole(req, reply, 2);
    if (!auth) return;
    const characterId = Number.parseInt(req.params.id, 10);
    const s = sessions.getByCharacterId(characterId);
    if (!s) return reply.code(404).send({ error: "NOT_ONLINE" });
    try {
      s.socket.close(4009, "KICKED_BY_ADMIN");
    } catch {
      // ignorar
    }
    return reply.send({ kicked: characterId });
  });
};
