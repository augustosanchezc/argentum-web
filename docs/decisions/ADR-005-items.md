# ADR-005 — Diseño del sistema de items

- **Estado:** Aceptada
- **Fecha:** 2026-07-01
- **Decidido por:** backend-developer (recomendación), en el marco de la Fase 3 (MVP)
- **Sprint:** 6-8 (Fase 3)

## Contexto

La Fase 3 (MVP cerrado) requiere un loop de gameplay completo: *matar NPC →
lootear item → comprar/equipar en la tienda → volverse más fuerte → subir de
nivel*. Esto necesita un sistema de items, inventario, drops y comercio con NPC.
El objetivo es el **mínimo coherente y jugable**, no un sistema de items completo
(eso es Fase 4+). El riesgo histórico crítico del AO original es el **dupe de
items** (R-05); el diseño debe cerrar esa puerta desde el principio.

## Decisiones

### Catálogo estático en código compartido
- Los items se definen en `packages/shared/src/items.ts` (`ITEMS`), no en la DB.
- 5 items base: poción menor, daga, espada larga, armadura de cuero, casco.
- Campos: `id`, `name`, `type` (`weapon | armor | potion`), `value` (precio),
  `graphic`, y stats opcionales (`damageBonus`, `defense`, `heal`).

**Por qué:** el catálogo cambia con cada release, no en runtime. Tenerlo en
`@ao/shared` garantiza que server (aplica efectos) y cliente (muestra nombres y
precios) coincidan sin round-trips ni tablas de referencia.

### Inventario como JSON en `characters`
- Columna `inventory jsonb` (array de `{ item, qty }`), más `gold`,
  `equipped_weapon`, `equipped_armor`.
- Los items apilables (pociones) se acumulan en una sola posición.

**Por qué:** para 5 items y un inventario pequeño, una tabla `inventory` aparte
es sobre-ingeniería. El JSON es atómico con el resto del personaje (una sola
fila se persiste al desconectar). Si en Fase 4 el inventario crece (banco,
stacks grandes, trazabilidad), se migra a tabla propia.

### El servidor es autoritativo sobre todo movimiento de items
- El cliente **nunca** modifica su inventario localmente; solo envía intenciones
  (`PICKUP`, `USE_ITEM`, `SHOP_BUY`, `SHOP_SELL`) y renderiza el
  `INVENTORY_UPDATE` que responde el servidor.
- Toda transferencia (loot, compra, venta, equipar) se valida y aplica en el
  servidor, que reenvía el estado completo del inventario.

**Por qué:** mitiga R-05 (dupe) y el cheating de items. Enviar el inventario
completo en cada cambio (en vez de deltas) es más simple y menos propenso a
desincronización; el payload es chico.

### Economía y drops
- Oro: los NPCs sueltan oro **directo al matador** (rango por tipo). Los items
  caen **al suelo** según una *drop table* por tipo de NPC (`{ item, chance }`).
- Items en el suelo: entidades con id en espacio propio (`>= 2.000.000`), se
  recogen con `PICKUP` al estar parado encima.
- Tienda: se compra a `value` y se vende a `value / 2`. La compra/venta exige un
  comerciante a ≤ 3 tiles (validado en server).

**Por qué:** oro directo simplifica el loot más común; items al suelo dan la
mecánica clásica de AO de "lootear". La venta a mitad evita el arbitraje
infinito comprar/vender.

### Combate con equipo
- Arma equipada suma `damageBonus` al daño; armadura equipada resta `defense`
  al daño recibido (mínimo 1). Poción cura `heal` al usarse.
- Los bonos se derivan del equipo y se recalculan al equipar/loguear; si un item
  equipado deja el inventario, se des-equipa solo.

**Por qué:** formulas hardcodeadas simples y legibles; el balance real se pospone
(coherente con el roadmap). El mínimo de 1 evita que la armadura anule el combate.

### UI click-based en vez de drag-and-drop (por ahora)
- El inventario usa botones (Usar/Equipar/Vender); la tienda, botones de compra.

**Por qué:** entrega el loop jugable sin la complejidad del drag-and-drop, que
queda como polish (E-3.7) sin bloquear el DoD de la fase.

## Consecuencias

- **Positivas:** loop de gameplay cerrado y verificable; superficie de exploits
  mínima (server autoritativo); catálogo y protocolo simples de extender.
- **Negativas / deuda:** el inventario JSON no escala a features de Fase 4
  (banco, comercio jugador-jugador seguro) sin migrar a tabla propia con
  transacciones; el drag-and-drop y los sprites reales de items quedan pendientes.
- **Seguimiento:** el comercio jugador-jugador (Fase 4) exigirá transacciones SQL
  atómicas explícitas (commit/rollback) para cerrar R-05 en el caso multi-parte.
