# Protocolo de red — Argentum Online Web

- **Version del documento:** 1.0
- **Fecha:** 2026-06-19
- **Responsable:** backend-developer
- **ADR de referencia:** [ADR-003 — Protocolo de red](decisions/ADR-003-protocolo.md)
- **Tarea que cierra:** T-012

---

## §1 Transporte y framing

El servidor expone un endpoint WebSocket:

- **Produccion:** `wss://<host>/ws` (sobre HTTPS/TLS)
- **Desarrollo local:** `ws://localhost:<puerto>/ws`

Cada mensaje WebSocket es exactamente **un paquete MessagePack**. No hay framing adicional encima de MessagePack: la longitud del mensaje queda delegada al protocolo WebSocket, y el encoding/decoding de tipos queda delegado a MessagePack.

El primer campo de cada paquete es siempre `op` (`uint8`). El valor de `op` determina el schema del resto del mensaje. No se define un campo de longitud separado porque MessagePack incluye esa informacion en su propio encoding.

Endianness: MessagePack es big-endian internamente; el servidor y el cliente no deben asumir endianness de capa inferior.

Limite de tamano de paquete: 64 KB por mensaje WebSocket. Paquetes que excedan ese limite seran rechazados con codigo de cierre 4003.

---

## §2 Handshake (establecimiento de sesion)

```
Cliente                           Servidor
  |                                  |
  |--- WebSocket open ------------->|
  |                                  |
  |--- LoginRequest (0x01) -------->|  (primer paquete obligatorio)
  |                                  |
  |<-- LoginResponse (0x81) --------|
  |                                  |
  | [si ok=true]                     |
  |<-- MapData (0x90) -------------|  (datos del mapa inicial)
  |<-- EntitySpawn (0x92) x N -----|  (entidades visibles al spawn)
  |                                  |
  | [sesion activa]                  |
  |<=========== bidireccional =====>|
```

**Reglas de handshake:**

1. El cliente abre la conexion WebSocket a `wss://<host>/ws`.
2. El primer paquete que envia el cliente debe ser `LoginRequest` (opcode `0x01`). Cualquier otro paquete antes del login resulta en cierre con codigo 4001.
3. El servidor valida el campo `token` (JWT firmado con el secret del servidor) y verifica que el `characterId` pertenezca al usuario autenticado por ese token.
4. Si `clientVersion` es menor que `PROTOCOL_VERSION` del servidor, el servidor rechaza la conexion con `LoginResponse { ok: false, reason: "OUTDATED_CLIENT" }` y cierra el socket con codigo 4005.
5. Si la autenticacion es exitosa, el servidor responde con `LoginResponse { ok: true, character: CharacterSummary }` y a continuacion envia `MapData` y los `EntitySpawn` de las entidades visibles.
6. Si la autenticacion falla por cualquier otro motivo, el servidor responde con `LoginResponse { ok: false, reason: "<motivo>" }` y cierra el socket con codigo 4001.

---

## §3 Versionado del protocolo

La constante `PROTOCOL_VERSION = 1` vive en `packages/shared/src/protocol.ts` y es la fuente de verdad.

| Tipo de cambio | Accion requerida |
|---|---|
| Breaking (campo obligatorio renombrado, semantica cambiada, opcode reutilizado) | Incrementar `PROTOCOL_VERSION`, actualizar esta doc, forzar upgrade del cliente |
| Additive (nuevo paquete opcional, nuevo campo opcional al final de un paquete existente) | No incrementar; agregar la seccion en este doc; el campo es ignorado por clientes anteriores |

**Regla de PR:** ningun paquete nuevo puede mergearse al server sin que el tipo TypeScript correspondiente este en `@ao/shared` y la seccion de este documento este actualizada. Esta regla mitiga el riesgo R-04 del roadmap.

---

## §4 Familias de opcodes

| Rango | Familia | Estado |
|---|---|---|
| `0x00–0x0F` | Autenticacion y sesion (C→S) | Fase 1 |
| `0x10–0x1F` | Movimiento e input del jugador (C→S) | Fase 1 |
| `0x20–0x2F` | Chat (C→S) | Fase 2 |
| `0x30–0x3F` | Combate (C→S) | Fase 2 |
| `0x40–0x4F` | Inventario / items (C→S) | Fase 3 |
| `0x80–0x8F` | Respuestas de auth/sesion (S→C) | Fase 1 |
| `0x90–0x9F` | Updates de mundo / entidades (S→C) | Fase 1 |
| `0xF0–0xFF` | Desconexion y errores | Fase 1 |

Los opcodes no asignados dentro de un rango reservado NO pueden usarse hasta que la fase correspondiente los defina. Un opcode desconocido recibido por el servidor resulta en cierre 4002.

---

## §5 Paquetes — Fase 1

### 5.1 LOGIN\_REQUEST — `0x01` — C→S

Tipo TS: `LoginRequest` en `@ao/shared/protocol.ts`

Primer paquete que envia el cliente tras abrir la conexion WebSocket. El servidor no acepta ningun otro paquete antes de este.

**Campos:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `op` | uint8 | Opcode: `0x01` |
| `token` | string (UTF-8) | JWT de sesion HTTP emitido por el endpoint REST de login |
| `characterId` | uint32 (EntityId) | ID del personaje con el que el jugador quiere entrar |
| `clientVersion` | uint8 | Version del protocolo del cliente; debe ser igual a `PROTOCOL_VERSION` del servidor |

**Validaciones del servidor:**

- `token` debe ser un JWT valido, firmado con el secret del servidor, no expirado.
- El `sub` del JWT debe corresponder a una cuenta existente en la base de datos.
- `characterId` debe pertenecer a esa cuenta.
- `clientVersion` debe ser igual a `PROTOCOL_VERSION`. Si es menor, rechazar con `reason: "OUTDATED_CLIENT"` y cierre 4005. Si es mayor (cliente mas nuevo), tambien rechazar — el servidor debe ser el punto de actualizacion, no el cliente.

**Ejemplo:**

```json
{
  "op": 1,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsImlhdCI6MTc1MDMzNjAwMH0.xxx",
  "characterId": 7,
  "clientVersion": 1
}
```

---

### 5.2 LOGIN\_RESPONSE — `0x81` — S→C

Tipo TS: `LoginResponse` en `@ao/shared/protocol.ts`

Respuesta del servidor al `LOGIN_REQUEST`. Si `ok` es `false`, el servidor cierra el socket inmediatamente despues de enviar este paquete.

**Campos:**

| Campo | Tipo | Presente cuando | Descripcion |
|---|---|---|---|
| `op` | uint8 | Siempre | Opcode: `0x81` |
| `ok` | bool | Siempre | `true` si la autenticacion fue exitosa |
| `reason` | string (UTF-8) | `ok = false` | Codigo de rechazo legible por el cliente |
| `character` | object (CharacterSummary) | `ok = true` | Resumen del personaje que ingresa |

**Estructura de `CharacterSummary`:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | uint32 (EntityId) | ID unico del personaje |
| `name` | string (UTF-8) | Nombre visible del personaje |
| `level` | uint8 | Nivel actual |

**Valores posibles de `reason`:**

| Valor | Significado |
|---|---|
| `"INVALID_TOKEN"` | JWT invalido, expirado o con firma incorrecta |
| `"CHARACTER_NOT_FOUND"` | El `characterId` no existe o no pertenece a la cuenta |
| `"OUTDATED_CLIENT"` | `clientVersion` < `PROTOCOL_VERSION` del servidor |
| `"ALREADY_CONNECTED"` | El personaje ya tiene una sesion activa |
| `"SERVER_ERROR"` | Error interno del servidor |

**Ejemplo (exito):**

```json
{
  "op": 129,
  "ok": true,
  "character": {
    "id": 7,
    "name": "Gandalf",
    "level": 12
  }
}
```

**Ejemplo (rechazo):**

```json
{
  "op": 129,
  "ok": false,
  "reason": "OUTDATED_CLIENT"
}
```

---

### 5.3 MOVE — `0x10` — C→S

Tipo TS: `MoveRequest` en `@ao/shared/protocol.ts`

El cliente envia este paquete cada vez que el jugador presiona una tecla de movimiento. El servidor valida la solicitud y, si es valida, actualiza la posicion autoritativa y difunde `ENTITY_UPDATE` a los clientes cercanos.

**Campos:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `op` | uint8 | Opcode: `0x10` |
| `direction` | string | Una de: `"north"`, `"south"`, `"east"`, `"west"` |
| `sequence` | uint32 | Numero de secuencia monotonicamente creciente asignado por el cliente |

**Uso de `sequence` para reconciliacion:**

El campo `sequence` permite al cliente implementar prediccion local de movimiento (el jugador ve su personaje moverse inmediatamente, sin esperar confirmacion del servidor). El servidor incluye el `sequence` recibido en el `ENTITY_UPDATE` correspondiente. El cliente compara el `sequence` del update con el ultimo que envio: si coincide, confirma el movimiento predicho; si difieren o llega un estado distinto al predicho, el cliente hace rollback a la posicion autoritativa del servidor.

El servidor no garantiza que cada `sequence` reciba una respuesta individual; puede batchar updates.

**Validaciones del servidor:**

- `direction` debe ser exactamente uno de los cuatro valores validos.
- Cooldown: el servidor aplica un cooldown configurable entre movimientos (default: **100 ms por tile**). Si el cliente envia MOVE antes de que expire el cooldown del movimiento anterior, el paquete es ignorado (no produce error, pero tampoco mueve al personaje). Excesos sistematicos activan el rate limit y cierran la conexion con codigo 4004.
- Colision: la tile destino debe ser transitable (no bloqueada, no agua salvo que el personaje tenga la capacidad). El servidor consulta el mapa autoritativo, nunca el estado del cliente.
- Adyacencia: el destino debe ser exactamente una tile adyacente a la posicion actual. No se admiten saltos ni teleports via este paquete.

**Ejemplo:**

```json
{
  "op": 16,
  "direction": "north",
  "sequence": 42
}
```

---

### 5.4 MAP\_DATA — `0x90` — S→C

Tipo TS: `MapData` en `@ao/shared/protocol.ts`

El servidor envia este paquete inmediatamente despues de un login exitoso (y ante cambio de mapa en fases futuras). Describe el mapa completo en el que el personaje hace spawn.

**Campos:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `op` | uint8 | Opcode: `0x90` |
| `mapId` | uint16 | ID unico del mapa |
| `width` | uint16 | Ancho del mapa en tiles |
| `height` | uint16 | Alto del mapa en tiles |
| `tiles` | array de uint16 | Array plano de indices de tile, en orden row-major (fila por fila, de izquierda a derecha, de arriba hacia abajo) |
| `entities` | array de objects | Entidades visibles al momento del spawn (ver estructura abajo) |

**Formato del array `tiles`:**

El array tiene exactamente `width * height` elementos. El indice de la tile en la posicion `(x, y)` es `tiles[y * width + x]`. Cada elemento es un `uint16` que representa el indice de tile en el tileset del cliente. El bit mas significativo (bit 15) esta reservado: si vale `1`, la tile es no transitable (bloqueada). Los 15 bits restantes son el indice visual.

Ejemplo para un mapa de 3x2:

```
(0,0) (1,0) (2,0)
(0,1) (1,1) (2,1)

tiles = [t00, t10, t20, t01, t11, t21]
```

**Estructura de cada entidad en `entities`:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | uint32 (EntityId) | ID unico de la entidad |
| `position` | object Vector2 | Posicion en tiles `{ x: uint16, y: uint16 }` |
| `name` | string (UTF-8) | Nombre visible |

> Nota: el campo `direction` no esta presente en `MapData.entities` segun el tipo TS actual. Las entidades del mapa inicial reciben su direccion a traves de los `ENTITY_SPAWN` que siguen a este paquete (ver §5.6).

**Ejemplo:**

```json
{
  "op": 144,
  "mapId": 1,
  "width": 50,
  "height": 50,
  "tiles": [1, 1, 1, 0, 2, 1, ...],
  "entities": [
    { "id": 3, "position": { "x": 10, "y": 15 }, "name": "Saruman" }
  ]
}
```

---

### 5.5 ENTITY\_UPDATE — `0x91` — S→C

Tipo TS: `EntityUpdate` en `@ao/shared/protocol.ts`

El servidor difunde este paquete a todos los clientes con visibilidad de la entidad cada vez que su posicion o direccion cambia. Tambien se usa como confirmacion de movimiento para el cliente que origino el `MOVE`.

**Campos:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `op` | uint8 | Opcode: `0x91` |
| `id` | uint32 (EntityId) | ID de la entidad que se actualiza |
| `position` | object Vector2 | Nueva posicion autoritativa `{ x: uint16, y: uint16 }` |
| `direction` | string | Direccion de la entidad: `"north"`, `"south"`, `"east"`, `"west"` |

> Cuando este paquete corresponde a la confirmacion de un `MOVE` del propio jugador, el servidor puede incluir un campo `sequence` (uint32) con el valor del `MOVE` que lo origino. **Este campo no esta aun en el tipo TS `EntityUpdate` — es una extension pendiente para implementar reconciliacion completa. Se agregara antes del Sprint 3.**

**Ejemplo:**

```json
{
  "op": 145,
  "id": 7,
  "position": { "x": 11, "y": 15 },
  "direction": "east"
}
```

---

### 5.6 ENTITY\_SPAWN — `0x92` — S→C

Tipo TS: `EntitySpawn` en `@ao/shared/protocol.ts`.

El servidor envia este paquete cuando una entidad entra en el rango de vision de un cliente (incluyendo al propio jugador al hacer login). Se envia despues de `MAP_DATA`.

**Campos:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `op` | uint8 | Opcode: `0x92` |
| `id` | uint32 (EntityId) | ID unico de la entidad |
| `position` | object Vector2 | Posicion inicial `{ x: uint16, y: uint16 }` |
| `name` | string (UTF-8) | Nombre visible |
| `direction` | string | Direccion inicial: `"north"`, `"south"`, `"east"`, `"west"` |

**Ejemplo:**

```json
{
  "op": 146,
  "id": 3,
  "position": { "x": 10, "y": 15 },
  "name": "Saruman",
  "direction": "south"
}
```

---

### 5.7 ENTITY\_DESPAWN — `0x93` — S→C

Tipo TS: `EntityDespawn` en `@ao/shared/protocol.ts`.

El servidor envia este paquete cuando una entidad sale del rango de vision de un cliente o se desconecta.

**Campos:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `op` | uint8 | Opcode: `0x93` |
| `id` | uint32 (EntityId) | ID de la entidad que desaparece |

**Ejemplo:**

```json
{
  "op": 147,
  "id": 3
}
```

---

### 5.8 DISCONNECT — `0xFF` — C→S

Tipo TS: `DisconnectRequest` en `@ao/shared/protocol.ts`.

Paquete opcional que el cliente envia para iniciar un cierre limpio. Permite al servidor persistir el estado del personaje de forma sincronizada antes de cerrar la sesion, en lugar de depender del evento de cierre del WebSocket.

**Campos:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `op` | uint8 | Opcode: `0xFF` |

No lleva campos adicionales. El servidor, al recibirlo, persiste la posicion y estado del personaje, cierra la sesion y responde con un cierre WebSocket con codigo 1000.

**Ejemplo:**

```json
{
  "op": 255
}
```

---

## §6 Reglas globales del servidor autoritativo

El servidor es la unica fuente de verdad. El cliente nunca puede alterar el estado del juego directamente; solo puede enviar intenciones que el servidor valida y aplica.

**Validacion de paquetes:**

- Cada paquete recibido se parsea con MessagePack. Si el parseo falla, se cierra la conexion con codigo 4003.
- Si el opcode no corresponde a un paquete conocido, se cierra con codigo 4002.
- Si el paquete parsea pero no cumple el schema esperado (campo faltante, tipo incorrecto, valor fuera de rango), se cierra con codigo 4003.

**Movimiento (anti-cheat basico — R-04):**

- Rate limit: cooldown de 100 ms entre movimientos por conexion. Configurable en las variables de entorno del servidor.
- Colision server-side: el servidor mantiene la copia autoritativa del mapa y verifica que el tile destino sea transitable.
- Adyacencia: solo se acepta un desplazamiento de exactamente una tile por paquete `MOVE`. No se acepta movimiento diagonal.
- Incumplimiento de cooldown: primer incidente → ignorar el paquete. Patron sistematico (mas de N incidentes en M segundos, configurable) → cierre con codigo 4004.

**Sesion:**

- Solo se acepta `LOGIN_REQUEST` como primer paquete. Cualquier paquete antes del login cierra la conexion con 4001.
- Una vez autenticado, `LOGIN_REQUEST` adicionales se ignoran (no producen error, no reinician la sesion).

---

## §7 Codigos de cierre WebSocket

| Codigo | Nombre | Descripcion |
|---|---|---|
| `1000` | Cierre normal | El servidor o el cliente cerraron limpiamente (ej.: el cliente envio `DISCONNECT`) |
| `4001` | Auth failed | JWT invalido, expirado, `characterId` incorrecto, o primer paquete no fue `LOGIN_REQUEST` |
| `4002` | Opcode desconocido | El servidor recibio un opcode que no esta definido en el protocolo actual |
| `4003` | Paquete invalido | El paquete no pudo ser deserializado (MessagePack invalido) o no cumple el schema |
| `4004` | Rate limit excedido | El cliente supero el umbral de rate limit de movimiento u otras acciones |
| `4005` | Version incompatible | `clientVersion` != `PROTOCOL_VERSION` del servidor |

---

## §8 Pendientes para Fase 2 y posteriores

Los siguientes paquetes estan reservados en sus rangos de opcode pero no tienen tipo TS ni spec completa aun. Se documentan aqui para reservar los opcodes y guiar el diseno.

### Fase 2 — Chat

| Paquete | Opcode | Direccion | Estado |
|---|---|---|---|
| `CHAT_MSG` | `0x20` | C→S y S→C | Pendiente — requiere tipo TS y seccion en este doc |

El `CHAT_MSG` del cliente llevara: `op`, `text` (string, max 255 chars), `channel` (uint8 — global, zona, privado). El del servidor incluira ademas `senderId` (EntityId) y `senderName` (string).

### Fase 2 — Combate

| Paquete | Opcode | Direccion | Estado |
|---|---|---|---|
| `ATTACK` | `0x30` | C→S | Pendiente |
| `DAMAGE` | `0x91` (*) | S→C | Pendiente — puede ser un subtipo de `ENTITY_UPDATE` o un paquete separado en `0x94` |
| `DEATH` | `0x95` | S→C | Pendiente |
| `RESPAWN` | `0x96` | S→C | Pendiente |

(*) El opcode definitivo de `DAMAGE` se decidira en el ADR correspondiente a Fase 2 para no consumir espacio del rango `0x9x` prematuramente.

### Regla para nuevos paquetes

Todo paquete nuevo debe seguir este flujo antes de ser implementado:

1. Agregar el tipo TypeScript en `packages/shared/src/protocol.ts`.
2. Agregar la seccion en este documento con campos, validaciones y ejemplo.
3. Ambos cambios van en el **mismo PR**. Un PR que agregue logica de servidor sin actualizar `@ao/shared` y `docs/protocol.md` no es mergeable.

---

## Apendice A — Tipos de referencia (`@ao/shared`)

Los tipos usados en este documento provienen de:

- `packages/shared/src/protocol.ts` — definiciones de paquetes y opcodes
- `packages/shared/src/entities.ts` — tipos auxiliares (`EntityId`, `Vector2`, `Direction`, `CharacterSummary`)

`EntityId` es un `number` con brand nominal (`number & { __brand: "EntityId" }`). En el wire (MessagePack) se serializa como un entero sin signo de 32 bits.

`Direction` es un string union: `"north" | "south" | "east" | "west"`. En el wire se serializa como string UTF-8 (no como uint8). Si en el futuro se requiere optimizacion de payload, se podra migrar a uint8 con un cambio breaking de protocolo.

---

*Fin del documento. Version 1.0 — 2026-06-19.*
