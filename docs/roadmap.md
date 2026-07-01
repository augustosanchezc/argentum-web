# Roadmap — Argentum Online Web

> Documento vivo. Fecha de creación: 2026-06-19. Responsable: project-manager.
> Ancla de tiempo: Sprint 1 comienza la semana del 2026-06-23.
> Duración de sprint: 2 semanas.

> **Estado al 2026-07-01 (TG-01):** Fases 0, 1 y 2 **cerradas**; Fase 3 (MVP) al
> **80%** con el loop de gameplay cerrado. Hecho: auth + personajes, WebSocket
> binario con game loop a 10 Hz, mapa real de Ullathorpe con el tileset del AO,
> movimiento autoritativo, chat con filtro, combate cuerpo a cuerpo (HP, muerte,
> respawn), lista de online, controles táctiles, load test (20 sesiones, P95
> ~5 ms), **NPCs hostiles con IA + comerciante, experiencia y niveles 1-10,
> items, inventario, drops y tienda (comprar/vender/equipar)**.
>
> **Pendiente de Fase 3:** ADR-004 (diseño de items), inventario con
> drag-and-drop (hoy click-based), prueba de carga con 50 conexiones y
> `docs/architecture.md`.

---

## 1. Decisiones asumidas

Las siguientes 7 decisiones estaban abiertas al cierre del análisis (ver `docs/contexto-y-analisis.md` §7). Se resuelven aquí con asunciones justificadas para no bloquear la planificación. Cada una es **revisable con el usuario** antes del final de la Fase 0.

| # | Decisión | Asunción adoptada | Justificación |
|---|---|---|---|
| D-1 | **Licencia del proyecto** | AGPL-3.0 desde el día 1 | Elimina ambigüedad legal con los repos de referencia; coherente con la cultura del juego; código visible fortalece la comunidad y no penaliza el modelo de negocio elegido (D-6). ASUNCION — revisable con el usuario. |
| D-2 | **Versión de AO objetivo** | Clónico funcional de **0.13.3** con balance propio gradual | 0.13.3 es la versión con mayor documentación de-facto (mods comunitarios, ao-libre, dakara); suficiente para un MVP reconocible. AO20 agrega complejidad sin ventaja a corto plazo. ASUNCION — revisable con el usuario. |
| D-3 | **Alcance funcional del MVP** | Caminar + chat + atacar a otro jugador en un mapa, **sin inventario completo ni NPCs** | Valida el stack técnico (red, render, persistencia) con el menor scope. NPCs e inventario entran en Fase 3. ASUNCION — revisable con el usuario. |
| D-4 | **Compatibilidad con clientes existentes** | **No** — protocolo WebSocket propio (Opción B del análisis) | Permite trabajar en navegador de forma nativa sin proxy TCP. El cliente web propio es parte del diferencial del proyecto. Compatible con clientes VB6 puede añadirse post-MVP si hay demanda. ASUNCION — revisable con el usuario. |
| D-5 | **Modelo de comunidad** | **Servidor único oficial** durante al menos la beta cerrada | Facilita moderación, balance y coherencia de datos. Multi-servidor (federación) es una decisión Fase 5+ si la comunidad crece. ASUNCION — revisable con el usuario. |
| D-6 | **Monetización** | **Donaciones voluntarias** (Patreon / Ko-fi / MercadoPago) sin ventajas de gameplay | Coherente con AGPL y cultura AO; no requiere sistema de tienda en MVP. Pase cosmético se evalúa en Fase 4 según tracción. ASUNCION — revisable con el usuario. |
| D-7 | **Mobile-first vs desktop-first** | **Desktop-first** en Fase 1-2; controles táctiles como tarea paralela desde **Fase 2** | El juego clásico tiene grilla y UI densa difícil de adaptar en mobile sin rediseño; priorizamos tener algo jugable rápido en desktop y validamos mobile con la comunidad antes de Beta pública. ASUNCION — revisable con el usuario. |

---

## 2. Fases del proyecto

### Fase 0 — Setup y decisiones
**Duración:** Sprint 1 (2026-06-23 al 2026-07-04)

**Objetivo:** tener el entorno de desarrollo funcionando, el repositorio inicializado con licencia y estructura acordada, y los primeros ADRs escritos para que backend y frontend puedan arrancar sin ambigüedades.

**Criterios de aceptación (la fase cierra cuando todo esto es verdad):**
- [ ] Repositorio Git creado con `LICENSE` (AGPL-3.0), `.gitignore`, estructura de carpetas de monorepo.
- [ ] `README.md` actualizado con instrucciones de instalación y guía de contribución.
- [ ] Todos los programas de `PROGRAMAS-NECESARIOS.md` instalados y verificados (`git --version`, `node --version`, `docker --version`).
- [ ] Docker Compose levanta PostgreSQL + Redis sin errores.
- [ ] ADR-001 (licencia), ADR-002 (stack), ADR-003 (protocolo) escritos y mergeados.
- [ ] Borrador de `docs/protocol.md` con al menos los paquetes de login y movimiento definidos.
- [ ] `docs/design-system.md` con paleta de colores, tipografía y principios de UI acordados.

**Entregables por agente:**

| Agente | Entregables |
|---|---|
| **backend-developer** | Estructura de monorepo (`packages/server`, `packages/shared`), `docker-compose.yml`, esquema SQL inicial (tablas `accounts`, `characters`), borrador `docs/protocol.md` |
| **frontend-designer** | Estructura de `packages/client` con Vite + PixiJS v8 + TypeScript, `docs/design-system.md`, paleta visual inspirada en AO clásico |
| **project-manager** | `docs/roadmap.md` (este doc), `docs/backlog.md`, `docs/risks.md`, ADR-001 a ADR-003, `docs/definition-of-done.md` |

**Hitos visibles:**
- Semana 1: repo público, licencia y estructura; Docker Compose funcional.
- Semana 2: primer `npx vite` y primer `node server/index.ts` sin errores; ADRs mergeados.

**Riesgos en esta fase:**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Demora en decisión de licencia | Media | Alto (bloquea repo público) | Asunción D-1 adoptada; confirmación del usuario antes de fin de sprint |
| Incompatibilidades de Docker Desktop en Windows 11 | Baja | Medio | WSL2 + Ubuntu como fallback documentado |

---

### Fase 1 — Prototipo de red
**Duración:** Sprints 2-3 (2026-07-07 al 2026-07-31)

**Objetivo:** un personaje puede conectarse desde el navegador, autenticarse con usuario y contraseña, ver un mapa estático y moverse en tiempo real. Sin combate, sin chat completo, sin NPCs. Solo validar que el stack de red funciona de punta a punta.

**Criterios de aceptación:**
- [ ] Cliente web carga en Chromium y Firefox sin errores de consola críticos.
- [ ] Login HTTP con JWT: registro, inicio de sesión, selección de personaje.
- [ ] Conexión WebSocket establecida con token validado.
- [ ] Personaje aparece en el mapa con su sprite y posición correcta.
- [ ] Movimiento WASD / flechas con authoritative server: el servidor valida cada paso.
- [ ] Dos clientes abiertos simultáneamente se ven moverse mutuamente (latencia < 200ms en LAN).
- [ ] Mapa estático de 50x50 tiles cargado desde servidor (formato JSON/Tiled).
- [ ] Persistencia mínima: la posición del personaje se guarda al desconectarse.

**Entregables por agente:**

| Agente | Entregables |
|---|---|
| **backend-developer** | Servidor WebSocket (`ws` o `uWebSockets.js`), game loop con tick fijo (100ms), módulos: `auth`, `session`, `movement`, `map-loader`; paquetes de protocolo: `LOGIN`, `MOVE`, `DISCONNECT`, `MAP_DATA`, `ENTITY_UPDATE` |
| **frontend-designer** | Canvas PixiJS con tilemap renderizado, sprite del personaje animado (idle + walk 4 direcciones), input WASD/flechas, pantalla de login y selección de personaje |

**Hitos visibles:**
- Fin Sprint 2: login funcional, WebSocket conectando, tile en pantalla.
- Fin Sprint 3: dos jugadores viéndose moverse en el mismo mapa.

**Dependencias:**
- Requiere Fase 0 completa (protocolo definido, Docker funcional, estructura de monorepo).
- El diseño de paquetes en `docs/protocol.md` (Fase 0) es la interfaz entre backend y frontend: no puede haber trabajo en paralelo significativo hasta que esté cerrado.

**Riesgos en esta fase:**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Drift entre spec de protocolo y implementación real | Alta | Alto | `docs/protocol.md` es fuente de verdad; PR no mergeable si la spec no está actualizada |
| Latencia WebSocket inaceptable en Windows con `ws` | Baja | Medio | Evaluar `uWebSockets.js` si supera 150ms en LAN |
| Sprites del AO clásico sin licencia clara | Alta | Medio | Fase 1 usa sprites placeholder libres (OpenGameArt); sprites AO se evalúan en D-1 con el usuario |

---

### Fase 2 — Slice vertical jugable
**Duración:** Sprints 4-5 (2026-08-03 al 2026-08-28)

**Objetivo:** el juego es jugable de forma mínima: caminar, chatear con otros jugadores y golpear a otro personaje con ataque básico cuerpo a cuerpo. Con persistencia de stats y muerte/respawn simple. Es el primer momento en que el proyecto se puede mostrar a jugadores externos.

**Criterios de aceptación:**
- [ ] Chat global (sala única) funcional: mensajes con nombre de personaje, timestamp, scroll.
- [ ] Ataque cuerpo a cuerpo: tecla de ataque, animación de swing, cálculo de daño en servidor, barra de vida visible.
- [ ] Stats básicos persistidos en PostgreSQL: HP, MaxHP, nivel 1 fijo.
- [ ] Muerte y respawn: al morir el personaje reaparece en punto fijo del mapa.
- [ ] HUD mínimo: barra de HP, nombre de personaje, lista de jugadores online.
- [ ] El servidor rechaza movimientos y ataques inválidos (anti-cheat autoritativo).
- [ ] Tiempo de conexión a sesión jugable < 10 segundos en red local.
- [ ] Log de errores del servidor funcionando (Winston o Pino).

**Entregables por agente:**

| Agente | Entregables |
|---|---|
| **backend-developer** | Módulos: `chat`, `combat`, `stats`, `death-respawn`; paquetes: `CHAT_MSG`, `ATTACK`, `DAMAGE`, `DEATH`, `RESPAWN`; migraciones SQL para `stats`; sistema de logging |
| **frontend-designer** | HUD con barra HP, chat overlay, animación de ataque, efecto de daño (número flotante), pantalla de death/respawn; primer pase de controles táctiles (D-7) |

**Hitos visibles:**
- Fin Sprint 4: chat funcional, stats persistidos.
- Fin Sprint 5: combate PvP básico jugable; demo interna filmable.

**Dependencias:**
- Requiere Fase 1 completa.
- Controles táctiles mobile son trabajo paralelo del frontend-designer, sin bloquear el cierre de la fase.

**Riesgos en esta fase:**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Balance de daño / fórmulas de combate inestables | Alta | Bajo | Fórmulas hardcodeadas simples; balance real se pospone a Fase 3 |
| Anti-cheat complejo → scope creep | Media | Medio | MVP: solo validación de posición y cooldown de ataque en servidor |
| Performance del game loop bajo carga con chat+combate simultáneos | Baja | Alto | Load test con k6 antes de cerrar la fase (al menos 20 conexiones simultáneas) |

---

### Fase 3 — MVP cerrado
**Duración:** Sprints 6-8 (2026-09-01 al 2026-09-25)

**Objetivo:** experiencia de juego completa mínima: NPCs con IA básica, inventario, items lootables, sistema de experiencia y niveles, comercio con NPCs comerciantes. El juego tiene un loop de gameplay cerrado: matar → lootear → subir de nivel → volverse más fuerte.

**Criterios de aceptación:**
- [ ] Al menos 3 tipos de NPC: hostil (ataca al jugador), neutro (pasivo) y comerciante.
- [ ] Inventario persistido: el jugador puede recoger, equipar y soltar items.
- [ ] Al menos 5 items base: espada, escudo, poción HP, oro, item de trofeo (drop de NPC).
- [ ] Comercio con NPC: ventana de tienda, compra/venta de items por oro.
- [ ] Sistema de experiencia y niveles 1-10 (base para Beta).
- [ ] NPCs reaparecen en posición original tras un tiempo configurable.
- [ ] El servidor soporta al menos 50 conexiones simultáneas sin degradación visible.
- [ ] `docs/architecture.md` actualizado con el diseño de entidades post-MVP.

**Entregables por agente:**

| Agente | Entregables |
|---|---|
| **backend-developer** | Módulos: `npc-ai`, `inventory`, `items`, `experience`, `shop`; sistema de spawners; migraciones SQL para inventario e items; prueba de carga con k6 |
| **frontend-designer** | Ventana de inventario drag-and-drop, ventana de tienda NPC, barra de XP, indicadores de nivel, sprites de NPCs placeholder |

**Hitos visibles:**
- Fin Sprint 6: NPC hostil funcional, drops de items.
- Fin Sprint 7: inventario completo persistido, comercio con NPC.
- Fin Sprint 8: niveles 1-10, prueba de carga superada, cierre de MVP.

**Dependencias:**
- Requiere Fase 2 completa.
- El diseño del sistema de items (tipos, slots, estadísticas) debe estar acordado entre backend y frontend al inicio de la fase (ADR-004 propuesto).

**Riesgos en esta fase:**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| IA de NPCs más compleja de lo estimado | Media | Medio | IA básica: pathfinding A\* simple en mapa de grilla; comportamientos avanzados → backlog |
| Inventario drag-and-drop complejo en mobile | Media | Bajo | Mobile en Fase 3 es best-effort; el requisito firme es desktop |
| Scope creep con pedidos de nuevas clases/hechizos | Alta | Alto | Todo lo que no sea los 5 items base va al backlog de Fase 5 |

---

### Fase 4 — Beta pública
**Duración:** Sprints 9-12 (2026-09-29 al 2026-10-23)

**Objetivo:** el servidor está accesible en internet, con múltiples mapas, teletransportes entre zonas, banco de items, party system básico, comercio jugador-jugador, observabilidad de producción y canal de feedback. Se invitan los primeros jugadores externos.

**Criterios de aceptación:**
- [ ] Al menos 3 mapas con transiciones (portales/teletransportes).
- [ ] Banco de items persistido por personaje.
- [ ] Party de hasta 5 jugadores: daño compartido no se aplica entre aliados.
- [ ] Comercio jugador-jugador: ventana de intercambio seguro (commit/cancel).
- [ ] Servidor desplegado en VPS con dominio, HTTPS y WSS.
- [ ] Métricas con Grafana + Prometheus; alertas básicas de caída.
- [ ] Sentry integrado en cliente y servidor.
- [ ] Canal de Discord abierto con canal #bugs y #feedback.
- [ ] El servidor soporta 200 conexiones simultáneas.
- [ ] Política de privacidad y términos de uso publicados (requerido por AGPL).

**Entregables por agente:**

| Agente | Entregables |
|---|---|
| **backend-developer** | Múltiples mapas + sistema de transición, banco, party system, comercio seguro, despliegue en VPS (Caddy + Docker), Prometheus + Grafana, Sentry server-side |
| **frontend-designer** | UI de mapas adicionales, ventana de banco, UI de party (lista de miembros, HP aliados), ventana de comercio seguro, Sentry client-side, mejoras UX basadas en feedback interno |

**Hitos visibles:**
- Fin Sprint 9: multi-mapa funcional.
- Fin Sprint 10: banco y party.
- Fin Sprint 11: servidor en producción, observabilidad activa.
- Fin Sprint 12: primera invitación a jugadores externos, Discord abierto.

**Dependencias:**
- Requiere Fase 3 completa.
- La infraestructura de producción (VPS, dominio, DNS) debe estar contratada antes del Sprint 11.

**Riesgos en esta fase:**

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Bugs críticos de seguridad en comercio jugador-jugador | Media | Alto | Ventana con commit/rollback atómico en BD; revisión de código obligatoria |
| Exploits de duplicación de items (dupe) histórico en AO | Alta | Alto | Toda transferencia de items con transacción SQL; logs auditables |
| Costos de VPS subestimados | Baja | Medio | Empezar con VPS de 4 vCPU / 8 GB RAM; escalar verticalmente si hace falta |
| Toxicidad en comunidad early-beta | Media | Medio | Moderación activa en Discord; sistema de mute/ban desde Sprint 12 |

---

### Fase 5+ — Post-beta (roadmap tentativo)

Estas épicas entran al backlog una vez que la Beta pública esté estabilizada. Se priorizan según feedback de la comunidad.

| Épica | Descripción |
|---|---|
| Clases de personaje | Guerrero, mago, druida, asesino con habilidades diferenciadas |
| Hechicería completa | Sistema de maná, hechizos ofensivos/defensivos/de utilidad |
| PvP organizado | Duelos, arenas, zonas de seguridad vs. zonas libres |
| Guilds (clanes) | Creación, jerarquía, chat de clan, territorio |
| Multi-servidor | Código desplegable por la comunidad bajo AGPL; guía de instalación |
| Assets pixel-art originales | Sprites comisionados o generados para evitar riesgo legal de assets AO clásico |
| Mobile completo | Layout responsivo, controles táctiles completos, PWA |
| Economía avanzada | Subastas, consignación, mercado entre personajes |

---

## 3. Dependencias críticas entre fases

```
Fase 0 (Setup)
    └── Fase 1 (Proto red)       ← BLOQUEA: protocolo y estructura definidos
            └── Fase 2 (Slice jugable)  ← BLOQUEA: auth y movimiento estables
                    └── Fase 3 (MVP)   ← BLOQUEA: combate y stats estables
                            └── Fase 4 (Beta)  ← BLOQUEA: entidades completas, infra lista
```

**Dependencias transversales:**
- `docs/protocol.md` es interfaz entre backend y frontend en cada fase. Cualquier cambio de protocolo requiere actualización sincronizada de ambos lados.
- Assets gráficos (sprites, tiles) no bloquean la lógica de servidor pero sí bloquean el cierre de fases desde el lado frontend. Placeholders libres desbloquean el desarrollo.
- La infraestructura de producción (VPS) no es necesaria hasta Fase 4, pero el contrato de VPS debe iniciarse durante Fase 3.

---

## 4. Riesgos globales del proyecto

| ID | Riesgo | Prob. | Impacto | Fase expuesta | Mitigación |
|---|---|---|---|---|---|
| R-01 | Contagio AGPL por copia de código de repos de referencia | Media | Alto | Todas | AGPL desde día 1 (D-1); prohibido copiar código verbatim de ao-org/ao-libre; solo lectura conceptual |
| R-02 | Assets gráficos sin licencia (sprites AO clásico) | Alta | Medio | Fase 1+ | Placeholders libres en desarrollo; decisión de assets propios antes de Beta (Fase 4) |
| R-03 | Reverse engineering del protocolo VB6 (si se cambia D-4) | Alta (si aplica) | Alto | Fase 1 | Protocolo propio WebSocket (D-4 actual); no aplicable salvo revisión del usuario |
| R-04 | Anti-cheat insuficiente → exploits de movimiento y combate | Alta | Alto | Fase 2+ | Servidor autoritativo desde Fase 1; validación de cada paquete |
| R-05 | Dupe de items (bug histórico crítico en AO) | Alta | Alto | Fase 3+ | Transacciones SQL atómicas para toda transferencia de items |
| R-06 | Escalado del game loop bajo carga real | Media | Alto | Fase 4 | Diseño por zona/mapa desde Fase 1; sharding horizontal como plan B |
| R-07 | Comunidad fragmentada o comparaciones negativas con aoweb.app | Media | Medio | Fase 4 | Diferenciación clara: stack abierto, AGPL, desktop-first de calidad |
| R-08 | Scope creep — features pedidas por la comunidad antes del MVP | Alta | Medio | Fase 2-3 | Backlog visible; política explícita de "no en este sprint" |
| R-09 | Un solo desarrollador backend activo → bus factor = 1 | Alta (asumo) | Alto | Todas | Documentación de arquitectura actualizada; ADRs que capturen el razonamiento |
| R-10 | Costos de infraestructura subestimados en Beta | Baja | Medio | Fase 4 | Presupuesto inicial con VPS ≤ USD 40/mes; escalar solo con jugadores reales |

---

## 5. Definition of Done por fase

| Fase | Definition of Done |
|---|---|
| **Fase 0** | Repo público con licencia; Docker Compose funcional; ADRs 1-3 mergeados; todos los programas verificados. |
| **Fase 1** | Dos navegadores distintos conectados simultáneamente, dos personajes visibles moviéndose, posición persistida al desconectar. |
| **Fase 2** | Sesión de juego de 5 minutos grabada: un jugador mata a otro, chatea, y el perdedor reaparece. Sin bugs críticos conocidos. |
| **Fase 3** | Loop completo jugable: personaje nivel 1 → mata NPC → lootea item → compra en tienda → sube a nivel 2. Probado con 50 conexiones simultáneas. |
| **Fase 4** | 100 jugadores reales en Discord; servidor estable 24/7 con uptime > 99% en las primeras 2 semanas; canal de bugs activo. |

---

## 6. Preguntas para el usuario

Las siguientes decisiones tienen impacto directo en el alcance y requieren confirmación antes de que sus fases inicien. Se ordenan por urgencia.

**Urgentes (antes de fin de Fase 0 / Sprint 1):**

1. **D-1 — Licencia:** ¿Confirmás AGPL-3.0 como licencia del proyecto? Si preferís mantener el código privado o usar MIT, el alcance del uso de repos de referencia cambia significativamente.

2. **D-2 — Versión objetivo:** ¿Querés un clon fiel de AO 0.13.3 (mecánicas conocidas por la comunidad existente) o preferís más libertad para rebalancear desde el principio? Esto afecta el diseño de fórmulas de combate y el trabajo del backend desde Fase 2.

3. **Assets gráficos (R-02):** ¿Tenés intención de usar los sprites clásicos de AO asumiendo el riesgo legal, contratar pixel-art original, o empezar con assets libres? Esta decisión define si el frontend-designer necesita un presupuesto para arte.

**Importantes (antes de Fase 2):**

4. **D-7 — Mobile:** ¿Mobile es un requisito de negocio para la Beta, o puede quedar como mejora post-Beta? Si es requisito, el frontend-designer necesita empezar el diseño táctil desde Fase 1.

5. **D-6 — Monetización:** ¿Solo donaciones, o ya estás pensando en algún modelo cosmético para la Beta? Afecta qué datos de personaje hay que persistir y si necesitamos integración de pagos.

**Puede esperar hasta Fase 3:**

6. **D-5 — Multi-servidor:** ¿El objetivo final es una experiencia única (servidor oficial) o quisieras que cualquiera pueda levantar su propio servidor? Afecta las decisiones de arquitectura de Fase 4+.

---

*Próxima revisión del roadmap: al cierre de cada fase o ante cambio de scope significativo.*
