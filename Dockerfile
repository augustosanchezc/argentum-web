# syntax=docker/dockerfile:1.7
# Imagen del servidor AO. El monorepo consume @ao/shared como FUENTE TypeScript
# (su package.json apunta a src/index.ts), y la app corre con tsx — igual que en
# desarrollo. Esto evita los problemas de bundlear módulos nativos (bcrypt,
# msgpackr-extract, pg) y es la forma en que el server realmente ejecuta.
#
# Construir:  docker build -t ao-server .
# Correr:     docker run --env-file .env.prod -p 3000:3000 ao-server

# ── Stage 1: deps (cache de la instalación) ───────────────────────────────────
FROM node:22-alpine AS deps

# Toolchain para compilar los bindings nativos (bcrypt, msgpackr-extract).
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Manifiestos primero (cache de capas). tsconfig.base.json lo extienden los
# tsconfig de cada package.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN pnpm install --frozen-lockfile

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# node_modules ya instalados (con los bindings nativos compilados en `deps`).
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Fuentes (shared se ejecuta como TS vía tsx; no hay paso de build).
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/packages/server

# Sincroniza la base al esquema con drizzle-kit push (igual que el flujo de
# desarrollo) y arranca. Se eligió push en vez de las migraciones porque el
# proyecto se desarrolla con push y las migraciones quedaban incompletas
# (drift), lo que rompía el arranque en un deploy limpio. Si push falla, el
# contenedor no arranca (fail-fast). tsx resuelve @ao/shared desde la fuente.
#
# CRÍTICO — señales: corremos el server con `exec node --import tsx` (loader
# in-process, SIN subproceso). Así el proceso Node que tiene el handler de
# SIGTERM ES el que recibe la señal del `docker stop` del deploy, y alcanza a
# hacer el flush de TODAS las sesiones a la DB antes de morir. Con el
# `pnpm exec tsx` anterior, Node quedaba como nieto de `sh` (sh→pnpm→tsx→node) y
# la señal NO se propagaba: el server moría por SIGKILL sin guardar, perdiendo el
# progreso desde el último autosave. El `exec` reemplaza al shell tras migrar.
CMD ["sh", "-c", "pnpm exec drizzle-kit push --force && exec node --import tsx src/index.ts"]
