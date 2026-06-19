# Argentum Online — Web

Servidor y cliente web de Argentum Online sobre stack moderno: **Node.js + TypeScript + WebSocket** en el server, **PixiJS v8 + Vite** en el cliente, **PostgreSQL + Redis** para persistencia.

Proyecto open source bajo **AGPL-3.0-or-later**. Inspirado en el código público de [ao-org](https://github.com/ao-org), [ao-libre](https://github.com/ao-libre) y [Finisterra](https://github.com/ao-libre/finisterra), pero reescrito desde cero sin copiar código de ellos.

## Estado

- **Fase actual:** 0 — Setup y decisiones (Sprint 1).
- **Próximo hito:** primer login + movimiento de un personaje en un mapa (Fase 1, Sprints 2-3).
- Roadmap completo: [`docs/roadmap.md`](docs/roadmap.md) (visual: [`docs/roadmap.html`](docs/roadmap.html)).

## Estructura del repositorio

```
.
├── packages/
│   ├── server/       — Node + TypeScript + WebSocket + Fastify
│   ├── client/       — Vite + PixiJS v8 + TypeScript
│   └── shared/       — Tipos del protocolo y entidades (compartido server/client)
├── docs/
│   ├── decisions/    — ADRs (Architecture Decision Records)
│   ├── roadmap.md, backlog.md, contexto-y-analisis.md
│   ├── costos-e-infraestructura.md
│   ├── design-system.md, definition-of-done.md
│   └── presentacion-ao.html, roadmap.html (versiones visuales)
├── .claude/agents/   — Agentes del proyecto (backend, frontend, PM)
├── docker-compose.yml (pendiente — T-003, post-reboot WSL)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Cómo arrancar

### Prerequisitos
- Node.js LTS ≥ 20 (instalado: v24).
- pnpm ≥ 10 (`npm i -g pnpm`).
- Docker Desktop con WSL2 (necesario para T-003 en adelante).

Lista completa: [`PROGRAMAS-NECESARIOS.md`](PROGRAMAS-NECESARIOS.md).

### Instalación

```powershell
pnpm install
```

### Scripts del workspace

| Comando | Descripción |
|---|---|
| `pnpm dev:server` | Server en modo watch (tsx). Por ahora imprime el stub. |
| `pnpm dev:client` | Vite dev server en `http://localhost:5173`. Render PixiJS con título "Argentum Online — Web". |
| `pnpm typecheck` | Type-check de todos los packages. |
| `pnpm lint` | Lint en server (y client cuando se configure). |
| `pnpm build` | Build de todos los packages. |
| `pnpm clean` | Limpia `dist/` y caches. |

## Trabajar con los agentes

Desde Claude Code dentro de esta carpeta, los agentes se invocan automáticamente o explícitamente con la herramienta Agent indicando `subagent_type`:

- `backend-developer` — server, networking, DB, lógica de juego.
- `frontend-designer` — cliente web, UI, sprites, UX.
- `project-manager` — planificación, alcance, decisiones, coordinación.

## Decisiones clave del proyecto

Resumen — detalle completo en [`docs/decisions/`](docs/decisions/):

| ADR | Decisión | Estado |
|---|---|---|
| [ADR-001](docs/decisions/ADR-001-licencia.md) | Licencia AGPL-3.0-or-later | Confirmada |
| [ADR-002](docs/decisions/ADR-002-stack.md) | Stack Node + TS + PixiJS + Postgres + Redis | Aceptada |
| [ADR-003](docs/decisions/ADR-003-protocolo.md) | Protocolo WebSocket binario propio (Opción B) | Aceptada |

Decisiones de scope confirmadas con el usuario el 2026-06-19:
- Licencia pública (AGPL).
- Libertad para rebalancear (no clon fiel de 0.13.3).
- Assets libres en desarrollo (OpenGameArt / Kenney). Pixel-art propio queda diferido a post-Beta.

## Próximos pasos del Sprint 1

- [x] T-001 Estructura monorepo.
- [x] T-002 LICENSE AGPL-3.0.
- [x] T-004 `packages/server` scaffold.
- [x] T-005 `packages/client` scaffold.
- [x] T-006 `packages/shared` con tipos de protocolo.
- [x] T-008 Verificación de programas instalados.
- [x] T-009/010/011 ADRs.
- [x] T-013 `design-system.md`.
- [x] T-014 `definition-of-done.md`.
- [ ] **T-003 Docker Compose con Postgres + Redis** (bloqueada por reboot para activar WSL2).
- [ ] T-007 GitHub Actions (lint + build en PRs) — espera repo en GitHub.
- [ ] T-012 Borrador de `docs/protocol.md` con paquetes de Fase 1.
- [ ] T-015 `docs/risks.md` con tabla completa.

## Licencia

[GNU AGPL-3.0-or-later](LICENSE). Si usás este servidor para ofrecer el juego por red, estás obligado a publicar el código fuente modificado a tus jugadores.
