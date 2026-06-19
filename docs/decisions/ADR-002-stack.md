# ADR-002 — Stack técnico

- **Estado:** Aceptada
- **Fecha:** 2026-06-19
- **Decidido por:** project-manager + backend-developer (recomendación), confirmado por el usuario al validar el roadmap
- **Sprint:** 1 (Fase 0)

## Contexto

Necesitamos un stack moderno para construir un MMORPG 2D web con un solo desarrollador activo (R-09 del roadmap), un objetivo de 200 conexiones simultáneas en Beta, y el requisito de ser ejecutable desde el navegador sin instalación previa. El análisis (`docs/contexto-y-analisis.md` §5) y el roadmap (`docs/roadmap.md`) ya recomiendan una pila concreta; este ADR la formaliza.

## Decisiones por componente

### Lenguaje y runtime
- **TypeScript ^5.6 estricto** en server, client y código compartido.
- **Node.js LTS ≥ 20** como runtime del server. Actualmente Node 24 instalado en la máquina de dev.

**Por qué:** un solo lenguaje en todo el stack reduce el costo de contexto-switching para un único desarrollador. TS estricto detecta errores en tiempo de compilación que en JS serían bugs en runtime — crítico para lógica de combate y persistencia.

### Package manager y monorepo
- **pnpm ^10** con **workspaces** (`pnpm-workspace.yaml`).
- Estructura: `packages/server`, `packages/client`, `packages/shared`.

**Por qué:** pnpm es más rápido y eficiente en disco que npm/yarn. Workspaces nativos permiten compartir `@ao/shared` sin publicar a registry. Monorepo evita el versionado cruzado entre server y client del protocolo (paquetes evolucionan en lock-step).

### Servidor — networking
- **WebSocket** sobre TCP. Implementación inicial con la librería **`ws`** (madura, estable).
- Si en Fase 2 la latencia o el throughput no son aceptables, evaluamos **`uWebSockets.js`** (10-30x más rápido pero más restrictivo).

**Por qué:** WebSocket es la única forma práctica de full-duplex en navegador. `ws` cubre el MVP sin sorpresas.

### Servidor — HTTP / REST
- **Fastify** para endpoints de login, registro, characters, healthcheck.

**Por qué:** Fastify ofrece mejor performance que Express y un sistema de plugins / schema validation con JSON Schema que evita libs adicionales. Hono es alternativa moderna pero Fastify tiene comunidad y plugins más maduros para nuestro caso (auth, rate limit, websocket).

### Persistencia
- **PostgreSQL 16** para cuentas, personajes, inventario, items, ranking. Self-hosted en Docker para dev; mismo VPS para Beta.
- **Redis 7** para sesiones, presencia, pub/sub.
- ORM/driver: a definir en Sprint 2 entre **Drizzle** (más explícito, queries tipadas) y **Prisma** (mejor DX, peor performance en pgbouncer). Decisión diferida.

**Por qué:** Postgres es estándar y permite transacciones atómicas críticas para evitar dupes de items (R-05). Redis es indispensable para presencia y pub/sub entre instancias del game loop.

### Cliente — renderer
- **PixiJS v8** (WebGL/WebGPU) como renderer principal.
- **Vite ^5** como bundler y dev server.

**Por qué:** PixiJS v8 es maduro para tilemaps 2D con miles de sprites; mismo motor que usa aoweb.app (validado en producción). Vite reemplaza al Webpack histórico del ecosistema AO web — DX significativamente mejor.

### Cliente — UI HUD
- A definir en Fase 2. Candidatos: **preact** o **lit**. Solo para overlays HTML (chat, inventario, login form). El canvas principal es PixiJS.

**Por qué:** React es overkill y pesado para un canvas-game. preact/lit dan reactividad y componentes con bundle mínimo.

### Codificación de paquetes
- **MessagePack** (`msgpackr` o `@msgpack/msgpack`) para mensajes binarios cliente↔servidor.
- **JSON** para endpoints HTTP de gestión (login, registro).

**Por qué:** MessagePack es ~30-40% más compacto que JSON y mantiene un esquema "JSON-like" simple. Protobuf es alternativa más rígida — diferimos hasta tener fricciones con MessagePack (probablemente nunca).

### Infraestructura local
- **Docker Compose** para PostgreSQL + Redis en dev.
- **WSL2** habilitado para Docker Desktop (Windows).

### Linting y formato
- **ESLint 9 (flat config)** con **typescript-eslint** en `packages/server`.
- **Prettier 3** para formato.
- Cliente añade lint en T-007 cuando se configure la CI.

## Alternativas descartadas

- **Bun / Deno** como runtime: comunidad más chica, menos packages testeados, riesgo para un proyecto a 5 meses con un dev. Reevaluar post-Beta.
- **Phaser** en el cliente: más opinionado, mete su propio loop y physics que no necesitamos. PixiJS es más bajo nivel y nos da control fino.
- **gRPC / Protobuf**: definir un schema upfront es mucho para iteración temprana. MessagePack alcanza.
- **Cloudflare Workers / Edge**: latencia ida-vuelta a base de datos hace inviable un game loop autoritativo.

## Consecuencias

- Toda la pila es JavaScript/TypeScript → un único contexto mental.
- Stack 100% open source → cero licencias.
- Stack 100% standard → reemplazo de librerías individuales es fácil si alguna queda obsoleta.
- Documentar el protocolo (`docs/protocol.md`) es CRÍTICO: cualquier divergencia entre server y client rompe la conexión silenciosamente.
- ECS no entra todavía. La arquitectura de entidades empieza simple (clases / dicts) y evoluciona si las mecánicas lo justifican (Fase 3+).
