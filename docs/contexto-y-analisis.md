# Contexto y análisis — Argentum Online Web

> Documento de arranque del proyecto. Resume el comparable principal (aoweb.app), el ecosistema de código público de Argentum Online y las decisiones técnicas que condicionan el rumbo del servidor web propio. Generado el 2026-05-06.

---

## 1. Resumen ejecutivo

- **Objetivo del proyecto:** construir un servidor web (y eventualmente cliente web) de Argentum Online sobre stack moderno (Node.js/TypeScript + cliente HTML5).
- **Comparable directo:** [aoweb.app](https://aoweb.app) — proyecto **personal de Damián Catanzaro** (autor histórico de "AOWeb"), retomado en 2025 con asistencia de LLMs. Está en **beta**, cliente en **PixiJS**, foco en jugabilidad desde celular.
- **Código fuente disponible:** existen al menos **cuatro ecosistemas** mantenidos en GitHub bajo **AGPL-3.0** (ao-org / AO20, ao-libre, Comunidad-Winter, Finisterra). Ninguno publica una *spec* oficial del protocolo, pero el formato binario está implementado y es derivable del código.
- **Implicación legal crítica:** AGPL-3.0 obliga a publicar el código fuente del servidor cuando se ofrece acceso por red. Si reutilizamos cualquier porción de los repos AGPL, **nuestro servidor también debe ser AGPL** y el código tiene que estar accesible para los jugadores.
- **Recomendación:** trabajar con AO clásico **0.13.x** como referencia funcional (paquetes y mecánicas mejor documentados de facto), portar lógica a TypeScript, y tomar **Finisterra** (Java + ECS + Kryonet) como referencia arquitectónica más cercana al stack moderno que apuntamos.

---

## 2. Análisis de aoweb.app (comparable)

### 2.1 Identidad
- **Autor:** Damián Catanzaro ([@DamianCatanzaro](https://x.com/DamianCatanzaro), [damiancatanzaro.com](https://damiancatanzaro.com)).
- **Historia:** primera versión hace ~11 años (proyecto "AOWeb"). Estuvo online sin jugadores. En 2024-2026 lo retoma "de cero" con PixiJS, apoyándose en LLMs, con foco en mobile-first.
- **Estado:** **AOWeb Beta**, en desarrollo activo. La home actual carga con "Cargando inicio...", lo que sugiere SPA cliente-renderizada.

### 2.2 Stack visible
- **Cliente:** [ominousg/ao-web-client](https://github.com/ominousg/ao-web-client) — JavaScript + **PixiJS** + **Webpack** (migrado desde RequireJS) + Gulp. Sin TypeScript. **MIT** (a diferencia del servidor, que es AGPL).
- **Frontend de la web (landing/login):** Next.js (el `<title>` por defecto "Create Next App" se filtró en el SEO de búsquedas).
- **Servidor:** se conecta tanto al **dakara-server** (C++) como al servidor convencional **VB6 v0.13.3**.
- **Protocolo:** no documentado explícitamente, pero al heredarse del servidor 0.13.3 es **TCP binario** (ver §4).

### 2.3 Features expuestas en la web
- `/login`, `/characters`, `/arenas`, `/ranking`, `/wiki/equipment`.
- Discord oficial: `discord.gg/sf8rWAvgxs`.
- No se observan tienda, microtransacciones ni mención de modelo de negocio.

### 2.4 Pendientes declarados por el autor (en repos)
- Deferred shading, VFX con shaders, texturas comprimidas (KTX), animación esqueletal con Spine/DragonBones.
- Mobile-first (control táctil, layout responsivo).

### 2.5 Lecturas clave para nuestro proyecto
- **Confirma viabilidad técnica** de un AO web jugable: PixiJS sobre Canvas/WebGL maneja la grilla 2D y la cantidad de sprites del juego.
- **Pone la vara baja en UX/escala**: comunidad reducida, beta, sin gameplay diferencial fuerte. Hay espacio para ejecutar mejor.
- **Indica que la integración con servidor VB6 legado es un puente posible** (útil para validar cliente antes de tener servidor propio listo), pero también el cuello de botella que motiva tener un servidor moderno propio.

---

## 3. Ecosistema de código público de Argentum Online

### 3.1 Mapa de organizaciones

| Organización / Repo | Rol | Lenguaje | Licencia | Estado |
|---|---|---|---|---|
| [ao-org/argentum-online-server](https://github.com/ao-org/argentum-online-server) | **AO20 oficial**, fork canónico | VB6 (94%) + VBA | AGPL-3.0 | Activo. Último release **v5.6.38** (2026-05-02). 4.301 commits. 459 releases. |
| [ao-org/argentum-online-client](https://github.com/ao-org/argentum-online-client) | Cliente AO20 oficial | VB6 | AGPL-3.0 | Activo. Cliente actualizado 2026-05-04. |
| [ao-libre/ao-server](https://github.com/ao-libre/ao-server) | Fork comunitario "libre" | VB6 | AGPL-3.0 | **Legado**. Último release v0.13.56 (2020-09). 2.828 commits. Mantenimiento mínimo. |
| [ao-libre/ao-cliente](https://github.com/ao-libre/ao-cliente) | Cliente del fork libre | VB6 | AGPL-3.0 | Idem ao-server. |
| [ao-libre/finisterra](https://github.com/ao-libre/finisterra) | **Reescritura Java moderna** | Java + libGDX + Artemis (ECS) + Kryonet | (verificar archivo LICENSE) | Activo. 134 stars, 485 commits, CI/CD. |
| [ao-libre/argentumonline.io](https://github.com/ao-libre/argentumonline.io) | Spin-off `.io` web | JavaScript (96%) | (verificar) | 261 commits. Cliente web, servidor en `dakara-server` rama `io`. |
| [ominousg/ao-web-client](https://github.com/ominousg/ao-web-client) | Cliente web del autor de aoweb.app | JS + PixiJS + Webpack | MIT | 44 commits, 30 issues abiertos, 5 stars. |
| [Comunidad-Winter/Argentum-Online](https://github.com/Comunidad-Winter/Argentum-Online) | Archivo histórico de versiones 0.99z → 0.13.3 | VB6 | (cada versión la suya) | Referencia/preservación. |
| [gorlok/aoj-server](https://github.com/gorlok/aoj-server) | Servidor Java independiente | Java | (verificar) | Repo de un colaborador histórico. |

### 3.2 Versiones del juego
- **0.99z → 0.13.x**: versiones históricas VB6, cliente y servidor en TCP texto/binario.
- **0.13.3**: versión estable más usada como base de servidores comunitarios (es la que conecta el cliente web de Catanzaro).
- **AO20 (v5.x)**: línea oficial moderna mantenida por `ao-org`, evolución directa con balance, anti-cheat y features nuevas. Es donde está la actividad real hoy (release de hace 4 días al momento de este informe).

### 3.3 Notas legales — AGPL-3.0
- Código de `ao-org` y `ao-libre` está bajo **AGPL-3.0**: cualquier usuario que interactúe **por red** con un servidor derivado tiene derecho a recibir el **código fuente completo modificado**.
- Implicaciones para nuestro proyecto:
  - Si **portamos** lógica desde estos repos a TypeScript, eso es una obra derivada → **debemos publicar nuestro código** del servidor también bajo AGPL-3.0.
  - Si solo **consultamos** los repos como referencia conceptual y reescribimos desde una *spec* propia (nombres de paquetes, balance, fórmulas, etc.), la licencia no se contagia, pero la línea es fina y subjetiva.
  - **Alternativa limpia:** licenciar nuestro código como AGPL-3.0 desde el día 1 y tratar el proyecto como software libre. Coherente con la cultura del juego y elimina ambigüedad legal.
- **Assets gráficos / sonoros:** los sprites e iconos clásicos de AO no tienen licencia abierta clara y han generado disputas históricas. Decisión a tomar: usar assets clásicos asumiendo riesgo, contratar pixel-art original, o usar assets libres (OpenGameArt, etc.).

---

## 4. Protocolo de red de Argentum Online

### 4.1 Hechos conocidos
- Desde **AO 0.11.6** existe **protocolo binario** sobre **TCP/IPv4** con sockets bloqueantes (info histórica del autor original Morgolock en SourceForge).
- Métricas históricas reportadas: 550 conexiones paralelas, ping ~62ms (picos de 110ms), considerado "perfectamente jugable".
- AO20 oficial menciona dependencia de la librería **Aurora.Network** para el manejo de paquetes.
- **No hay spec pública** consolidada. La fuente de verdad son los `.bas/.frm` de `Codigo/` en los repos VB6 (módulos `Protocol.bas`, `clsByteQueue.cls`, etc., presentes en todas las variantes).

### 4.2 Forks que abstraen el protocolo
- **Finisterra (Java)**: usa **Kryonet** con serialización binaria automática y patrón Request/Response visitor. Esto *evita* portar el protocolo VB6 paquete por paquete: redefine los mensajes en Java/POJO. Es el camino conceptualmente más limpio para una reescritura.
- **dakara-server (C++)**: reimplementa servidor en C++ manteniendo compatibilidad con clientes 0.13.x → permite que el cliente PixiJS de Catanzaro hable con un backend moderno en C++ usando los mismos paquetes.

### 4.3 Implicancia para nuestro stack
Tres caminos posibles:

| Opción | Qué significa | Pros | Contras |
|---|---|---|---|
| **A. Compatibilidad con cliente 0.13.3 / AO20** | Implementar exactamente los paquetes binarios sobre TCP | Reusa cualquier cliente AO existente. Comunidad puede conectarse con clientes que ya tienen | Atado a TCP crudo (no funciona en navegador sin proxy WebSocket). Reverse-engineering tedioso |
| **B. Cliente y servidor propios sobre WebSocket binario** | Definir protocolo nuevo (MessagePack o protobuf) | Funciona nativo en navegador. Diseño limpio, tipado | No compatible con clientes existentes. Hay que construir el cliente desde cero |
| **C. Híbrido: WebSocket externo, lógica espejo de 0.13.x** | Mensajes propios, pero `OpCode` y semántica calcados de AO 0.13.x | Permite portear clientes web existentes con un thin-adapter. Familiar a la comunidad | Complejidad media. Requiere documentar la traducción |

Recomendación inicial: **Opción B** (limpia, alineada con stack web moderno). Validable con un MVP en 2-3 sprints sin estar pelado contra reverse engineering.

---

## 5. Recomendaciones de stack (a validar con backend-developer y frontend-designer)

### 5.1 Servidor
- **Runtime:** Node.js LTS (≥20).
- **Lenguaje:** TypeScript estricto.
- **Networking:** WebSocket (`ws` o `uWebSockets.js` para alta performance).
- **Codec:** MessagePack o protobuf para mensajes binarios; JSON solo en endpoints HTTP de gestión (login, registro, ranking).
- **HTTP/REST:** Fastify (perf) o Hono (DX moderno) — para auth, panel admin y APIs públicas.
- **Persistencia:**
  - **PostgreSQL** para cuentas, personajes, items, inventario, ranking.
  - **Redis** para sesiones, presencia, pub/sub entre instancias del game-loop.
- **Game loop:** tick fijo (recomendado 50-100ms = 10-20 Hz) en proceso dedicado, con worker threads o procesos separados por mapa/zona.
- **ECS o no-ECS:** para empezar, no es obligatorio. Una arquitectura simple por entidades (Player/NPC/Item) basta hasta tener mecánicas estables.

### 5.2 Cliente
- **Render:** **PixiJS v8** (igual que aoweb.app y `ominousg/ao-web-client`). Maduro para tilemaps 2D y miles de sprites.
- **Lenguaje:** TypeScript.
- **Bundler:** Vite (sustituye al Webpack/Gulp del proyecto referencia).
- **UI HUD:** preact/lit para overlays (inventario, chat, stats) — más liviano que React para un canvas-game.
- **Mobile-first:** controles táctiles desde sprint 1 (no como afterthought).

### 5.3 Infra
- Dev: Docker Compose con PostgreSQL + Redis + servidor.
- Producción: VPS único con Caddy/Nginx → Node + PostgreSQL + Redis. Escalado vertical hasta los ~500-1000 conectados (más allá: sharding por mapa).

---

## 6. Riesgos y dependencias críticas

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **AGPL contagio** si copiamos código de ao-org/ao-libre | Alto (legal) | Decidir AGPL desde día 1 *o* trabajar solo desde specs derivadas, sin copiar código |
| **Assets gráficos sin licencia clara** | Medio-alto | Plan B con assets propios pixel-art o libres; presupuesto si hay que contratar |
| **Reverse engineering del protocolo VB6** si elegimos compatibilidad con clientes existentes | Alto en esfuerzo | Optar por protocolo propio (Opción B en §4.3) |
| **Comunidad fragmentada** (ao-org vs ao-libre vs AOWeb) | Medio | Definir desde el principio si apuntamos a AO clásico, AO20 o variante propia |
| **Anti-cheat / abuso** (movement/attack hacks históricos del juego) | Alto | Toda lógica autoritaria en servidor. Cliente solo renderiza estado |
| **Escalado de game-loop** con muchos mapas/jugadores | Medio | Diseño desde inicio con sharding por mapa o zona |

---

## 7. Decisiones abiertas (para resolver con project-manager)

1. **Licencia del proyecto:** ¿AGPL-3.0 desde el inicio, MIT/Apache, o privativo? Condiciona el uso de código de referencia.
2. **Versión de AO objetivo:** ¿clónico de 0.13.3, espejo de AO20, o variante propia con balance reescrito?
3. **Ámbito funcional del MVP:** ¿caminar + chat + atacar entre jugadores en un mapa? ¿o ya con NPCs e inventario?
4. **Compatibilidad con clientes existentes:** sí / no (define §4.3).
5. **Modelo de comunidad:** servidor único oficial o multi-server (cada uno levanta el suyo, federación).
6. **Monetización:** F2P puro / donaciones / pase cosmético — define qué tipo de personajes y datos persistir.
7. **Mobile-first o desktop-first:** afecta UX, controles y prioridades del frontend.

---

## 8. Próximos pasos sugeridos

1. **Validar/cerrar las decisiones abiertas de §7** con el `project-manager`.
2. Generar `docs/roadmap.md` y `docs/backlog.md` (project-manager).
3. Generar `docs/architecture.md` y borrador inicial de `docs/protocol.md` con el formato de paquetes propio (backend-developer).
4. Generar mockups del HUD y `docs/design-system.md` (frontend-designer).
5. **Inicializar repo Git** una vez la licencia esté decidida (AGPL implica `LICENSE` y headers de archivo).
6. Levantar repositorios de referencia localmente (`ao-libre/ao-server`, `ao-libre/finisterra`) para que estén accesibles offline mientras se diseña el protocolo propio.

---

## 9. Referencias

### Repositorios
- [ao-org/argentum-online-server](https://github.com/ao-org/argentum-online-server) — servidor AO20 oficial (VB6, AGPL-3.0)
- [ao-org/argentum-online-client](https://github.com/ao-org/argentum-online-client) — cliente AO20 oficial
- [ao-libre/ao-server](https://github.com/ao-libre/ao-server) — servidor libre legado 0.13.x
- [ao-libre/finisterra](https://github.com/ao-libre/finisterra) — reescritura Java + libGDX + Artemis ECS + Kryonet
- [ao-libre/argentumonline.io](https://github.com/ao-libre/argentumonline.io) — spin-off web `.io`
- [ominousg/ao-web-client](https://github.com/ominousg/ao-web-client) — cliente PixiJS de aoweb.app
- [Comunidad-Winter/Argentum-Online](https://github.com/Comunidad-Winter/Argentum-Online) — archivo histórico de versiones VB6
- [gorlok/aoj-server](https://github.com/gorlok/aoj-server) — servidor Java independiente

### Personas y comunidades
- [Damián Catanzaro](https://damiancatanzaro.com) — autor de aoweb.app
- [aoweb.app Discord](https://discord.gg/sf8rWAvgxs)
- [argentumonline.org](https://argentumonline.org) — sitio AO Libre

### Protocolo / historia
- [SourceForge — Nuevo protocolo binario (2007)](https://sourceforge.net/p/morgoao/news/2007/07/nuevo-protocolo-binario---resultados/)
- [mauro7x/argentum project page](https://mauro7x.github.io/argentum/project.html) — TP universitario que documenta sockets TCP/IPv4 bloqueantes

### Licencia
- [AGPL-3.0 en GNU](https://www.gnu.org/licenses/agpl-3.0.html)
- [AGPL plain English (TLDRLegal)](https://www.tldrlegal.com/license/gnu-affero-general-public-license-v3-agpl-3-0)
