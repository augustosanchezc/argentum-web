# ADR-007 — Transacciones atómicas sin SQL TRANSACTION

**Fecha:** 2026-07-06  
**Estado:** Aceptado  
**Relacionado con:** ADR-002 (stack), ADR-006 (multi-mapa)

---

## Contexto

El servidor corre en un único proceso Node.js (sin clusters, sin workers) sobre el event loop de V8. Operaciones como banco (depositar/retirar), intercambio entre jugadores y distribución de XP en party deben ser atómicas: no puede quedar el estado a mitad de camino si llega otro mensaje de WebSocket entre dos pasos.

En un servidor multi-proceso habría que envolver esas operaciones en `BEGIN / COMMIT` de PostgreSQL o usar transacciones de Redis. Node.js single-threaded elimina ese problema porque el event loop no cede el control hasta que la función síncrona termina: dos callbacks de WebSocket **nunca** se intercalan dentro de la misma microtask.

---

## Decisión

**Toda operación de estado crítico se implementa como un bloque síncrono sobre estructuras en memoria, y se persiste en la DB como un fire-and-forget `async` posterior.**

Patrón concreto:

```ts
// 1. Mutar en memoria de forma síncrona (atómico por el event loop).
session.inventory.splice(fromSlot, 1);
bankOf(session).push(item);

// 2. Persistir asíncronamente (no await — el resultado ya es correcto en memoria).
void db
  .update(characters)
  .set({ inventory: session.inventory, bank: session.bank })
  .where(eq(characters.id, session.characterId));
```

Si la escritura a DB falla, el jugador lo verá consistente hasta que reconecte, momento en que la DB devuelve el estado previo. Esto es aceptable en un juego casual MVP.

---

## Registro de auditoría

Cada operación importante emite un log estructurado **antes** de mutar el estado:

```ts
log.info({ op: "bank_deposit", charId, slot, item }, "[audit]");
```

Esto permite reconstruir cualquier secuencia de eventos post-mortem.

---

## Consecuencias

**Buenas:**
- Sin overhead de transacciones SQL para cada acción de usuario.
- Código más simple: no hay rollback paths.
- Garantía real de atomicidad sin usar mecanismos de concurrencia.

**Malas:**
- No escala a múltiples procesos sin introducir un coordinador (Redis Pub/Sub o similar). Documentado como limitación conocida.
- Una excepción no capturada en la mutación síncrona deja el estado corrompido. Se mitiga con `try/catch` estricto y cierre de sesión en caso de error.

---

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| `BEGIN / COMMIT` PostgreSQL en cada acción | Latencia de red (≈1–3 ms) bloqueando el event loop si se usa `await`; complejidad sin beneficio real en single-process |
| Redis MULTI/EXEC | Introduce dependencia extra y complejidad sin necesidad |
| Worker threads con Mutex | Añade complejidad enorme; incompatible con la arquitectura single-process del ADR-002 |
