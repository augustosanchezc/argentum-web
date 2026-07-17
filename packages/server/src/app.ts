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
      "/health", "/metrics", "/item-overrides", "/ao-assets",
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
