# ADR-004 — ORM / acceso a base de datos

- **Estado:** Aceptada
- **Fecha:** 2026-06-21
- **Decidido por:** backend-developer (recomendación), confirmado al arrancar Sprint 2
- **Sprint:** 2 (Fase 1)
- **Supersede:** decisión "diferida" mencionada en ADR-002 §5.1 (Persistencia)

## Contexto

ADR-002 dejó abierta la elección de ORM/driver para Postgres entre **Drizzle** y **Prisma**, con la decisión pospuesta hasta el inicio de Sprint 2. Ya entramos en Sprint 2 con las primeras tareas de persistencia (T-016 register, T-017 login, T-018 characters), así que hay que cerrarlo antes de escribir queries.

Restricciones del proyecto:
- **Servidor autoritativo** con game loop a tick fijo — performance del data access importa.
- **Anti-dupe de items** (R-05) requiere transacciones SQL atómicas explícitas con control fino.
- **Un solo desarrollador backend** (R-09) — tiempo de aprendizaje cuenta.
- **Stack 100% TypeScript** sin bundlers raros.
- **AGPL-3.0** del proyecto — la dependencia tiene que ser compatible o más permisiva.

## Alternativas

| Opción | Pros | Contras |
|---|---|---|
| **A. Drizzle ORM** *(elegida)* | TypeScript-first, schema declarado en código TS. Migraciones como archivos `.sql` legibles. Sin code-gen step. Cero runtime adicional (todo se resuelve en compile-time / inline). Cerca del SQL crudo — fácil optimizar queries del game loop. Integración limpia con `pg` pool. Apache-2.0. | DX inferior a Prisma para queries relacionales muy anidadas. Comunidad más chica. Tooling joven (Drizzle Kit ~3 años). |
| **B. Prisma** | DX excelente — queries `findMany({ include: { ... } })` muy ergonómicas. Schema en `.prisma` muy legible. Mejor tooling (Studio, Accelerate). Migraciones gestionadas. | Pesado: motor en Rust corre como subproceso separado. Code-gen step obligatorio en CI y en dev. Cuando hay que optimizar queries hay que esquivar el ORM. Compañía detrás (Prisma Inc.) con presión de monetización (Pulse, Accelerate). Apache-2.0 core pero algunas features cerradas. |
| **C. `pg` crudo + queries SQL en strings** | Mínimo overhead. Control absoluto. | Sin tipado de filas → manual. Sin schema unificado → migraciones a mano. No escalable a > 30 endpoints. |
| **D. Knex / Kysely** | Query builder con buen tipado (Kysely). | Sin layer de schema/migración integrado tan limpio como Drizzle. Pierde tracción frente a Drizzle. |

## Decisión

Adoptamos **Drizzle ORM** + **Drizzle Kit** para migraciones, sobre **`pg`** como driver low-level.

Concretamente:
- `drizzle-orm` en runtime del server.
- `drizzle-kit` como devDependency, para generar y aplicar migraciones (`drizzle-kit generate` / `drizzle-kit migrate`).
- `pg` (node-postgres) como driver de conexión.
- Schema TypeScript en `packages/server/src/db/schema/` — un archivo por dominio (accounts, characters, items, ...).
- Migraciones generadas en `packages/server/drizzle/` — versionadas en git, son `.sql` con metadata JSON.
- Conexión vía pool `pg.Pool` configurable por env vars (ver `.env.example`).

## Por qué Drizzle y no Prisma

Tres razones decisivas para este proyecto:

1. **Control del SQL** — toda transferencia de items o cualquier mutación crítica del estado del personaje va a tener que ser una transacción explícita. Drizzle nos deja escribir `db.transaction(async tx => { ... })` con SQL muy cercano al crudo. Prisma mete una capa de abstracción que cuando hay que ajustar performance hay que esquivar; eso anula su ventaja de DX.

2. **Cero code-gen step** — un solo desarrollador, build chain simple. Prisma necesita `prisma generate` después de cada cambio de schema, en CI y en dev. Es una caja de fricción adicional para nada.

3. **Migraciones legibles** — Drizzle Kit genera SQL plano (`0000_init.sql`, `0001_add_inventory.sql`). En un proyecto donde R-05 dice "toda transferencia con transacción SQL atómica + logs auditables", poder leer la migración exacta antes de aplicarla en prod es indispensable. Prisma genera migraciones pero abstraídas detrás de su propio diff engine.

## Consecuencias

**Positivas**
- Tipos del schema disponibles inmediatamente (sin codegen) tanto para Drizzle como para uso libre desde otros módulos.
- Migraciones revisables como cualquier otro PR (son `.sql`).
- Stack más liviano en producción (un proceso Node, no Node + Prisma engine).

**Negativas / a tener presentes**
- Queries relacionales muy anidadas son más verbosas que en Prisma. Para inventory + items + slots vamos a tener que escribir joins explícitos. Asumido.
- Si la complejidad del schema crece descontroladamente, reconsiderar en Fase 5+.

**Acciones derivadas**
- Agregar `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg` al `packages/server`.
- Crear `packages/server/drizzle.config.ts` apuntando al schema.
- Crear `packages/server/src/db/index.ts` con la conexión pool y el cliente Drizzle.
- Primera migración: tabla `accounts` (T-016 depende de esto).
- Documentar el flujo `drizzle-kit generate → revisión → drizzle-kit migrate` en el README del server cuando se cree.
- ADR-002 §5.1 queda actualizado por referencia: "ORM: Drizzle (ver ADR-004)".
