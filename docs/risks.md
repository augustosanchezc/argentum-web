# Registro de riesgos — Argentum Online Web

- **Version:** 1.0
- **Fecha:** 2026-06-19
- **Responsable:** project-manager
- **Regla de revision:** se revisa al cierre de cada sprint y ante cambio de scope significativo.

---

## §1 Resumen ejecutivo

El proyecto tiene **13 riesgos registrados** (R-01 a R-10 del roadmap global + R-11 a R-13 detectados en Sprint 1). De ellos, **2 estan cerrados** (decisiones ya tomadas los anulan), **3 estan mitigados** (accion tomada, riesgo reducido pero no eliminado), y **8 permanecen abiertos** con distintos niveles de urgencia.

Los tres riesgos de mayor prioridad a vigilar en Sprint 1 son:

1. **R-04 — Anti-cheat insuficiente** (CRITICO): el servidor autoritativo debe estar diseñado desde Fase 1 para que el combate de Fase 2 no nazca con exploits.
2. **R-09 — Bus factor = 1 en backend** (CRITICO): si el unico desarrollador backend se ausenta, el proyecto se detiene; la mitigacion es documentacion y ADRs actualizados.
3. **R-05 — Dupe de items** (ALTO): aunque aplica desde Fase 3, el diseño de transacciones SQL debe contemplarse desde la arquitectura inicial para no tener que refactorizar.

---

## §2 Tabla principal de riesgos

### Matriz de scoring

| Probabilidad \ Impacto | Bajo | Medio | Alto |
|---|---|---|---|
| **Alta** | MEDIO | ALTO | CRITICO |
| **Media** | BAJO | MEDIO | ALTO |
| **Baja** | BAJO | BAJO | MEDIO |

### Tabla de riesgos

| ID | Riesgo | Prob. | Impacto | Score | Estado | Owner | Fase expuesta | Mitigacion actual | Proxima revision |
|---|---|---|---|---|---|---|---|---|---|
| R-01 | Contagio AGPL por copia de codigo de repos de referencia | Media | Alto | ALTO | **Mitigado** | project-manager | Todas | AGPL-3.0 adoptada desde el dia 1 (ADR-001). Regla: solo lectura conceptual de ao-org/ao-libre, nunca copia verbatim. | Cierre Sprint 2 |
| R-02 | Assets graficos sin licencia clara (sprites AO clasico) | Alta | Medio | ALTO | **Mitigado** | frontend-designer | Fase 1+ | Decision del usuario confirmada: assets libres (OpenGameArt / Kenney / CC0) en desarrollo. Decision de arte final diferida a pre-Beta (Sprint 9). | Cierre Fase 3 |
| R-03 | Reverse engineering del protocolo VB6 si se adoptara compatibilidad con clientes existentes | Alta | Alto | CRITICO | **Cerrado** | backend-developer | Fase 1 | ADR-003 cierra la opcion: protocolo WebSocket propio (Opcion B). R-03 no aplica mientras esa decision se mantenga. | Re-evaluar solo si el usuario revierte ADR-003 |
| R-04 | Anti-cheat insuficiente — exploits de movimiento y combate | Alta | Alto | CRITICO | **Abierto** | backend-developer | Fase 2+ | Diseño de servidor autoritativo desde Fase 1: el servidor valida cada paquete de movimiento. Cooldown de ataque en servidor. La validacion completa de combate llega en Fase 2. | Cierre Sprint 1 — verificar que el game loop ya rechaza paquetes invalidos |
| R-05 | Dupe de items (bug historico critico en AO) | Alta | Alto | CRITICO | **Abierto** | backend-developer | Fase 3+ | Transacciones SQL atomicas planificadas para toda transferencia de items. El diseño debe contemplarse al definir el esquema de inventario (ADR-004 propuesto para inicio de Fase 3). | Inicio de Fase 3 |
| R-06 | Escalado del game loop bajo carga real | Media | Alto | ALTO | **Abierto** | backend-developer | Fase 4 | Diseño por zona/mapa desde Fase 1. Sharding horizontal como plan B. Load test con k6 al cierre de Fase 2 (al menos 20 conexiones) y Fase 3 (50 conexiones). | Cierre Fase 2 |
| R-07 | Comunidad fragmentada o comparaciones negativas con aoweb.app | Media | Medio | MEDIO | **Abierto** | project-manager | Fase 4 | Diferenciacion: stack AGPL abierto, desktop-first de calidad, protocolo propio. La incompatibilidad con clientes VB6 es aceptada y comunicada. | Apertura Beta |
| R-08 | Scope creep — features pedidas antes del MVP (clases, hechizos, guilds) | Alta | Medio | ALTO | **Abierto** | project-manager | Fase 2-3 | Backlog visible (`docs/backlog.md`). Politica explicita: toda feature nueva entra al backlog, no al sprint actual. Sprint review con criterios de aceptacion cerrados. | Cada cierre de sprint |
| R-09 | Bus factor = 1 en backend activo | Alta | Alto | CRITICO | **Abierto** | usuario | Todas | ADRs y `docs/architecture.md` actualizados capturan el razonamiento. Ninguna decision tecnica critica sin registro escrito. | Cada cierre de sprint |
| R-10 | Costos de infraestructura subestimados en Beta | Baja | Medio | BAJO | **Abierto** | usuario | Fase 4 | Presupuesto conservador documentado en `docs/costos-e-infraestructura.md`. VPS maximo USD 25-40/mes. Escalar solo con jugadores reales. | Inicio Fase 4 |
| R-11 | Docker Desktop con incompatibilidades en Windows 11 bloquea T-003 | Baja | Medio | BAJO | **Abierto** | backend-developer | Fase 0 | Fallback documentado: WSL2 + Ubuntu como alternativa. Si Docker no levanta en Sprint 1, activar fallback antes de bloquear la dependencia de Fase 1. | Fin Sprint 1 (urgente) |
| R-12 | Drift entre spec de protocolo y codigo implementado | Alta | Alto | CRITICO | **Abierto** | backend-developer / frontend-designer | Fase 1+ | ADR-003: `docs/protocol.md` es fuente de verdad. Regla de PR: no se mergea un paquete nuevo sin actualizar la spec. Validacion en CI (T-007). | Cada PR de protocolo |
| R-13 | Las 4 decisiones asumidas por el PM (D-4, D-5, D-6, D-7) podrian ser revertidas por el usuario, requiriendo trabajo rehecho | Media | Medio | MEDIO | **Abierto** | usuario / project-manager | Fase 1-2 | Visibilidad explicita en `docs/roadmap.md §1`. Solicitar confirmacion antes de fin de Fase 0 para D-4 (protocolo, la mas critica). Las otras tres pueden esperar a Fase 2. | Fin Sprint 1 |

---

## §3 Riesgos cerrados o mitigados por decisiones ya tomadas

### R-01 — Contagio AGPL (Mitigado)

ADR-001 adoptada el 2026-06-19 con confirmacion del usuario. El proyecto es AGPL-3.0 desde el primer commit. El riesgo de contagio legal queda neutralizado porque ya somos AGPL; copiar conceptualmente de ao-org/ao-libre no genera conflicto siempre que no se trasplante codigo verbatim. El riesgo pasa a "mitigado" y no "cerrado" porque la regla de "solo lectura conceptual" requiere disciplina continua de revision de PRs.

### R-02 — Assets sin licencia (Mitigado)

El usuario confirmo el 2026-06-19 el uso de assets libres (OpenGameArt / Kenney / CC0) durante el desarrollo. El riesgo legal es nulo mientras se mantenga esa politica. Pasa a vigilancia activa antes de Sprint 9, cuando hay que tomar la decision de arte final para la Beta publica (assets libres vs. comision de pixel-art).

### R-03 — Reverse engineering del protocolo VB6 (Cerrado)

ADR-003 adopta la Opcion B: protocolo WebSocket propio con MessagePack. No hay compatibilidad con clientes VB6. El riesgo de tener que derivar el protocolo binario de los `.bas` de AO queda eliminado. Estado "cerrado" mientras ADR-003 este vigente. Si el usuario en el futuro solicita compatibilidad con clientes VB6/AO20, este riesgo reabre con probabilidad Alta e impacto Alto.

---

## §4 Riesgos nuevos detectados durante Sprint 1

### R-11 — Docker bloqueado en Windows 11

El roadmap (Fase 0) establece como criterio de aceptacion "Docker Compose levanta PostgreSQL + Redis sin errores". Si Docker Desktop presenta incompatibilidades con la maquina de desarrollo (escenario Baja probabilidad pero registrado en la tabla de riesgos de Fase 0 del propio roadmap), la dependencia de Fase 1 queda bloqueada porque Fase 1 requiere "Fase 0 completa". La contradiccion: el roadmap da la solucion (WSL2 como fallback) pero no la registra como riesgo con owner asignado. Se agrega aqui con owner backend-developer y fecha de resolucion: fin de Sprint 1.

### R-12 — Drift de protocolo

Detectado como riesgo critico en la tabla de Fase 1 del roadmap pero no en la tabla global (R-01 a R-10). Se eleva aqui con ID propio porque es transversal a todas las fases: cada sprint que agrega paquetes nuevos expone este riesgo. La mitigacion (CI + regla de PR) esta definida en ADR-003 pero necesita un owner explicitamente responsable de su cumplimiento.

### R-13 — Decisiones asumidas sin confirmar

Las decisiones D-4 (protocolo WebSocket, la mas critica por ser base de toda la arquitectura de red), D-5 (servidor unico), D-6 (monetizacion) y D-7 (desktop-first) estan registradas como asunciones del PM en el memory del proyecto. Si el usuario revierte D-4 despues de que el backend-developer haya implementado los modulos de Fase 1, el trabajo de networking quedaría obsoleto. Se registra como riesgo de cronograma de impacto Medio pero con baja ventana de confirmacion disponible: D-4 debe confirmarse antes del fin de Sprint 1.

---

## §5 Riesgos economicos

Ver analisis completo en `docs/costos-e-infraestructura.md §12`. Resumen de los cinco riesgos economicos identificados:

1. **Tarjeta internacional rechazada para VPS (Argentina)** — Probabilidad Media, Impacto Alto. Requiere confirmar metodo de pago antes de Sprint 10.
2. **Cargo inesperado por egress / bandwidth** — Probabilidad Baja. Hetzner incluye 20 TB/mes, suficiente para 200 conexiones.
3. **Asset pack o comision genera arte inconsistente** — Probabilidad Media. Mitigacion: pedir muestras antes de pagar, pagar por hitos.
4. **Inflacion de costos en USD para usuario en Argentina** — Probabilidad Alta. El presupuesto se cotiza en USD conservador.
5. **Donaciones tardan en cubrir el costo del VPS** — Probabilidad Alta, Impacto Bajo. Costo mensual bajo (USD 25-40) permite absorber el periodo inicial sin ingresos.

El costo total hasta Beta oscila entre USD 127 (minimo) y USD 3.000 (con pixel-art comisionado). Las Fases 0-2 tienen costo cero.

---

## §6 Riesgos para Fase 2 a vigilar desde ahora

### R-04 — Anti-cheat (vigilancia activa desde Sprint 1)

El combate llega en Fase 2, pero el diseño autoritativo del servidor debe estar cimentado desde Fase 1. Cada modulo de movimiento implementado sin validacion en servidor es deuda de seguridad que se paga con exploits en Fase 2. Accion concreta: al revisar el entregable de Fase 1 del backend-developer, verificar que el game loop ya rechaza paquetes con posicion imposible (salto de mas de 1 tile, velocidad fuera de rango).

### R-08 — Scope creep (vigilancia activa desde Sprint 2)

La comunidad de AO tiene expectativas altas de features (clases, hechizos, guilds, PvP avanzado). En cuanto el proyecto sea visible, se recibirán pedidos. La Alta probabilidad de este riesgo se activa en el momento en que el proyecto tenga Discord abierto (Fase 4), pero la presion informal puede comenzar antes en el entorno del usuario. Accion: mantener el backlog actualizado y publica la politica de "no en este sprint" antes de abrir cualquier canal de comunicacion externo.

---

## §7 Glosario de scoring

El score se calcula combinando probabilidad e impacto con la siguiente matriz cualitativa:

| Probabilidad \ Impacto | Bajo | Medio | Alto |
|---|---|---|---|
| **Alta** | MEDIO | ALTO | CRITICO |
| **Media** | BAJO | MEDIO | ALTO |
| **Baja** | BAJO | BAJO | MEDIO |

**Definiciones:**

| Termino | Criterio |
|---|---|
| **Probabilidad Alta** | Es esperable que ocurra en el ciclo de vida del proyecto (>60%). |
| **Probabilidad Media** | Podria ocurrir; requiere una condicion especifica (30-60%). |
| **Probabilidad Baja** | Improbable pero no descartable (<30%). |
| **Impacto Alto** | Bloquea una fase completa o genera obligaciones legales / perdida irreversible de trabajo. |
| **Impacto Medio** | Agrega costo, demora un sprint o genera retrabajo significativo. |
| **Impacto Bajo** | Molestia manejable sin impacto en el cronograma critico. |
| **CRITICO** | Requiere mitigacion activa y seguimiento semanal. |
| **ALTO** | Requiere mitigacion planificada antes de que la fase expuesta inicie. |
| **MEDIO** | Monitorear; actualizar mitigacion si el contexto cambia. |
| **BAJO** | Aceptado; revisar solo si la probabilidad o el impacto escalan. |

**Estados posibles:**

| Estado | Significado |
|---|---|
| **Abierto** | El riesgo existe y no tiene mitigacion suficiente aun. |
| **Mitigado** | Se tomaron acciones que reducen significativamente la probabilidad o el impacto, pero el riesgo no desaparecio. |
| **Cerrado** | Una decision o hecho externo elimino el riesgo. Se documenta para referencia historica. |
| **Aceptado** | El equipo decide convivir con el riesgo sin mitigacion adicional (tipicamente score BAJO). |
| **N/A** | El riesgo no aplica al contexto actual del proyecto. |

---

*Proxima revision obligatoria: cierre de Sprint 1 (2026-07-04).*
