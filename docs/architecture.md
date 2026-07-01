# Arquitectura — Argentum Online Web (post-MVP)

> Documento vivo. Refleja el estado al cierre del loop de gameplay de la Fase 3
> (2026-07-01). Complementa los ADRs (`docs/decisions/`) y el protocolo
> (`docs/protocol.md`).

## 1. Vista general

Monorepo pnpm con tres paquetes:

```
packages/
  shared/   @ao/shared  — protocolo, tipos y catálogo de items (sin runtime)
  server/   @ao/server  — Fastify + WebSocket + game loop + Postgres (Drizzle)
  client/   @ao/client  — Vite + PixiJS v8, renderiza el mundo y la UI
```

`@ao/shared` es la fuente de verdad del contrato entre server y cliente: opcodes,
formas de paquetes (`protocol.ts`), tipos de entidad (`entities.ts`) y catálogo de
items (`items.ts`). Ambos lados lo importan, así el protocolo evoluciona en
lock-step (ver ADR-002).

## 2. Server

### Capas
- **HTTP (Fastify)** — `routes/auth.ts` (register/login con JWT + bcrypt),
  `routes/characters.ts` (CRUD de personajes). `app.ts` arma la instancia.
- **WebSocket** — `ws/index.ts` es el núcleo: handshake por JWT, ruteo de
  opcodes y toda la lógica autoritativa (movimiento, combate, items, tienda).
- **Game loop** — `ws/loop.ts`, tick fijo de 100 ms (10 Hz): reaparición de
  jugadores y NPCs, e IA de NPCs (agro, persecución, ataque).
- **Mundo** — `world/`: carga de mapas del AO (`ao-map-loader.ts`, `maps.ts`),
  movimiento (`movement.ts`), combate (`combat.ts`), XP/niveles (`xp.ts`),
  NPCs (`npcs.ts`), inventario (`inventory.ts`) e items del suelo
  (`ground-items.ts`).
- **Persistencia** — Postgres vía Drizzle (`db/`); migraciones en `drizzle/`.

### Estado en memoria vs. persistido
El estado de juego vive en memoria (registros de sesiones, NPCs, items del suelo).
Postgres guarda solo lo durable del personaje (posición, stats, xp, oro,
inventario, equipo), que se persiste al desconectar y se carga en el handshake.

### Espacios de IDs de entidad
Para que jugadores, NPCs e items del suelo compartan el mismo campo `id` en el
protocolo sin colisionar:

| Rango | Entidad |
|---|---|
| serial de la DB (bajo) | Personajes de jugador |
| `>= 1.000.000` | NPCs (`NPC_ID_BASE`) |
| `>= 2.000.000` | Items en el suelo (`GROUND_ID_BASE`) |

### Modelo de datos (tabla `characters`)
`id, account_id, name, level, xp, hp, max_hp, gold, inventory (jsonb),
equipped_weapon, equipped_armor, map_id, pos_x, pos_y, direction, timestamps`.
`max_hp` se deriva del nivel en cada login para evitar drift (ver `xp.ts`).

## 3. Cliente

- **Escena de juego** (`scenes/game.ts`): PixiJS. Capas del mundo: tiles →
  items del suelo → entidades. Cámara centrada en el jugador; interpolación de
  movimiento; predicción optimista con reconciliación por ACK del server.
- **Tileset real** (`world/tileset.ts`): carga `graficos.json` + PNGs del AO bajo
  demanda y arma sub-texturas por grh.
- **UI (DOM overlay)**: `ui/chat.ts`, `ui/player-list.ts`, `ui/inventory.ts`,
  `ui/shop.ts`, `ui/touch-controls.ts`. El HUD de combate (HP, XP, nivel) y los
  números de daño se dibujan en el canvas.
- **Red** (`net/ws.ts`, `net/codec.ts`): WebSocket con reconexión y MessagePack.

## 4. Protocolo (resumen)

Binario sobre WebSocket, MessagePack. Familias de opcodes por rango
(ver `docs/protocol.md` §4). El server es autoritativo: el cliente envía
intenciones y renderiza el estado que responde el server. Paquetes clave por
área: auth/handshake, mundo (`MAP_DATA`, entidades, items del suelo), combate
(`ATTACK`/`DAMAGE`/`DEATH`/`RESPAWN`), progresión (`STATS_UPDATE`) e inventario/
tienda (`INVENTORY_UPDATE`, `SHOP_OPEN`, etc.).

## 5. Loop de gameplay (Fase 3)

```
mover/explorar → atacar NPC (con arma) → NPC muere → suelta oro + item al suelo
    → recoger (PICKUP) → comprar/equipar en la tienda del Mercader
    → ganar XP → subir de nivel (más HP, curación) → repetir
```

## 6. Rendimiento

Load test (`scripts/load-test.mjs`) sobre el protocolo binario real:
- 20 sesiones / 20 s → P95 ~5 ms.
- 50 sesiones / 30 s → P95 ~11 ms, 0 crashes.
Muy por debajo del presupuesto de 200 ms para el MVP.

## 7. Pendiente (hacia el cierre de Fase 3 y Fase 4)

- ADR-005 ya define el sistema de items; falta inventario con drag-and-drop
  (hoy click-based) y sprites reales de items/NPCs.
- Fase 4: multi-mapa con portales, banco, party, comercio jugador-jugador con
  transacciones atómicas (R-05), deploy en VPS con WSS y observabilidad.
