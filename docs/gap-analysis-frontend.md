# Gap Analysis — Frontend: cliente web vs AO clásico (referencia ImperiumAO)

Fecha: 2026-07-06.
Fuentes: `Screen de chequeo/Ejemplo 1.jpeg` (layout deseado), `Screen de chequeo/prueba 5.png` (estado previo), `packages/client/src/style.css` + `packages/client/src/ui/*.ts` + HUD de `packages/client/src/scenes/game.ts` (estado actual), y árbol `Graficos/Interfaces/` + `Graficos/Skins/Libre/` del repo `ao-libre/ao-cliente`.

---

## 1. Diferencias de layout vs Ejemplo 1

### Lo que YA está en el lugar correcto
- **Consola arriba del área de juego** con pestañas (todo/chat/combate/global) — coincide con la referencia (`.ao-chat`, ancho `calc(100vw - 244px)`).
- **Panel lateral derecho fijo** con: nombre en cabecera, nivel + XP%, tabs Inventario/Conjuros, grilla de inventario 6 col., fila de equipamiento con valores, oro, barras HP/MP/Energía/Hambre/Sed, chips de drogas, minimapa con zona + coordenadas (`inventory.ts` + `minimap.ts`). Es el mismo orden vertical que la referencia.
- **Barra de macros 1-6 abajo**, cartel de casteo y panel de muerte centrados sobre el viewport.

### Lo que está en el lugar INCORRECTO o duplicado
| Problema | Detalle | Referencia |
|---|---|---|
| **Dos hotbars** | `.ao-macrobar` (abajo-centro) + `.ao-skill-hotbar` "Hechizos" (abajo-derecha, dentro del ancho del panel, con `padding-bottom: 110px` reservado en `.ao-inv`) | El AO tiene UNA sola tira de slots al pie, a lo ancho de la pantalla (franja negra inferior de Ejemplo 1). Unificar. |
| **Panel "En línea" flotante** (`.ao-players`, top-left sobre el juego) | Tapa el viewport | En el original la lista de usuarios es un comando/ventana bajo demanda, no un overlay permanente. Debería ser la pestaña **Amigos** del panel o ventana toggle. |
| **Party panel** `.ao-party` en `top: 60px; right: 12px` | Queda ENCIMA del panel lateral | En la referencia todo lo persistente vive DENTRO de la columna derecha. Integrarlo como bloque del panel. |
| **Ancho del panel: 244px fijos** | En 1920px de ancho el panel queda proporcionalmente enano; slots de 35px y viewport gigante desbalanceado | Ejemplo 1: pantalla 4:3 donde el panel ocupa ~30% del ancho (230/760). Falta un modo "clásico" con viewport acotado y marco. |
| **Viewport fullscreen sin marco** | El juego llega hasta los bordes; no hay marco de piedra/metal alrededor del área de juego ni de la consola | La `VentanaPrincipal.JPG` original encuadra TODO: consola, viewport y panel dentro de un marco bitmap continuo. Es lo que más "vende" la estética. |

### Lo que FALTA en el layout (existe en Ejemplo 1, no en el nuestro)
- **Pestañas "Amigos" y "Menú"** junto a Inventario/Conjuros (la referencia tiene 4 tabs; nosotros 2 + minibotones 📊/⚙).
- **Fila HP con oro + icono de mail/mensajes** al lado (la referencia comprime HP/oro, MP/%, SP/% en filas dobles con iconos).
- **Botonera de trabajo/acciones** junto al minimapa (martillos, X de cerrar sesión de trabajo).
- **Botón "ATRIBUTOS"** al pie del panel con mini-valores visibles (nosotros lo escondemos tras la tecla C).
- **Contador de slots/columna de coordenadas** estilo "161/206/66" al costado del minimapa (nosotros lo tenemos, pero debajo — aceptable).
- **Checkboxes/leds en las pestañas de consola** (detalle menor de la referencia).

---

## 2. Estética: bitmaps originales vs CSS mejorado

**Estado actual:** tema CSS "dorado sobre oscuro" genérico (`--gold #d4af37`, gradientes, `border-radius`, `Segoe UI`/`Georgia`/`Consolas`). Correcto pero indistinguible de cualquier web-game; nada grita "Argentum".

**Assets disponibles en `ao-libre/ao-cliente` (verificado):**
- `Graficos/Skins/Libre/VentanaPrincipal.JPG` — ventana principal completa **1024x768**: marco de metal ornamentado, consola arriba-izq + slot cuadrado arriba-der (hechizo armado), panel derecho con placa roja de nombre, tabs "Inventario | Hechizos" bitmap, hueco de inventario, gema roja vertical (¿XP/vida?), bloques de barras rotuladas **Energía/Hambre/Sed** y **Maná/Salud**, y 4 slots de equipamiento abajo con iconitos (armadura/casco/anillo/arma).
- `Graficos/Interfaces/` (~350 archivos): ventanas completas (`VentanaComercio`, `VentanaComercioUsuario`, `VentanaEstadisticas_spanish`, `VentanaHerreriaArmas/Armaduras/Mejorar`, `VentanaCarpinteriaItems/Mejorar`, `VentanaEntrenador`, `VentanaOpciones_spanish`, `VentanaSkills_spanish`, `VentanaPartyLider/Miembro`, `Boveda.jpg`, `VentanaCodex`, `VentanaQuest/InfoQuest`, `VentanaRetos`, `VentanaListaAmigos`, foros `ForoGeneral/Real/Caos`…), **todos los botones en 3 estados** (normal/Rollover/Click), checkboxes (`cCheckbox.bmp`), estrellas de skills (`EstrellaSimple/Mitad/Brillante`), recuadros de crafteo (`RecuadroItems*`, `RecuadroLingotes/Madera`), retratos de clase (`MAGO.JPG`…), pantallas de carga. No hay cursores `.cur` ni fuentes en el repo (usa fuentes de sistema Tahoma/Verdana).

### Camino (a): skinear con los JPG originales
- ✅ Fidelidad e identidad máximas; nostalgia instantánea; el 90% del arte ya existe y es libre (ao-libre); estados hover/click ya dibujados; ventanas secundarias (comercio, estadísticas, herrería) resueltas de una.
- ❌ Son **JPG sin canal alfa** (todo rectangular, fondos negros pegados); resolución fija 1024x768 → en pantallas modernas hay que escalar (blur) o hacer letterbox; texto **horneado en el bitmap** (variantes `_spanish/_english`, imposible de traducir/cambiar); no responsive ni táctil-friendly; iterar = editar PSDs (`Graficos/psd_editables/`).

### Camino (b): seguir con CSS mejorado
- ✅ Responsive, nítido en cualquier DPI, temas fáciles, accesible, táctil OK, iteración rápida; ya tenemos toda la estructura DOM.
- ❌ Nunca va a parecer el AO; cada ventana nueva es diseño desde cero; el "genérico dorado" actual no diferencia el producto.

### ✔ Recomendación: híbrido con sesgo a (a) — "texturas bitmap sobre esqueleto CSS"
Extraer **texturas y piezas** de `VentanaPrincipal.JPG` y las ventanas (fondo de piedra/cuero, marcos como `border-image` 9-slice, tabs, placa de nombre, caps de barras, slots) y aplicarlas sobre el DOM/CSS actual, que ya replica el layout. Recortar a PNG (los sectores planos comprimen bien y se puede añadir alfa donde haga falta). Así se logra ~90% de la fidelidad visual sin heredar la rigidez de 1024x768: el layout sigue siendo flexible, el texto sigue siendo HTML (i18n, accesibilidad) y los botones usan los 3 estados originales como `background-position`. Ofrecer además un **modo clásico 4:3** (viewport fijo ~1024x768 centrado con letterbox) para desktop, que es donde el marco continuo luce igual a la referencia.

---

## 3. Componentes de UI faltantes vs cliente original

Tenemos (16 módulos en `packages/client/src/ui/`): login, selección de personaje, chat, inventario+conjuros, macro bar, skill hotbar, minimapa, stats básico, shop, banco, party mínimo, trade, lista de jugadores, key config, touch controls.

Faltan (con su asset original de referencia):

| Componente | Asset original | Prioridad |
|---|---|---|
| **Estadísticas completa (F1)**: atributos + **skills con barras/estrellas** + **reputación** (asesino/bandido/ladrón/noble/plebe/status) + kills/clase/cárcel | `VentanaEstadisticas_spanish.jpg` | Alta — nuestro `stats-panel.ts` solo muestra 5 atributos + asignación |
| **Asignación de skills** al subir nivel | `VentanaSkills_spanish.jpg`, botones +/- | Alta (si el server tiene skills) |
| **Opciones** (audio, música, FX, seguridad, radio…) | `VentanaOpciones_spanish.jpg` | Alta — hoy no existe NINGUNA pantalla de opciones |
| **Herrería** (armas/armaduras/mejorar) | `VentanaHerreriaArmas/Armaduras/Mejorar` | Media (depende del server) |
| **Carpintería / Artesano** | `VentanaCarpinteriaItems/Mejorar`, `VentanaArtesano` | Media |
| **Entrenador** (lista de criaturas) | `VentanaEntrenador.jpg` | Media |
| **Foro / cartel** (general/real/caos) | `ForoGeneral/Real/Caos.jpg` + botones | Baja |
| **Party form completo** (líder: expulsar, transferir liderazgo, exp acumulada) | `VentanaPartyLider/Miembro_spanish` | Media — nuestro panel solo tiene HP y "Salir" |
| **Clanes** (fundar, administrar, detalles, lista, miembro, noticias, guerra/paz/alianzas) | `VentanaFundarClan`, `VentanaAdministrarClan`, etc. | Media-alta (el clan es identidad núcleo del AO) |
| **Amigos** | `VentanaListaAmigos.jpg` | Baja |
| **Quests** | `VentanaQuest`, `VentanaInfoQuest` | Media |
| **Retos / encuestas / elecciones** | `VentanaRetos`, `BotonElecciones*` | Baja |
| **Mapa mundial** | `Mapa1.jpg`, `Mapa2.jpg` | Baja |
| **Codex / info de personaje / SOS-GM / petición** | `VentanaCodex`, `VentanaInfoPj`, `VentanaShowSos`, `VentanaPeticion` | Baja |
| **Mensajes personalizados (F5-F8) / cambiar contraseña / MOTD / tirar oro / tutorial** | `VentanaMensajesPersonalizados`, `VentanaCambiarcontrasenia`, `VentanaCambioMOTD`, `VentanaTirarOro`, `VentanaTutorial` | Baja |

Además, dos que existen pero están **por debajo del estándar del original**:
- **Comercio** (`shop.ts`): lista de texto plano; el original (`VentanaComercio.jpg`) son **dos grillas de items con iconos** (NPC/jugador), cantidad y preview. Ídem **banco** (`Boveda.jpg`) y **trade** (`VentanaComercioUsuario.jpg`).
- **Selección de personaje / login**: el original tiene `VentanaConectar`, retratos por clase (`MAGO.JPG`, `GUERRERO.JPG`…) y pantallas de carga (`ImagenCargando1-14`) reutilizables gratis.

---

## 4. Detalles del juego en pantalla (render, no ventanas)

| Detalle | Original AO | Nuestro cliente (verificado en `game.ts`) | Gap |
|---|---|---|---|
| **Texto sobre la cabeza al hablar** | El diálogo aparece sobre la cabeza, multilínea, en el color del personaje, duración proporcional al largo | ❌ **NO existe** — `handleChatBroadcast()` solo escribe en la consola DOM | **El gap #1 de sensación AO.** Implementar en Pixi: wrap ~3 líneas, ~4s + 60ms/char, color según estado |
| **Nombre bajo los pies** | Dos líneas: `Nick` y `<Clan>` debajo | ✅ Existe pero **solo nick, sin clan** (label Verdana 10px bold blanco, `y=15`) | Agregar segunda línea `<Clan>` cuando haya gremio |
| **Color del nombre por estado** | Ciudadano **azul**, criminal **rojo**, GM **verde**, neutral/newbie gris | ❌ Siempre `#ffffff`; lo criminal es un badge HTML aparte (`.ao-criminal-badge`) | Colorear el label (y el texto overhead) por facción; retirar o degradar el badge |
| **Números de daño** | Flotantes rojo/blanco | ✅ Completo: `spawnFloater()` 800ms, paleta por tipo (fallo gris, escudo azul, daño rojo/verde, DoT naranja, heal verde) | OK — mantener |
| **FX de hechizos / meditación** | Spritesheets FX (llamas, auras, meditación bajo el personaje, sangre) | ❌ Solo floaters de texto ("Meditando…", cast azul) | Portar FXs.ind + animación en loop para meditar |
| **Barra de HP sobre NPCs** | El clásico NO la muestra (solo consola) | ✅ Nuestra aparece 3s al recibir daño — **mejora deliberada, conservarla** | — |
| **Cursores** | Flecha estándar de Windows + modos (no hay `.cur` en el repo) | Parcial: `pointer` sobre entidades, `crosshair` en casteo | Suficiente; opcional cursor pixel-art propio |
| **Fuentes** | Tahoma/Verdana 8pt bold con borde negro en todo el HUD | Mezcla: Segoe UI (paneles), Georgia (títulos), Consolas (números), Verdana (nombres) | Unificar: Verdana/Tahoma 10-11px + outline para todo lo in-world; una sola serif para títulos |
| **Iconos sobre la cabeza** | Fantasma al morir, corona GM, icono de party | Parcial: hay panel de muerte y overlay, sin iconos per-entity | Chico, sumar con el sistema de labels |
| **Pantalla de carga** | `VentanaCargando` + `ImagenCargando1-14` | Sin transición al cambiar de mapa | Chico y de alto impacto percibido |

---

## 5. Plan de adaptación priorizado

| # | Ítem | Esfuerzo | Notas |
|---|---|---|---|
| 1 | **Chat overhead** sobre la cabeza (Pixi: wrap, color por estado, duración por longitud, cola por entidad) | **Medio** | Mayor retorno de "sensación AO" por hora invertida |
| 2 | **Nombre "Nick <Clan>" + color por facción** en el label (azul/rojo/gris/verde GM); retirar badge CRIMINAL | **Chico** | Requiere que el server mande facción+clan en el spawn |
| 3 | **Unificar hotbars**: fusionar `.ao-skill-hotbar` dentro de `.ao-macrobar` como tira única al pie estilo franja clásica | **Chico** | Elimina la duplicación y libera los 110px reservados del panel |
| 4 | **Reubicar overlays**: party como bloque del panel derecho; "En línea" como pestaña Amigos/ventana toggle (no overlay permanente) | **Chico** | Despeja el viewport |
| 5 | **Kit de skin bitmap**: recortar de `VentanaPrincipal.JPG` fondo, marco 9-slice (`border-image`), tabs, placa de nombre, slots y caps de barras → aplicar a `.ao-inv`, `.ao-chat`, `.ao-macrobar` | **Grande** | El corazón de la recomendación §2; hacerlo como capa CSS (variables + clases), sin tocar TS |
| 6 | **Modo clásico 4:3**: viewport fijo escalado con letterbox y marco continuo alrededor de consola+juego+panel | **Medio** | Solo desktop; el modo fluido queda para mobile |
| 7 | **Estadísticas completa (F1)**: atributos + skills (estrellas `Estrella*.jpg`) + reputación + kills, layout de `VentanaEstadisticas_spanish` | **Medio** | Extender `stats-panel.ts`; datos nuevos del server |
| 8 | **Comercio/banco/trade con grillas de iconos** (reusar celdas del inventario) + marcos de `VentanaComercio`/`Boveda` | **Medio** | Reemplaza las listas de texto |
| 9 | **Ventana Opciones** (volumen música/FX, toggles de HUD, enlace a config de teclas) | **Chico** | Hoy inexistente; percha natural para el tab "Menú" |
| 10 | **Tipografía unificada + pantalla de carga** (`ImagenCargando*`) en cambios de mapa | **Chico** | Pulido transversal barato |
| 11 | **FX de hechizos y meditación** (spritesheets del original, anclados a entidad) | **Grande** | Pipeline de assets nuevo; coordinar con protocolo de FX del server |
| 12 | **Ventanas de oficio** (herrería/carpintería/entrenador) con sus bitmaps | **Grande** | Bloqueado por features de server; dejar al final |

Orden sugerido: 1-4 (una semana de wins visibles), luego 5-6 (identidad), 7-10 (paridad funcional), 11-12 (endgame).
