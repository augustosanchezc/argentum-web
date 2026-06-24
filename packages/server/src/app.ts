import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { env } from "./config/env.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCharactersRoutes } from "./routes/characters.js";
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

  await app.register(registerAuthRoutes, { prefix: "/auth" });
  await app.register(registerCharactersRoutes, { prefix: "/characters" });
  await app.register(registerWsRoutes);

  return app;
}
