# Definition of Done — Argentum Online Web

> Versión 0.1. Estos criterios aplican a TODA tarea individual del backlog. Si una tarea no los cumple, no se considera completa, no se cierra y no se mergea. Adicionalmente cada fase tiene su propio DoD (ver `docs/roadmap.md §5`).

## DoD universal por tarea

Una tarea se considera completa **cuando todas estas verificaciones pasan**:

### Código
- [ ] El código compila sin errores (`pnpm typecheck` verde).
- [ ] Lint sin warnings (`pnpm lint` verde) — `--max-warnings=0`.
- [ ] Sin código comentado, sin `console.log` de debug, sin `TODO` sin issue de seguimiento.
- [ ] Sin imports de paquetes no declarados en el `package.json` del workspace.
- [ ] Sin lógica de juego en el cliente: toda decisión que afecte estado del jugador vive en server (servidor autoritativo — R-04).

### Tipos y contratos
- [ ] Tipos compartidos entre server y client viven en `@ao/shared`. No se duplica un tipo en dos sitios.
- [ ] Si la tarea agrega o modifica un paquete de red, el tipo está en `@ao/shared/protocol.ts` Y la spec en `docs/protocol.md` está actualizada en el mismo commit.
- [ ] Si la tarea modifica el schema de PostgreSQL, hay una migración versionada (no edición destructiva manual).

### Tests (a partir de Fase 1)
- [ ] Lógica de servidor con tests unitarios cuando hay reglas (combate, movimiento, items). Render del cliente no requiere test unitario.
- [ ] Los tests existentes siguen pasando.
- [ ] Cobertura no baja respecto al baseline del módulo.

### Persistencia
- [ ] Toda transferencia de items / oro / inventario es una transacción SQL atómica (R-05).
- [ ] No hay queries SQL en strings — usar el driver/ORM con parámetros.

### Documentación
- [ ] Si la decisión que motivó la tarea no era obvia o cambia algo del roadmap, hay un ADR en `docs/decisions/`.
- [ ] Si la tarea agrega un comando del proyecto (script `pnpm`, env var nueva), está en el README correspondiente.
- [ ] Comentarios en código solo donde el "por qué" no es obvio — no comentar lo que el código ya dice.

### Git y revisión
- [ ] Commit con mensaje en formato `tipo(scope): descripción` (ej: `feat(server): handshake JWT en WebSocket`). Tipos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- [ ] Si la tarea tiene ID del backlog (T-XXX), va al final del mensaje: `feat(server): ... (T-021)`.
- [ ] No se commitea código a `main` directo a partir de la creación del repo en GitHub: PR + squash merge.

### Seguridad
- [ ] No se loguean credenciales, JWT crudos, ni passwords en logs.
- [ ] Variables de entorno cargadas desde `.env.local` (no commiteado); plantilla en `.env.example`.
- [ ] Validación de input del cliente en el servidor (no confiar en el cliente).

## DoD por fase

Ver `docs/roadmap.md §5`. Cada fase agrega criterios adicionales encima del DoD universal:

| Fase | Adicional |
|---|---|
| Fase 0 | Repo público, LICENSE AGPL, Docker Compose funcional, ADRs 1-3 mergeados. |
| Fase 1 | Dos navegadores conectados simultáneamente moviéndose. |
| Fase 2 | Demo filmable de 5 min con PvP, chat y respawn. |
| Fase 3 | Loop de gameplay completo (matar → lootear → subir nivel) probado con 50 conexiones. |
| Fase 4 | Servidor en producción con uptime > 99%, 100 jugadores reales en Discord. |

## Excepciones

- **Spike / prototipo descartable:** no se exige tests ni docs, pero la PR se marca explícitamente como `chore(spike)` y el código se elimina al cerrar el spike.
- **Documentación / planificación:** las tareas que solo escriben `.md` no exigen typecheck/lint/tests pero sí formato consistente con el resto.

## Revisión de este documento

A revisar al cierre de cada fase. Si una regla resulta contraproducente (bloqueando entregas legítimas), se discute y se actualiza acá con su razón.
