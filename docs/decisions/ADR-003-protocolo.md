# ADR-003 — Protocolo de red

- **Estado:** Aceptada
- **Fecha:** 2026-06-19
- **Decidido por:** project-manager (asunción D-4), pendiente de confirmación final del usuario.
- **Sprint:** 1 (Fase 0)

## Contexto

El protocolo entre cliente y servidor define el formato y semántica de cada mensaje intercambiado. En Argentum Online clásico (VB6) el protocolo es **TCP binario crudo**, no documentado oficialmente, derivable de los `.bas` (módulos `Protocol.bas`, `clsByteQueue.cls`). El roadmap (`docs/contexto-y-analisis.md` §4) plantea 3 opciones:

| Opción | Resumen |
|---|---|
| **A** | Compatibilidad con cliente VB6 0.13.3 / AO20 (mismo protocolo TCP binario). |
| **B** | Protocolo propio sobre WebSocket binario (esta ADR). |
| **C** | Híbrido — WebSocket pero `OpCode` y semántica calcados de 0.13.x. |

## Alternativas

| Opción | Pros | Contras |
|---|---|---|
| **A. Compat VB6** | Reusa cualquier cliente AO existente. Comunidad puede conectarse con clientes que ya tienen. | TCP crudo no es navegable: requeriría un proxy WebSocket↔TCP por conexión. Reverse engineering tedioso del protocolo VB6 sin spec pública. Choca con la decisión del usuario de "libertad para rebalancear" (D-2). |
| **B. WebSocket propio** *(elegida)* | Funciona nativo en navegador. Diseño limpio y tipado en TypeScript. Permite evolución sin atar manos a un protocolo histórico. | No es compatible con clientes VB6/PixiJS existentes. Tenemos que construir el cliente desde cero (que es lo que ya estamos haciendo). |
| **C. Híbrido** | Familiar a la comunidad — paquetes con nombres conocidos. Permite portear clientes web existentes con un thin-adapter. | Costo de mantener compatibilidad conceptual con un protocolo viejo, pagando complejidad sin ganancia clara dado que el cliente es nuestro. |

## Decisión

Adoptamos la **Opción B — protocolo WebSocket propio**, con:

- **Transporte:** WebSocket binario (no texto).
- **Encoding:** **MessagePack** con un campo `op` (opcode) discriminado por enum.
- **Versionado:** constante `PROTOCOL_VERSION` en `@ao/shared`. Server rechaza handshake si el cliente reporta una versión incompatible.
- **Definiciones:** todos los tipos de paquete viven en `packages/shared/src/protocol.ts`. Server y client importan de ahí. **No se define un paquete en server sin agregar el tipo a `@ao/shared` primero** (regla de PR para evitar drift — riesgo R-04 del roadmap).
- **Familias de opcodes:** `0x0x` autenticación/sesión, `0x1x` movimiento, `0x2x` chat (Fase 2), `0x3x` combate (Fase 2), `0x4x` inventario/items (Fase 3), `0x9x` updates del server, `0xFx` desconexión / errores.
- **Documentación:** la spec completa con campos, tipos y dirección de cada paquete vive en `docs/protocol.md`, generada/actualizada manualmente y validada contra los tipos de `@ao/shared` en CI (T-007).

## Por qué Opción B y no C

Aunque C suena atractivo ("hablamos el mismo idioma que la comunidad"), el costo de mantener compatibilidad conceptual con un protocolo histórico no documentado oficialmente es alto. Si en el futuro la comunidad pide un cliente compatible con AO20, se puede agregar un **adapter** en una capa aparte sin contaminar el core. Mantener el core limpio es más importante que la familiaridad.

## Consecuencias

- Cliente y server quedan acoplados solo a través de `@ao/shared`. Cualquier breaking change requiere bumpear `PROTOCOL_VERSION` y forzar el upgrade del cliente.
- Reduces el riesgo R-03 (reverse engineering VB6) a cero.
- Aumenta el riesgo R-07 (comparación con comunidad existente): no se puede conectar nada existente. Se mitiga con identidad propia del proyecto.
- En Fase 5+, si la comunidad lo pide, se puede agregar un servidor-proxy que hable VB6 hacia clientes legacy. Ese proxy NO está en el alcance de la Beta.
