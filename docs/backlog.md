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
| T-003 | Configurar `docker-compose.yml` con PostgreSQL 16 + Redis | backend-developer | S | T-001 | `docker compose up` levanta ambos servicios sin errores; `psql` y `redis-cli ping` responden — **HECHO**: ambos containers healthy, pg_isready y redis PING verdes. | Must |
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

### Desglose de tareas (Sprint 6 — abierto 2026-06-29)

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-051 | Registro de NPCs en server + envío como entidades | E-3.1 | M | T-041 | NPCs definidos por tipo y spawner; se envían al cliente como entidades con `kind: "npc"`, graphic, hp/maxHp | Must |
| T-052 | IA básica de NPC hostil (aggro, persecución, ataque) | E-3.1 | M | T-051, T-022 | En el game loop, un NPC hostil detecta al jugador en rango, se le acerca tile a tile y lo ataca al estar adyacente (cooldown propio) | Must |
| T-053 | Combate jugador→NPC + muerte y respawn del NPC | E-3.1 | M | T-051, T-041 | El jugador puede atacar NPCs; al morir el NPC emite DEATH, dropea XP y reaparece en su spawner tras un delay | Must |
| T-054 | Render de NPCs en el cliente | E-3.1, E-3.6 | S | T-053, T-032 | Los NPCs se ven con un marcador/sprite distinto al de jugadores, con nombre y barra de HP | Must |
| T-055 | Experiencia, niveles y subida de stats (server) | E-3.5 | M | T-053 | Columnas xp/level; matar NPC da XP; al alcanzar el umbral sube de nivel, aumenta maxHp y cura; se envía StatsUpdate | Must |
| T-056 | HUD de XP y nivel en el cliente | E-3.5 | S | T-055 | El HUD muestra nivel y barra de XP; se actualiza al ganar XP y al subir de nivel | Must |

---

## Fase 4 — Beta pública (Sprints 9-12, 2026-09-29 al 2026-10-23)

> **Desglosado el 2026-07-06** (Sprint 9 abierto). Continúa la numeración desde
> T-056. La secuencia recomendada es E-4.1 (multi-mapa, base técnica) →
> E-4.2/E-4.3/E-4.4 (features de gameplay sobre multi-mapa) →
> E-4.5/E-4.6 (infra y observabilidad, en paralelo) → E-4.7/E-4.8 (comunidad y
> legal, en paralelo desde el inicio) → E-4.9/E-4.10 (cierre).
>
> **Decisiones que requieren ADR antes de codear** (regla de trabajo del PM):
> ADR-006 (estrategia multi-mapa) bloquea E-4.1; ADR-007 (transacciones atómicas
> de items anti-dupe, R-05) bloquea E-4.2 y E-4.4; ADR-008 (infra de producción)
> bloquea E-4.5.

### Resumen de épicas

| Épica | Descripción | Agente principal | MoSCoW |
|---|---|---|---|
| E-4.1 | Multi-mapa con transiciones (portales) | backend-developer + frontend-designer | Must |
| E-4.2 | Banco de items por personaje | backend-developer + frontend-designer | Must |
| E-4.3 | Party system (hasta 5 jugadores) | backend-developer + frontend-designer | Must |
| E-4.4 | Comercio seguro jugador-jugador | backend-developer + frontend-designer | Must |
| E-4.5 | Despliegue en VPS con dominio y WSS | backend-developer | Must |
| E-4.6 | Observabilidad: Prometheus + Grafana + Sentry | backend-developer + frontend-designer | Must |
| E-4.7 | Discord con canales de comunidad y moderación | project-manager | Must |
| E-4.8 | Política de privacidad y términos de uso | project-manager + frontend-designer | Must |
| E-4.9 | Prueba de carga con 200 conexiones | backend-developer | Must |
| E-4.10 | UX review y mejoras post-feedback interno | frontend-designer | Should |
| E-4.11 | ADRs y gestión de la fase | project-manager | Must |

---

### Épica E-4.1: Multi-mapa con transiciones (portales)

> Hoy el mundo es un único mapa (Ullathorpe). La entidad ya lleva `map_id`
> (ver `docs/architecture.md` §2), pero todos los broadcasts asumen un solo mapa.
> Esta épica generaliza el server a N mapas en memoria y añade portales.

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-057 | Registro multi-mapa en el server | E-4.1 | M | T-057-ADR-006 | `world/maps.ts` carga ≥3 mapas del AO en memoria, indexados por `mapId`; NPCs, items del suelo y sesiones se agrupan por mapa; el game loop y todos los broadcasts (`ENTITY_UPDATE`, `CHAT_MSG`, etc.) se filtran por el mapa del emisor | Must |
| T-058 | Portales en protocolo y data de mapas | E-4.1 | S | T-057, TG-05 | Cada mapa define tiles-portal con `{ destMapId, destX, destY }`; `docs/protocol.md` actualizado con paquete `MAP_CHANGE` (S→C) y, si aplica, `ENTER_PORTAL` (C→S); `@ao/shared` publica los tipos | Must |
| T-059 | Lógica de transición de mapa (server) | E-4.1 | M | T-057, T-058 | Al pisar un tile-portal el server valida el destino, saca al jugador del mapa origen (despawn a los demás), lo inserta en el destino, envía `MapData` + `EntitySpawn` del nuevo mapa y persiste `map_id/pos` | Must |
| T-060 | Cambio de mapa en el cliente | E-4.1 | M | T-059, T-027 | Al recibir el `MapData` de otro mapa la escena PixiJS se reconstruye sin fugas de memoria (destroy de capas/texturas), recarga el tileset bajo demanda, reubica la cámara y muestra un fade de transición | Must |
| T-061 | Tres mapas conectados jugables | E-4.1 | S | T-060 | Ullathorpe + 2 zonas nuevas conectadas por portales bidireccionales; se puede ir y volver entre los 3 mapas con NPCs propios en cada uno | Must |

### Épica E-4.2: Banco de items por personaje

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-062 | Persistencia del banco + NPC banquero | E-4.2 | S | T-057-ADR-007 | Migración añade `bank` (jsonb) a `characters`; se define un NPC "Banquero" (tipo nuevo) colocado en un mapa; carga/guardado junto al resto del personaje | Must |
| T-063 | Protocolo de banco | E-4.2 | S | T-062, TG-05 | `docs/protocol.md` y `@ao/shared` con `BANK_OPEN`, `BANK_DEPOSIT`, `BANK_WITHDRAW`, `BANK_UPDATE` (oro e items, con slot y cantidad) | Must |
| T-064 | Lógica de banco atómica (server) | E-4.2 | M | T-063 | Depositar/retirar items y oro con validación de slot/cantidad; toda transferencia inventario↔banco es atómica (sin duplicación, R-05); se abre solo con el Banquero adyacente | Must |
| T-065 | Ventana de banco en el cliente | E-4.2 | M | T-064, T-... | UI de banco con drag-and-drop entre inventario y banco (reusa el sistema de `ui/inventory.ts`); muestra oro depositado; refleja `BANK_UPDATE` en tiempo real | Must |

### Épica E-4.3: Party system (hasta 5 jugadores)

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-066 | Protocolo de party | E-4.3 | S | TG-05 | `docs/protocol.md` y `@ao/shared` con `PARTY_INVITE`, `PARTY_ACCEPT`, `PARTY_LEAVE`, `PARTY_UPDATE` (lista de miembros con id, nombre, hp/maxHp) | Must |
| T-067 | Lógica de party (server) | E-4.3 | M | T-066 | Crear/invitar/unir/salir/disolver; máximo 5 miembros; el daño no se aplica entre aliados (friendly fire off en combate); estado en memoria por party | Must |
| T-068 | Reparto de XP en party | E-4.3 | S | T-067, T-055 | Al morir un NPC la XP se reparte entre los miembros de la party que estén en el mismo mapa y en rango; en solitario el comportamiento actual no cambia | Must |
| T-069 | UI de party en el cliente | E-4.3 | M | T-067 | Panel de party con lista de miembros y barra de HP de aliados; flujo de invitación (recibir/aceptar/rechazar); se actualiza con `PARTY_UPDATE` | Must |

### Épica E-4.4: Comercio seguro jugador-jugador

> Área de máximo riesgo de dupe (R-05). El diseño va en ADR-007 junto al banco.

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-070 | Protocolo de trade | E-4.4 | S | TG-05, T-057-ADR-007 | `docs/protocol.md` y `@ao/shared` con `TRADE_REQUEST`, `TRADE_UPDATE`, `TRADE_CONFIRM`, `TRADE_CANCEL`; incluye oferta de items + oro de ambos lados y estado de confirmación | Must |
| T-071 | Máquina de estados de trade con commit atómico | E-4.4 | L | T-070 | Ventana de intercambio con doble confirmación; el swap se aplica en una única transacción atómica solo cuando ambos confirman; cualquier cambio de oferta resetea las confirmaciones; cancelación/desconexión aborta sin pérdida; logs auditables de cada trade | Must |
| T-072 | Ventana de comercio en el cliente | E-4.4 | M | T-071 | Dos áreas (mi oferta / su oferta) + oro, botones confirmar/cancelar, indicador de "el otro confirmó"; refleja `TRADE_UPDATE` en tiempo real | Must |

### Épica E-4.5: Despliegue en VPS con dominio y WSS

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-073 | Dockerfile de producción del server + build del cliente | E-4.5 | M | T-073-ADR-008 | Imagen del `@ao/server` multi-stage optimizada; build estático del `@ao/client`; `pnpm` en modo producción; imagen arranca con variables de entorno (DB, JWT, CORS) | Must |
| T-074 | Reverse proxy con HTTPS/WSS (Caddy) | E-4.5 | M | T-073 | Caddy sirve el cliente estático y proxya `/ws` y `/auth` al server; TLS automático (Let's Encrypt) para el dominio; `wss://<dominio>/ws` conecta con certificado válido | Must |
| T-075 | docker-compose de producción + backups | E-4.5 | M | T-074 | Compose de prod (server + postgres + redis + caddy) con volúmenes persistentes, `.env` de prod y healthchecks; job de backup diario de Postgres documentado | Must |
| T-076 | Deploy en VPS y smoke test remoto | E-4.5 | S | T-075 | Server corriendo 24/7 en el VPS con dominio; un cliente desde internet se registra, entra, camina entre mapas y pelea sin errores de consola críticos | Must |

### Épica E-4.6: Observabilidad (Prometheus + Grafana + Sentry)

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-077 | Métricas Prometheus en el server | E-4.6 | M | T-048 | Endpoint `/metrics`: conexiones activas, duración del tick, latencia de paquetes (P50/P95), entidades por mapa, errores; sin degradar el tick de 10 Hz | Must |
| T-078 | Grafana con dashboard y alertas | E-4.6 | M | T-077, T-075 | Grafana + Prometheus en el compose de prod; dashboard con las métricas de T-077; alerta básica de caída del server (target down) | Must |
| T-079 | Sentry server-side | E-4.6 | S | T-048 | Excepciones no capturadas y errores del game loop se reportan a Sentry con contexto (mapa, opcode); no rompe el loop | Must |
| T-080 | Sentry client-side | E-4.6 | S | T-024 | Errores de JS del cliente reportados a Sentry con release/versión; ignora ruido de red esperado (reconexiones) | Must |

### Épica E-4.7: Comunidad (Discord)

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-081 | Servidor de Discord con canales y roles | E-4.7 | S | — | Servidor con `#anuncios`, `#bugs`, `#feedback`, `#general`; reglas publicadas; roles básicos (admin, moderador, jugador); sistema de mute/ban configurado | Must |
| T-082 | Webhook de estado del server a Discord | E-4.7 | S | T-078 | Alertas de caída/recuperación del server publican en `#anuncios` vía webhook | Could |

### Épica E-4.8: Legal (privacidad y términos)

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-083 | Redactar Política de Privacidad y Términos de Uso | E-4.8 | S | — | Documentos que cubren datos personales recolectados (email, IP), uso, AGPL y edad mínima; guardados en `docs/legal/` | Must |
| T-084 | Publicar legal + consentimiento en registro | E-4.8 | S | T-083, T-019 | Enlaces a privacidad/términos accesibles desde el cliente; checkbox de consentimiento obligatorio en la pantalla de registro | Must |

### Épica E-4.9: Prueba de carga (200 conexiones)

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-085 | Load test de 200 conexiones multi-mapa | E-4.9 | M | T-050, T-061 | Extender `scripts/load-test.mjs` a 200 sesiones simultáneas repartidas entre mapas, con movimiento, combate y cambios de mapa por ≥3 min; documentar P95 y decidir si el objetivo de 200 se cumple single-process o requiere sharding (feed a ADR-006) | Must |

### Épica E-4.10: UX review y polish

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-086 | UX review post-feedback interno | E-4.10 | S | T-076 | Sesión de juego interna sobre el server de prod; lista priorizada de fricciones de UX; las correcciones rápidas se aplican y el resto va al backlog de Fase 5 | Should |

### Épica E-4.11: ADRs y gestión de la fase

| ID | Título | Épica | Tamaño | Depende de | Criterio de aceptación | MoSCoW |
|---|---|---|---|---|---|---|
| T-057-ADR-006 | ADR-006: Estrategia multi-mapa | E-4.11 | S | — | `docs/decisions/ADR-006-multi-mapa.md`: single-process con mapas en memoria vs. sharding por proceso/mapa; decide para la Beta y deja el plan B de escalado (R-06) | Must |
| T-057-ADR-007 | ADR-007: Transacciones atómicas de items (anti-dupe) | E-4.11 | S | — | `docs/decisions/ADR-007-transacciones-items.md`: patrón atómico común para banco y trade jugador-jugador; mitiga R-05; define logging auditable | Must |
| T-073-ADR-008 | ADR-008: Infraestructura de producción | E-4.11 | S | — | `docs/decisions/ADR-008-infra-produccion.md`: VPS elegido, Caddy vs. Nginx, estrategia de TLS/WSS, backups y secretos; presupuesto ≤ USD 40/mes (R-10) | Must |
| TG-06 | Cerrar Fase 4 en roadmap y dashboard | E-4.11 | S | T-076, T-085 | `docs/roadmap.md`, `docs/roadmap.html` y `docs/estado.html` reflejan Fase 4 cerrada; retro de la fase registrada | Must |

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
