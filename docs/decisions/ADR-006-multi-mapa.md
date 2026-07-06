# ADR-006 — Estrategia multi-mapa

- **Estado:** Aceptada
- **Fecha:** 2026-07-06
- **Decidido por:** backend-developer (recomendación), project-manager (aprueba)
- **Sprint:** 9 (Fase 4 — Beta pública)
- **Tareas que cierra:** T-057-ADR-006

## Contexto

La Fase 3 dejó un único mapa en memoria (Ullathorpe, `mapId = 1`). La
arquitectura ya tiene `mapId` en sesiones, NPCs y ground items, y
`broadcastToMap` filtra por mapa, por lo que el modelo de datos soporta N mapas.
Lo que falta es:

1. **Carga de mapas adicionales** al inicio del proceso.
2. **Portales** — transiciones cuando el jugador pisa un tile-exit del formato AO.
3. **Transición en cliente** — limpiar y reconstruir la escena al cambiar de mapa.

Se evalúan dos enfoques para la arquitectura en producción:

| Criterio | A. Single-process | B. Multi-proceso / sharding por mapa |
|---|---|---|
| Complejidad | Baja (sin cambio de arquitectura) | Alta (IPC, sincronización entre procesos) |
| Latencia de portal | 0 (mismo proceso) | Alta (round-trip IPC) |
| Memoria | Todos los mapas en el heap de Node | Aislada por proceso |
| Escalado | Vertical (más RAM/CPU en el mismo VPS) | Horizontal (nuevo proceso por mapa) |
| Riesgo para la Beta | Mínimo | Alto (nuevo stack de IPC) |
| Umbral de conexiones | ~200-500 (objetivo Beta: 200) | Necesario solo > 500/mapa |

El load test de la Fase 3 dio P95 ~11 ms con 50 conexiones simultáneas, muy por
debajo del budget de 200 ms (R-06). Para la Beta (objetivo: 200 conexiones totales
repartidas entre ≥3 mapas), single-process es más que suficiente.

## Decisiones

### 1. Single-process con N mapas en memoria (Opción A)

Se mantiene el proceso único de Node.js. Todos los mapas se cargan al inicio en
el `Map<number, MapState>` de `world/maps.ts`.

**Razón:** la arquitectura ya lo soporta; cero cambios de IPC; la complejidad de
multi-proceso no se justifica hasta superar las ~500 conexiones por mapa (Fase 5+
si lo demanda la comunidad, R-06).

**Plan B registrado:** si el load test de 200 conexiones (T-085) supera los
200 ms de P95 en un único proceso, se evalúa sharding por proceso/mapa como
tarea de Fase 5.

### 2. Carga transitiva (BFS) de mapas al inicio

Al arrancar el servidor, se carga el mapa raíz (id = 1) y luego, transitivamente
por sus portales nativos, todos los mapas alcanzables. Los mapas cuyo archivo
`.map` / `.inf` no exista en `data/maps/` se saltan graciosamente; sus portales
quedan sin destino (no se activan).

**Razón:** elimina la lista manual de mapas a cargar; el servidor descubre
automáticamente el grafo de mundo disponible. Añadir un mapa nuevo = copiar los
archivos y reiniciar.

### 3. Portales nativos del formato AO (exits del .inf)

Los tiles del `.inf` de AO ya tienen un campo `exit { mapId, x, y }` parseado
por `ao-map-loader.ts`. Se expone como `MapState.portals` (array de
`PortalTile`) y se activa en el handler de movimiento del servidor.

Las coordenadas de exit en el `.inf` son 1-based (VB6); se convierten a 0-based
al extraerlas (`toX = exit.x − 1`, `toY = exit.y − 1`).

**Razón:** reutiliza la data de mundo del AO original sin necesidad de
configuración manual de portales; los mapas de AO ya tienen sus warps definidos.

### 4. `MapData` reutilizado para la transición (sin opcode nuevo)

Cuando el jugador pisa un portal, el servidor le envía el `MapData` del nuevo
mapa (mismo opcode `0x90`). El cliente detecta el cambio porque `data.mapId`
difiere del mapa actual.

**Razón:** el cliente ya reconstruye la escena completa al recibir `MapData`
(función `applyMapData`); añadir un opcode nuevo no aporta semántica extra.
Se documenta el uso dual en `protocol.md`.

## Consecuencias

- **Positivas:** implementación mínima; portales funcionan con cualquier mapa AO
  sin configuración; load test de 200 conexiones es el gate de escalado.
- **Negativas / deuda:** si el juego llega a N mapas grandes con muchas entidades,
  el único proceso se convierte en cuello de botella (R-06). El sharding queda
  documentado como plan B de Fase 5+.
- **Seguimiento:** T-085 (load test 200 conexiones multi-mapa) es el canario;
  si P95 > 100 ms, activar la discusión de sharding antes de la Beta pública.
