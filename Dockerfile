# syntax=docker/dockerfile:1.7
# Imagen del servidor AO. Build multi-stage: instala deps + compila en el
# primer stage; el segundo stage solo copia el artefacto final (imagen mínima).
#
# Construir:  docker build -t ao-server .
# Correr:     docker run --env-file .env.prod -p 3000:3000 ao-server

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiar manifiestos primero para aprovechar el cache de capas de Docker.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile

# Copiar fuentes y compilar.
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

RUN pnpm --filter @ao/shared build && pnpm --filter @ao/server build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Solo los manifiestos necesarios para instalar deps de producción.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile --prod

# Artefactos compilados del stage anterior.
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Assets de mapas (binarios del AO — no se generan en build, viajan con el repo).
COPY packages/server/data ./packages/server/data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
