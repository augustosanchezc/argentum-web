import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { getItemOverrides } from "@ao/shared";
import { env } from "./config/env.js";
import { metricsRegistry } from "./metrics.js";
import { getMap, loadedMapIds } from "./world/maps.js";
import { npcs } from "./world/npcs.js";
import { sessions } from "./ws/sessions.js";
// Importar el módulo dispara la carga de data/item-overrides.json al arrancar.
import "./world/item-overrides.js";
// Y la config de jugabilidad editable (intervalos) desde data/game-config.json.
import "./world/game-config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCharactersRoutes } from "./routes/characters.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerWsRoutes } from "./ws/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.logLevel,
    },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: env.nodeEnv === "production" ? false : true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.jwt.secret,
    sign: { expiresIn: `${env.jwt.ttlSeconds}s` },
  });

  await app.register(websocket, {
    options: {
      // Tamano maximo del payload por mensaje (256 KB). Suficiente para
      // los paquetes binarios MessagePack que manejamos.
      maxPayload: 262_144,
    },
  });

  // Rate limiting: backstop global generoso por IP (detrás de Cloudflare/Caddy,
  // trustProxy da la IP real). Los assets estáticos (muchos PNG por login, ya
  // cacheados immutable) se excluyen para no estrangular la carga del mundo.
  // Las rutas sensibles (/auth/login, /auth/register) suman un límite estricto
  // propio vía `config.rateLimit` en sus definiciones.
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    allowList: (req) => req.url.startsWith("/ao-assets"),
  });

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "INVALID_TOKEN" });
    }
  });

  app.get("/health", () => ({
    status: "ok",
    nodeEnv: env.nodeEnv,
    uptime: process.uptime(),
  }));

  // Lista de todos los mapas cargados (id + nombre) para el mapa-mundi del
  // cliente (botón MAPA).
  app.get("/maps", () =>
    loadedMapIds()
      .sort((a, b) => a - b)
      .map((id) => ({ id, name: getMap(id)?.name ?? `Mapa ${id}` })),
  );

  // Overrides de items editados desde el panel admin. El cliente los pide al
  // arrancar para mostrar los mismos valores que usa el server.
  app.get("/item-overrides", () => getItemOverrides());

  // "Foto en vivo" del mundo para el landing: una ventana de tiles alrededor de
  // un punto (default map 1, 50,50) con las 4 capas + las entidades vivas y
  // visibles que hay ahí AHORA. Público y liviano (JSON de una ventana chica);
  // el cliente lo dibuja en un <canvas> con los mismos gráficos del juego y lo
  // refresca cada minuto. `x0/y0` es la esquina de la ventana en coords de mapa.
  app.get<{ Querystring: { map?: string; x?: string; y?: string; rx?: string; ry?: string } }>(
    "/world-peek",
    async (req, reply) => {
      const clampInt = (v: number, lo: number, hi: number, def: number): number =>
        Number.isFinite(v) ? Math.max(lo, Math.min(Math.round(v), hi)) : def;
      const mapId = clampInt(Number(req.query.map ?? 1), 1, 1000, 1);
      const map = getMap(mapId);
      if (!map) return reply.code(404).send({ error: "NO_MAP" });
      const cx = clampInt(Number(req.query.x ?? 50), 0, map.width - 1, 50);
      const cy = clampInt(Number(req.query.y ?? 50), 0, map.height - 1, 50);
      const rx = clampInt(Number(req.query.rx ?? 10), 1, 20, 10);
      const ry = clampInt(Number(req.query.ry ?? 7), 1, 20, 7);
      const w = Math.min(rx * 2 + 1, map.width);
      const h = Math.min(ry * 2 + 1, map.height);
      const x0 = Math.max(0, Math.min(cx - rx, map.width - w));
      const y0 = Math.max(0, Math.min(cy - ry, map.height - h));
      const l1: number[] = [], l2: number[] = [], l3: number[] = [], l4: number[] = [];
      for (let yy = 0; yy < h; yy += 1) {
        for (let xx = 0; xx < w; xx += 1) {
          const idx = (y0 + yy) * map.width + (x0 + xx);
          l1.push(map.graphic[idx] ?? 0);
          l2.push(map.layer2[idx] ?? 0);
          l3.push(map.layer3[idx] ?? 0);
          l4.push(map.layer4[idx] ?? 0);
        }
      }
      const now = Date.now();
      const inWin = (px: number, py: number): boolean =>
        px >= x0 && px < x0 + w && py >= y0 && py < y0 + h;
      const entities: Array<{
        x: number; y: number; body: number; head: number; dir: string; name: string; kind: string;
      }> = [];
      for (const s of sessions.inMap(mapId)) {
        if (s.invisibleUntil > now || s.deadUntil !== 0) continue; // invisibles/muertos no se ven
        if (!inWin(s.position.x, s.position.y)) continue;
        entities.push({
          x: s.position.x, y: s.position.y, body: s.visibleBodyId, head: s.headId,
          dir: s.direction, name: s.characterName, kind: "player",
        });
      }
      for (const n of npcs.inMap(mapId)) {
        if (n.deadUntil !== 0 && now < n.deadUntil) continue; // criatura muerta esperando respawn
        if (!inWin(n.position.x, n.position.y)) continue;
        entities.push({
          x: n.position.x, y: n.position.y, body: n.type.bodyId, head: n.type.headId,
          dir: n.direction, name: n.type.name, kind: "npc",
        });
      }
      return reply
        .header("Cache-Control", "public, max-age=30")
        .send({ map: mapId, name: map.name, cx, cy, x0, y0, w, h, tile: 32, l1, l2, l3, l4, entities });
    },
  );

  // Assets de gráficos (para las fotos del panel admin, que corre en este
  // origen). Sirve packages/client/public/ao-assets/ de forma controlada.
  const ASSETS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/public/ao-assets");
  const MIME: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".json": "application/json",
  };
  app.get<{ Params: { "*": string } }>("/ao-assets/*", async (req, reply) => {
    const rel = req.params["*"];
    const full = normalize(resolve(ASSETS_DIR, rel));
    if (!full.startsWith(ASSETS_DIR)) return reply.code(403).send();
    try {
      const buf = await readFile(full);
      // Los atlas del AO son inmutables (nombre = fileNum). Cache agresivo para
      // que el browser no vuelva a bajarlos en cada login → mundo instantáneo.
      return reply
        .type(MIME[extname(full).toLowerCase()] ?? "application/octet-stream")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .send(buf);
    } catch {
      return reply.code(404).send();
    }
  });

  // Endpoint de métricas para Prometheus. No requiere auth; el acceso se
  // restringe a nivel de red (Caddy no lo expone al exterior en prod).
  app.get("/metrics", async (_req, reply) => {
    const metrics = await metricsRegistry.metrics();
    await reply
      .header("Content-Type", metricsRegistry.contentType)
      .send(metrics);
  });

  await app.register(registerAuthRoutes, { prefix: "/auth" });
  await app.register(registerCharactersRoutes, { prefix: "/characters" });
  await app.register(registerAdminRoutes, { prefix: "/admin" });
  await app.register(registerWsRoutes);

  // SPA en producción: servir el build del cliente (packages/client/dist) desde
  // este mismo origen, dejando al server autosuficiente (Caddy puede servirlo
  // igual delante). En dev lo sirve Vite (5174), así que no se registra.
  const CLIENT_DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  if (env.nodeEnv === "production" && existsSync(CLIENT_DIST)) {
    await app.register(fastifyStatic, { root: CLIENT_DIST, wildcard: false });
    // Fallback SPA: cualquier GET que no matchee API/WS/assets → index.html.
    const API_PREFIXES = [
      "/auth", "/characters", "/admin", "/ws", "/maps",
      "/health", "/metrics", "/item-overrides", "/ao-assets", "/world-peek",
    ];
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !API_PREFIXES.some((prefix) => req.url.startsWith(prefix))) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "NOT_FOUND" });
    });
  }

  return app;
}
