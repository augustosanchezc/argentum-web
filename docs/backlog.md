# Backlog — Argentum Online Web

> Documento vivo. Fecha de creación: 2026-06-19. Responsable: project-manager.
> Priorización: MoSCoW (Must / Should / Could / Won't en este MVP).
> Tamaños: S = menos de 2 días, M = 2-5 días, L = 1-2 semanas.
> Las fases 4+ solo se listan a nivel épica; se desglosan cuando la Fase 3 esté cerrada.

---

## Fase 0 — Setup y decisiones (Sprint 1)

### Épica E-0.1: Repositorio e infraestructura base

| ID | Título | Agente | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-001 | Crear repositorio GitHub con estructura de monorepo | backend-developer | S | — | Repo público con carpetas `packages/server`, `packages/client`, `packages/shared`, `.gitignore` y rama `main` protegida | Must |
| T-002 | Agregar LICENSE (AGPL-3.0) y headers de archivo | project-manager | S | T-001 | Archivo `LICENSE` presente; template de header AGPL en `docs/` | Must |
| T-003 | Configurar `docker-compose.yml` con PostgreSQL 16 + Redis | backend-developer | S | T-001 | `docker compose up` levanta ambos servicios sin errores; `psql` y `redis-cli ping` responden | Must |
| T-004 | Crear `packages/server` con TypeScript + ESLint + Prettier | backend-developer | S | T-001 | `pnpm install && pnpm build` sin errores; `pnpm lint` sin warnings | Must |
| T-005 | Crear `packages/client` con Vite + PixiJS v8 + TypeScript | frontend-designer | S | T-001 | `pnpm dev` abre `localhost:5173` con canvas en blanco sin errores de consola | Must |
| T-006 | Crear `packages/shared` para tipos y constantes de protocolo | backend-developer | S | T-001 | Paquete importable desde server y client; al menos tipos `Packet`, `Vector2`, `EntityId` definidos | Must |
| T-007 | Configurar CI con GitHub Actions (lint + build en cada PR) | backend-developer | M | T-004, T-005 | PR de prueba falla si hay error de lint; PR limpio pasa en < 3 minutos | Should |
| T-008 | Verificar instalación de programas en la máquina local | project-manager | S | — | Checklist de `PROGRAMAS-NECESARIOS.md` completada: `git --version`, `node --version`, `pnpm --version`, `docker --version` sin errores | Must |

### Épica E-0.2: Documentación inicial y ADRs

| ID | Título | Agente | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-009 | Escribir ADR-001: Decisión de licencia (AGPL-3.0) | project-manager | S | T-002 | ADR en `docs/decisions/ADR-001-licencia.md` con contexto, alternativas y consecuencias | Must |
| T-010 | Escribir ADR-002: Stack técnico (Node.js + TS + Vite + PixiJS) | project-manager | S | — | ADR en `docs/decisions/ADR-002-stack.md` con justificación por componente | Must |
| T-011 | Escribir ADR-003: Protocolo de red (WebSocket + MessagePack) | project-manager | S | — | ADR en `docs/decisions/ADR-003-protocolo.md`; incluye comparativa con Opción A (compat VB6) y Opción C (híbrido) | Must |
| T-012 | Borrador inicial de `docs/protocol.md` — paquetes de Fase 1 | backend-developer | M | T-006 | Documento con al menos 5 paquetes definidos: `LOGIN_REQUEST`, `LOGIN_RESPONSE`, `MOVE`, `ENTITY_UPDATE`, `MAP_DATA`. Cada uno con campos, tipos y dirección (C→S o S→C) | Must |
| T-013 | Crear `docs/design-system.md` con paleta y tipografía | frontend-designer | M | — | Doc con paleta de colores (hex), fuente principal, tamaños de texto y principios visuales (máx. 1 página) | Must |
| T-014 | Crear `docs/definition-of-done.md` | project-manager | S | — | Doc con criterios globales de DoD: tests requeridos, cobertura mínima, docs actualizadas | Must |
| T-015 | Actualizar `docs/risks.md` con tabla completa de riesgos | project-manager | S | — | Archivo con los 10 riesgos del roadmap y columna de estado (abierto/mitigado) — **HECHO** 2026-06-19: 13 riesgos registrados (R-01 a R-13), 2 cerrados, 3 mitigados, 8 abiertos. | Should |

---

## Fase 1 — Prototipo de red (Sprints 2-3)

### Épica E-1.1: Autenticación

| ID | Título | Agente | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-016 | Endpoint HTTP POST `/auth/register` | backend-developer | S | T-003, T-004 | Crea cuenta con email + contraseña hasheada (bcrypt); devuelve 201 o error 409 si ya existe | Must |
| T-017 | Endpoint HTTP POST `/auth/login` | backend-developer | S | T-016 | Valida credenciales; devuelve JWT firmado con `userId` y `exp` de 24h | Must |
| T-018 | Endpoint HTTP GET `/characters` y POST `/characters` | backend-developer | S | T-017 | Lista personajes del usuario (máx 3); crea personaje con nombre único; devuelve 400 si nombre tomado | Must |
| T-019 | Pantalla de login en cliente web | frontend-designer | M | T-013, T-005 | Formulario email/contraseña; validación client-side; llama a T-017; token persistido en localStorage | Must |
| T-020 | Pantalla de selección de personaje | frontend-designer | M | T-019, T-018 | Lista personajes disponibles; botón "Crear personaje" con campo de nombre; botón "Jugar" habilita al seleccionar | Must |

### Épica E-1.2: Conexión WebSocket y sesión

| ID | Título | Agente | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-021 | Servidor WebSocket con handshake de autenticación por JWT | backend-developer | M | T-017, T-012 | Cliente envía JWT en primer paquete; servidor valida y crea sesión o cierra conexión con código 4001 | Must |
| T-022 | Game loop con tick fijo a 100ms | backend-developer | M | T-021 | Loop corre a 10 Hz; drift < 5ms medido por log; se detiene limpiamente con SIGINT | Must |
| T-023 | Módulo de sesiones de jugador (join/leave) | backend-developer | S | T-021, T-022 | Al conectar, la sesión del jugador queda registrada en Redis; al desconectar se limpia | Must |
| T-024 | Conexión WebSocket desde cliente con reconexión automática | frontend-designer | M | T-020, T-021 | Al iniciar juego, el cliente conecta al WS; si cae la conexión, reintenta hasta 3 veces con backoff exponencial | Must |

### Épica E-1.3: Mapa y movimiento

| ID | Título | Agente | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-025 | Cargador de mapas en servidor (formato JSON compatible con Tiled) | backend-developer | M | T-022 | Servidor carga mapa 50x50 desde archivo JSON; expone matriz de tiles y capa de colisión | Must |
| T-026 | Envío de `MAP_DATA` al cliente al conectar | backend-developer | S | T-025, T-021 | Cliente recibe paquete `MAP_DATA` con tiles, dimensiones y lista de entidades presentes | Must |
| T-027 | Renderizado de tilemap en PixiJS | frontend-designer | M | T-024, T-026 | Canvas muestra mapa 50x50 con tiles diferenciados (suelo, pared, agua) usando tileset placeholder | Must |
| T-028 | Sprite de personaje con animaciones idle/walk 4 direcciones | frontend-designer | M | T-027 | Personaje del jugador se muestra en posición correcta; cambia de animación al moverse | Must |
| T-029 | Input WASD/flechas → paquete `MOVE` al servidor | frontend-designer | S | T-024 | Cada keypress envía paquete `MOVE` con dirección; se ignoran teclas repetidas en cooldown de 100ms | Must |
| T-030 | Validación de movimiento en servidor (colisión, cooldown) | backend-developer | M | T-025, T-022 | Servidor rechaza movimientos a tiles con colisión o más rápidos que el cooldown; envía `ENTITY_UPDATE` solo si el movimiento es válido | Must |
| T-031 | Broadcast de `ENTITY_UPDATE` a todos los clientes del mapa | backend-developer | S | T-030 | Cuando un jugador se mueve, todos los clientes del mismo mapa reciben el paquete con la nueva posición dentro de 1 tick | Must |
| T-032 | Renderizar entidades remotas (otros jugadores) | frontend-designer | M | T-028, T-031 | El sprite de otro jugador aparece en pantalla y se mueve al recibir `ENTITY_UPDATE`; sin interpolación en este sprint (movimiento discreto) | Must |
| T-033 | Persistencia de posición al desconectar | backend-developer | S | T-030, T-023 | Al desconectar, la última posición válida del personaje se guarda en PostgreSQL | Must |
| T-034 | Mapa de prueba diseñado en Tiled (50x50) | frontend-designer | M | T-027 | Archivo `.json` exportado de Tiled con al menos 3 tipos de tile, área jugable y obstáculos | Must |

---

## Fase 2 — Slice vertical jugable (Sprints 4-5)

### Épica E-2.1: Chat

| ID | Título | Agente | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-035 | Paquetes `CHAT_SEND` y `CHAT_MSG` en protocolo | backend-developer | S | T-012 | Actualizar `docs/protocol.md` con los dos paquetes; campos: `characterName`, `message` (máx 200 chars), `timestamp` | Must |
| T-036 | Módulo de chat en servidor (sala global única) | backend-developer | S | T-035, T-022 | Servidor recibe `CHAT_SEND`; valida longitud y cooldown (1 msg/seg); hace broadcast `CHAT_MSG` a todo el mapa | Must |
| T-037 | HUD de chat en cliente (overlay sobre canvas) | frontend-designer | M | T-035, T-024 | Ventana de chat con scroll, input de texto, envío con Enter; muestra últimos 50 mensajes; no bloquea el movimiento | Must |
| T-038 | Filtro básico de contenido ofensivo | backend-developer | S | T-036 | Lista de palabras bloqueadas configurable; mensaje rechazado con error `CHAT_BLOCKED` si contiene alguna | Should |

### Épica E-2.2: Combate cuerpo a cuerpo

| ID | Título | Agente | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-039 | Stats base persistidos (HP, MaxHP) | backend-developer | S | T-003 | Migración SQL agrega columnas `hp`, `max_hp` a tabla `characters`; valores por defecto nivel 1 | Must |
| T-040 | Paquetes `ATTACK`, `DAMAGE`, `DEATH`, `RESPAWN` en protocolo | backend-developer | S | T-012 | `docs/protocol.md` actualizado con los 4 paquetes y sus campos | Must |
| T-041 | Módulo de combate en servidor | backend-developer | M | T-039, T-040, T-022 | Al recibir `ATTACK`: valida rango (1 tile), cooldown (800ms), y que el objetivo exista; aplica daño base; envía `DAMAGE` a ambos jugadores; si HP llega a 0 envía `DEATH` | Must |
| T-042 | Módulo de muerte y respawn | backend-developer | S | T-041 | Al morir: personaje queda en estado `dead` 3 segundos, luego reaparece en punto de spawn del mapa con HP al máximo; envía `RESPAWN` | Must |
| T-043 | Tecla de ataque (Ctrl o clic) en cliente | frontend-designer | S | T-024, T-040 | Al presionar la tecla de ataque con un personaje adyacente seleccionado/apuntado, envía `ATTACK` con `targetId` | Must |
| T-044 | Animación de ataque y efecto de daño | frontend-designer | M | T-043, T-041 | Al recibir `DAMAGE`: muestra número flotante de daño (+rojo para daño recibido, -verde para daño infligido); animación de swing en el atacante | Must |
| T-045 | Barra de HP en HUD y sobre personajes | frontend-designer | M | T-039, T-044 | Barra de HP propia en HUD inferior; barra de HP sobre la cabeza de cada jugador visible en pantalla; se actualiza con cada `DAMAGE` | Must |
| T-046 | Pantalla/efecto de muerte y respawn | frontend-designer | S | T-042 | Al recibir `DEATH`: pantalla se vuelve gris 3 segundos; al recibir `RESPAWN`: pantalla normal, personaje en spawn point | Must |

### Épica E-2.3: HUD y polish de Fase 2

| ID | Título | Agente | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-047 | Lista de jugadores online en HUD | frontend-designer | S | T-024 | Panel lateral con nombres de jugadores conectados al mapa; se actualiza con conectar/desconectar | Should |
| T-048 | Logging estructurado del servidor (Pino) | backend-developer | S | T-004 | Servidor loguea en JSON: conexión, desconexión, ataque, muerte, error con nivel y timestamp | Must |
| T-049 | Primer pase de controles táctiles | frontend-designer | M | T-029, T-043 | D-pad virtual en pantalla para movimiento; botón de ataque táctil; funcional en Chrome mobile sin errores (no requiere layout perfecto) | Should |
| T-050 | Load test con 20 conexiones simultáneas | backend-developer | M | T-041 | Script de k6 que abre 20 sesiones WebSocket simultáneas, mueve personajes y hace ataques por 2 minutos; latencia P95 < 200ms; sin crashes | Must |

---

## Épicas de Fase 3 — MVP cerrado (detalle en Sprint 8)

Las siguientes épicas se desglosan en tareas al inicio del Sprint 6. Se listan aquí para visibilidad de alcance.

| Épica | Descripción | Agente principal | MoSCoW |
|---|---|---|---|
| E-3.1 | Sistema de NPC: tipos (hostil, neutro, comerciante), spawners, IA básica | backend-developer | Must |
| E-3.2 | Sistema de inventario: slots, equipo, recogida de items del suelo | backend-developer + frontend-designer | Must |
| E-3.3 | Sistema de items: definición (tipo, stats, sprite), 5 items base | backend-developer | Must |
| E-3.4 | Comercio con NPC: ventana de tienda, compra/venta por oro | backend-developer + frontend-designer | Must |
| E-3.5 | Experiencia y niveles 1-10 | backend-developer | Must |
| E-3.6 | Sprites y arte de NPCs (placeholder) | frontend-designer | Must |
| E-3.7 | Ventana de inventario con drag-and-drop (desktop) | frontend-designer | Must |
| E-3.8 | ADR-004: diseño del sistema de items (tipos, slots, balance) | project-manager | Must |
| E-3.9 | Prueba de carga con 50 conexiones (k6) | backend-developer | Must |
| E-3.10 | `docs/architecture.md` actualizado post-MVP | backend-developer | Must |

---

## Épicas de Fase 4 — Beta pública (detalle en Sprint 12)

| Épica | Descripción | Agente principal | MoSCoW |
|---|---|---|---|
| E-4.1 | Multi-mapa con transiciones (portales) | backend-developer | Must |
| E-4.2 | Banco de items por personaje | backend-developer + frontend-designer | Must |
| E-4.3 | Party system (hasta 5 jugadores) | backend-developer + frontend-designer | Must |
| E-4.4 | Comercio seguro jugador-jugador | backend-developer + frontend-designer | Must |
| E-4.5 | Despliegue en VPS con dominio y WSS | backend-developer | Must |
| E-4.6 | Observabilidad: Prometheus + Grafana + Sentry | backend-developer | Must |
| E-4.7 | Discord con canales de comunidad y moderación | project-manager | Must |
| E-4.8 | Política de privacidad y términos de uso | project-manager | Must |
| E-4.9 | Prueba de carga con 200 conexiones (k6) | backend-developer | Must |
| E-4.10 | UX review y mejoras post-feedback interno | frontend-designer | Should |

---

## Tareas de gestión transversales (todas las fases)

| ID | Título | Agente | Frecuencia | Descripción |
|---|---|---|---|---|
| TG-01 | Actualizar `docs/roadmap.md` | project-manager | Fin de cada fase | Marcar fase cerrada, actualizar fechas, reflejar cambios de scope |
| TG-02 | Retrospectiva de sprint | project-manager | Fin de cada sprint | Registrar: qué funcionó, qué no, qué cambia en el próximo sprint |
| TG-03 | Revisión de riesgos | project-manager | Inicio de cada fase | Actualizar probabilidad e impacto de riesgos en `docs/risks.md` |
| TG-04 | Demo funcional grabada | project-manager | Fin de Fase 1, 2, 3, 4 | Video o GIF de la feature nueva corriendo, para comunicación con el usuario |
| TG-05 | Sincronizar `docs/protocol.md` | backend-developer | Cada cambio de protocolo | PR no mergeable si la spec no está actualizada antes del código |

---

## Won't have (fuera del MVP)

Las siguientes features están **explícitamente fuera de alcance** hasta Fase 5+ para evitar scope creep. Si alguien las propone durante Fase 1-4, se agrega al backlog de Fase 5 sin discusión:

- Clases de personaje diferenciadas (guerrero, mago, etc.).
- Sistema de hechizos / maná.
- PvP organizado (arenas, duelos formales).
- Guilds / clanes.
- Economía de mercado / subastas.
- Multi-servidor / modo federado.
- Assets pixel-art originales (comisionados) — se evalúa con presupuesto en Fase 4.
- Música y efectos de sonido — se evalúa en Fase 3 como Could.
- Sistema de logros o misiones.
- Panel de administración web.
