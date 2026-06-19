# Sistema de diseño — Argentum Online Web

> Versión 0.1 — borrador inicial del Sprint 1. Evoluciona con cada fase a partir de feedback real de jugadores.

## 1. Principios

1. **Reconocible como AO.** Paleta cálida tipo pergamino + dorado + fondos oscuros. Visualmente próximo al juego clásico sin copiar sus assets.
2. **Lectura primero.** El HUD existe para que el jugador no pierda combates por no entender lo que ve. Contraste alto, tipografía clara, jerarquía explícita.
3. **El canvas manda.** El juego está en el canvas PixiJS; las ventanas HTML son overlays que se quitan rápido (chat, inventario, login). Nunca tapan más del 30% del viewport.
4. **Estados explícitos.** Cargando, conectando, desconectado, muerto: todos comunicados visualmente sin requerir leer texto.
5. **Sin animaciones de marketing.** Las animaciones existen para reforzar feedback (golpe, daño, level up), no para decorar.

## 2. Paleta

Tokens CSS principales (mismos que ya usa `packages/client/src/style.css`):

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0d0a07` | Fondo base de página y áreas fuera del canvas. |
| `--bg-soft` | `#15110b` | Paneles HUD secundarios. |
| `--bg-card` | `#1a140d` | Cards de inventario, chat, tooltips. |
| `--gold` | `#d4af37` | Acentos principales, títulos, bordes activos. |
| `--gold-dim` | `#a08428` | Bordes secundarios, hover deshabilitado. |
| `--gold-soft` | `rgba(212,175,55,0.15)` | Backgrounds sutiles, divisores. |
| `--parchment` | `#f5e6c8` | Texto destacado (nombre del personaje, valores numéricos). |
| `--text` | `#e8dfc8` | Texto principal del HUD. |
| `--text-dim` | `#a89c80` | Texto secundario, labels. |
| `--text-faint` | `#6f6650` | Timestamps, metadata. |
| `--crimson` | `#8b1a1a` | HP crítico, errores, muerte. |
| `--steel` | `#4a5568` | Estados deshabilitados, NPCs neutros. |
| `--emerald` | `#2d8659` | HP lleno, confirmaciones, drops positivos. |
| `--azure` | `#3a6ea5` | Maná (Fase 5+), enlaces, info. |
| `--amber` | `#c97b1f` | Warnings, daño recibido, advertencias. |

**Reglas:**
- No introducir colores fuera de esta tabla sin agregarlos primero acá.
- El dorado solo destaca; nunca como background grande.
- Sangre / muerte siempre en `--crimson`, nunca rojo puro.

## 3. Tipografía

| Familia | Uso | Tamaños |
|---|---|---|
| **Georgia, "Cinzel", serif** | Títulos, nombres de mapas, nombre de personajes en pantalla, marca | 28, 22, 18 px |
| **"Segoe UI", system-ui, sans-serif** | Cuerpo HUD, chat, tooltips, botones | 16 base, 14 secundario, 12 metadata |
| **Consolas, monospace** | Valores numéricos en debug, opcodes en logs, valores de stats | 13-14 |

**Reglas:**
- Una sola familia serif y una sola sans en todo el cliente.
- Tamaños solo de la lista — no half-sizes intermedios.
- Texto in-game (sobre canvas): Georgia 16-20 px para nombres de jugadores; números flotantes de daño en Georgia bold 20-24.

## 4. Espaciado y bordes

- **Escala de spacing:** 4, 8, 12, 16, 24, 32, 48 px. No usar otros valores.
- **Border radius:** 3 px (pills, tags), 6 px (cards, paneles), 8 px (modales grandes). Nada con más de 8.
- **Border style HUD:** 1 px sólido `--gold-soft` para paneles; 1 px dashed `--gold-soft` para separadores; borde izquierdo de 3-4 px en cards para categorizar (siguiendo el patrón del roadmap.html).

## 5. Componentes base (a implementar en Fase 1-2)

| Componente | Cuándo entra | Notas |
|---|---|---|
| **Login / register form** | Sprint 2 (T-019) | HTML overlay; máximo 320 px de ancho; centrado en pantalla. |
| **Selección de personaje** | Sprint 2 (T-020) | Tres slots; sprite preview del personaje al elegir. |
| **HP bar** | Sprint 4 (T-038 aprox.) | Barra horizontal arriba del personaje en canvas. Color cambia de `--emerald` → `--amber` → `--crimson` según %. |
| **Chat overlay** | Sprint 4 (T-035) | Esquina inferior izquierda; máximo 30% del viewport; opacidad 0.85; scroll automático en mensaje nuevo. |
| **Nombre flotante** | Sprint 3 (T-028) | Georgia 14 px sobre cabeza del personaje; `--parchment` para propio, `--text` para otros. |
| **Número de daño flotante** | Sprint 5 (T-040) | Georgia bold 22 px; sube y se desvanece en 800 ms; `--crimson` para daño recibido, `--gold` para daño infligido. |
| **Inventario** | Sprint 7 (Fase 3) | Grid 6x6 de slots; cada slot 48x48 px; tooltip al hover. |
| **Ventana de tienda NPC** | Sprint 7 (Fase 3) | Modal 480x320 px; lista item + precio + botón comprar/vender. |
| **Tooltip de item** | Sprint 7 | Card con nombre (Georgia 18), tipo (sans 14), stats (mono 13). |

## 6. Iconografía

- **Estilo:** pixel-art 32x32 px para items, tiles, NPCs (escalado nearest-neighbor sin antialiasing).
- **Personajes:** 32x32 px base, 4 direcciones, 4 frames por animación.
- **HUD icons:** SVG monocromos en `--gold` o `--parchment` (no pixel-art para mantener crispness en alta DPI).
- **Origen Fase 0-3:** OpenGameArt / Kenney / itch.io CC0. Confirmar licencia de cada asset y dejarlo asentado en `packages/client/public/assets/CREDITS.md` (a crear cuando se importe el primer asset).

## 7. Sonido (referencia, implementación Fase 4+)

- Volumen master con default 60%.
- Loops cortos para BGM (4-8 compases) — evitar fatiga auditiva.
- Hover de UI: sutil click 50 ms.
- Combate: golpe / fallo / muerte como tres SFX distintos.

## 8. Accesibilidad mínima (todas las fases)

- Contraste WCAG AA (texto sobre fondo ≥ 4.5:1) en todo el HUD HTML.
- Atajos de teclado para acciones críticas (mover, atacar, abrir inventario, chat).
- Tamaños de texto no menores a 12 px en HUD.
- Ningún color como ÚNICO indicador (HP usa color + tamaño de barra; daño usa color + número).

## 9. Mobile / táctil (D-7)

Desktop-first. Controles táctiles desde Sprint 4 como modo paralelo: D-pad virtual en esquina inferior izquierda, botón de ataque en inferior derecha. Diseño completo mobile-first queda diferido a Fase 5+.

## 10. Anti-patrones explícitos (no hacer)

- **Modales encadenados** (un modal abre otro).
- **Animaciones bloqueantes** mientras el jugador podría moverse.
- **Notificaciones que cubran el centro del viewport** (el centro es jugabilidad).
- **Texto blanco puro (`#fff`) sobre fondo oscuro** — usar `--parchment` o `--text` para mantener calidez.
- **Fuentes adicionales fuera de las dos definidas.**

## 11. Próxima revisión

- Final de Fase 1: agregar componentes reales que se hayan construido y validar tokens.
- Final de Fase 2: incorporar feedback de la primera demo filmable.
