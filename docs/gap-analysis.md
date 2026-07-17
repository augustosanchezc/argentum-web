# Matriz de brechas: AO Web vs AO Libre original

> Generado 2026-07-08 contra el inventario exhaustivo del protocolo original
> (`Protocol.bas`, 156 paquetes C→S) y los sistemas de sus módulos VB6.
> Estados: ✅ portado · 🟡 parcial/adaptado · ❌ falta.
> Este documento es la hoja de ruta de fidelidad. Actualizar al portar cada sistema.

## 1. Acciones del protocolo original (156) — estado

### Cuenta y personaje
| Acción AO | Estado | Nota |
|---|---|---|
| LoginExistingAccount / LoginNewAccount | ✅ | vía HTTP + JWT (adaptado a web) |
| LoginExistingChar | ✅ | handshake WS |
| ThrowDices (dados de atributos) | 🟡 | decisión de diseño: sin tirada, atributos fijos = 18 + MODRAZA (los mejores stats de la raza) |
| LoginNewChar | ✅ | raza + género + clase + cabeza elegible con preview del sprite; sin dados (por diseño) |
| DeleteChar | ❌ | |
| ChangePassword / CambiarContrasena | ❌ | |
| ChangeDescription (/DESC) | ❌ | |

### Comunicación
| Acción | Estado | Nota |
|---|---|---|
| Talk | ✅ | + consola con pestañas |
| Yell (gritar) | ❌ | |
| Whisper | ✅ | /w (original: click + susurrar) |
| ChatOverHead (texto sobre la cabeza) | ❌ | solo consola — el AO muestra el habla sobre el personaje |
| GuildMessage /CMSG · PartyMessage /PMSG | ❌ | |

### Movimiento y básicas
| Acción | Estado | Nota |
|---|---|---|
| Walk | ✅ | con predicción |
| ChangeHeading (mirar sin caminar) | ❌ | |
| RequestPositionUpdate | 🟡 | corrección automática del server |
| Attack | ✅ | fórmulas reales (impacto/evasión/escudo/apuñalar) |
| PickUp | ✅ | tecla G (original: A) |
| Drop | ✅ | drag a "tirar" |
| SafeToggle (/SEG) | ❌ | seguro de ataque a ciudadanos |
| ResuscitationSafeToggle | ❌ | |
| LeftClick (mirar/examinar tile) | ❌ | ver nombre/descripción de lo apuntado |
| DoubleClick (puertas, carteles, NPCs) | 🟡 | solo NPCs; sin puertas ni carteles |

### Items e inventario
| Acción | Estado | Nota |
|---|---|---|
| UseItem | ✅ | pociones/comida/bebida/drogas con fórmulas reales |
| EquipItem | ✅ | equipar/desequipar + ropaje |
| moveItem (reordenar) | ✅ | drag & drop |
| ItemUpgrade | ❌ | |
| Oro como item (agarrar/tirar oro) | 🟡 | oro directo a billetera; no se puede tirar |

### Hechizos
| Acción | Estado | Nota |
|---|---|---|
| CastSpell | 🟡 | 5 efectos (daño/cura/veneno/buffs/curar veneno); faltan: paralizar, inmovilizar, invisibilidad, revivir, invocaciones, materializar, mimetismo, ceguera, estupidez |
| MoveSpell / DragAndDropHechizos | 🟡 | macros sí; reordenar libro no |
| Aprender de pergaminos | ❌ | libro por nivel (interim); el AO aprende usando pergaminos |
| Palabras mágicas sobre la cabeza + FX + WAV | ❌ | |
| Resistencia mágica (defM NPC, cascos/anillos mágicos) | 🟡 | proxy con def física |

### Combate a distancia
| Acción | Estado | Nota |
|---|---|---|
| Proyectiles (arco+flechas) | ✅ | rango 8, consume flecha, balance Cazador |
| WorkLeftClick con proyectil | 🟡 | vía click en objetivo (equivalente) |

### Trabajos (Work / CraftBlacksmith / CraftCarpenter / InitCrafting)
| Acción | Estado |
|---|---|
| Talar / Minar / Pescar / Herrería / Carpintería / Fundir | ❌ TODO el sistema |

### NPCs de servicio
| Acción | Estado | Nota |
|---|---|---|
| CommerceStart/Buy/Sell/End | ✅ | precios reales (venta 1/3) |
| BankStart/Deposit/Extract (+oro) | ✅ | |
| Resucitate / Heal (sacerdote) | ✅ | auto <5 tiles + click ≤10 |
| Train / TrainList (entrenadores) | ❌ | |
| Gamble /APOSTAR (timbero) | ❌ | |
| Enlist / Information / Reward (facciones) | ❌ | |
| Sacerdote de hogar (cambiar ciudad) | ❌ | hogar fijo Ullathorpe |

### Mascotas
| Acción | Estado |
|---|---|
| Domar criaturas / PetStand / PetFollow / ReleasePet / mascotas de druida | ❌ TODO |

### Party
| Acción | Estado | Nota |
|---|---|---|
| PartyCreate/Join/Leave/Kick/SetLeader/AcceptMember | 🟡 | tenemos invitar/aceptar/salir con XP compartida; falta líder/kick/solicitudes al estilo AO |
| ShareNpc / StopSharingNpc | ❌ | |

### Clanes (36 paquetes) / Facciones / Foro / Quests / Amigos / Retos / CVC
| Sistema | Estado |
|---|---|
| Clanes completos (fundar, miembros, guerra, paz, alianzas, elecciones, noticias, codex) | ❌ |
| Facciones Armada/Legión (enlistar, rangos, recompensas) | ❌ |
| Foros (carteles de clan/facción) | ❌ |
| Quests (aceptar/listar/abandonar) | ❌ (los NPCs [Quest N] ya spawnean) |
| Amigos (agregar/quitar/online/mensaje) | ❌ |
| Retos 1v1 con apuesta (FightSend/Accept) | ❌ |
| Clan vs Clan (Ecvc/Acvc/IrCvc) | ❌ |
| Encuestas (/ENCUESTA) | ❌ |

### Otras acciones del jugador
| Acción | Estado | Nota |
|---|---|---|
| Meditate | ✅ | tecla M |
| Rest /DESCANSAR (fogata) | ❌ | |
| Home /HOGAR | ✅ | botón al morir (20s) |
| Online / Uptime / Ping / MOTD / Ayuda / Est | 🟡 | panel de online sí; resto no |
| Denounce / GMRequest / bugReport | ❌ | |
| Consultation (soporte GM) | ❌ | |

### Herramientas de GM (~90 comandos)
| Sistema | Estado |
|---|---|
| TODO el panel GM (teleport, ban, spawn, edición, clima, día/noche...) | ❌ |

## 2. Sistemas de juego del AO original — estado

| # | Sistema (mecánica original verificada en los .bas) | Estado | Nota |
|---|---|---|---|
| 1 | **Skills por uso** — 21 skills, +50 XP acierto/+20 fallo, caps por nivel (nv1→3pts … nv40→100), 10 pts iniciales | ❌ | interim: skill = f(nivel). Es la base de casi todo (trabajos, ocultarse, domar, comercio) — PRIORIDAD |
| 2 | **Trabajos** — talar/minar/pescar (fórmula Suerte por skill), fundición, herrería (yunque), carpintería, artesano, upgrade | ❌ | herramientas y materiales ya están en el catálogo de items |
| 3 | **Clanes** — fundar (nv25 + Liderazgo 90), aspirantes, elecciones, guerra/paz/alianza, noticias, canal /CMSG | ❌ | sistema grande |
| 4 | **Facciones** — Armada (30 crim. matados, nv25) vs Legión (70 ciud.), 15 rangos, recompensas por kills, armaduras faccionarias | ❌ | requiere contadores de kills + reputación |
| 5 | **Quests** — hasta 15 activas, matar N NPCs / entregar objetos, recompensa oro+XP+items, NPCs [Quest] ya spawnean | ❌ | Quests.DAT descargable; estructura simple |
| 6 | **Mascotas/domar** — máx 3, Carisma×Domar ≥ Domable del NPC + azar 1/5, /QUIETO /ACOMPANAR /LIBERAR | 🚫 | **FUERA DE SCOPE** (decisión usuario 2026-07-15). No portar. |
| 7 | **Estados** — paralizado, inmovilizado, envenenado✓, ceguera, estupidez, oculto, invisible, mimetismo | 🟡 | solo veneno (DoT). Paralizar/invisibilidad son centrales en PvP |
| 8 | **Descansar + fogatas** — /DESCANSAR junto a fogata: HP×16 más rápido, stamina ×2; fogata = 3 leñas + Supervivencia | ❌ | |
| 9 | **Navegación** — barcas por skill Navegación, body = barco, galera/galeón por clase | ❌ | mapas con agua ya cargados |
| 10 | **Dados y razas** — 5 atributos RandomNumber(18,20) al crear + 5 razas con ModRaza (ya parseado en balance.json) | ✅ | 5 razas + género + cabeza implementados; sin tirada de dados (decisión: atributos fijos = 18+MODRAZA, los mejores de la raza) |
| 11 | **Comercio NPC** — descuento por skill Comerciar (hasta ~50%), venta = Valor/3 ✓, inventario del NPC vivo y compartido | 🟡 | falta descuento e inventario limitado del NPC |
| 12 | **Seguros** — /SEG (no atacar ciudadanos) y seguro de resurrección | ❌ | clave para el sistema criminal |
| 13 | **Newbie** — nivel ≤12, items newbie no se venden/caen/roban, Dungeon Newbie, expiración al pasar nivel | 🟡 | kit e items newbie ✓; falta bloqueo de venta, expiración y dungeon |
| 14 | **Amigos** — lista de 50, mensajes, online | ❌ | correo in-game NO existe en el original ✓ |
| 15 | **Robar/ocultarse/desarmar** (ladrón/bandido) | ❌ | |
| 16 | **Reputación** — 6 ejes (Noble/Burgués/Plebe/Ladrón/Bandido/Asesino) → ciudadano/criminal | 🟡 | tenemos criminal binario con timer |
| 17 | **Equitación/monturas** (agregado AO Libre) | 🚫 | **FUERA DE SCOPE** (decisión usuario 2026-07-15). No portar. |
| 18 | **Banco** — 40 slots máximo | 🟡 | nuestro banco sin límite de slots |

### Avance desde el análisis (2026-07-09)
Portados COMPLETOS desde entonces: skills por uso (21, con caps y XP real) ·
estados de hechizos (paralizar/inmovilizar/invisibilidad/ceguera/estupidez +
Devolver Movilidad) · FX reales (fxs.ini + 3122 animaciones) · trabajos
(talar/minar/pescar/fundir/herrería/carpintería) · fogatas + descansar ·
seguro /SEG · **quests (24 de Quests.DAT con NPCs enlazados por QuestNumber)** ·
**navegación (barcos por skill, agua real intransitable a pie)** · muerte
fantasma + sacerdote + /hogar · combate con fórmulas literales · sonido (223
WAVs) · game-feel (movimiento continuo, última tecla) · grillas con íconos
(tienda/banco/trade) · atributos óptimos fijos por clase (sin dados, decisión
de diseño).

Pendientes grandes: facciones · clanes · amigos · robar/ocultarse · skin bitmaps ·
texto/carteles/puertas · música MIDI · animación de agua.
FUERA DE SCOPE (decisión usuario 2026-07-15): monturas/equitación · mascotas/domar.

### Resumen cuantitativo
- **Acciones del protocolo**: ~35 de 156 portadas o adaptadas (≈22%), otras ~12 parciales.
- **Sistemas de juego**: 0 de 18 completos al estilo original; 5 parciales; 13 ausentes.
- **Datos**: 100% originales (mapas, gráficos, items, NPCs, hechizos, balance, fórmulas de combate).
- Lo construido que el original no tiene: cuentas web/JWT, deploy Docker, métricas, reconexión, panel táctil.

### Orden de ataque propuesto (mayor impacto de fidelidad primero)
1. **Skills por uso + dados + razas** (desbloquea todo lo demás y la creación de personaje real)
2. **Estados de hechizos**: paralizar/inmovilizar/invisibilidad/ceguera (PvP y PvE reales)
3. **Texto sobre la cabeza + FX + sonidos** (percepción inmediata de "es el AO")
4. **Trabajos** (talar/minar/pescar/fundir/herrería — loop económico)
5. **Descansar/fogatas + seguros /SEG**
6. **Quests** (los NPC ya están en el mundo)
7. **Facciones** → 8. **Clanes** → 9. **Navegación** → 10. **Amigos/robar/ocultarse**
   (monturas y mascotas/domar quedaron fuera de scope)

## 3. Diseño frontend

Análisis completo en [`gap-analysis-frontend.md`](gap-analysis-frontend.md): layout vs referencia,
estética (recomendación: híbrido — texturas de los JPG originales como 9-slice sobre el DOM actual),
componentes faltantes y plan de 12 ítems priorizado.

## 4. Infraestructura visual/sonora pendiente
- Texto sobre la cabeza (habla, palabras mágicas, gritos)
- FX de hechizos (FXs.ind) y animación de ataque (PlayAttackAnim)
- Sonidos (WAV del AO: golpes, hechizos, pasos) y música (MIDI/MP3 por mapa)
- Animación de tiles (agua, fuego — datos ya parseados)
- Overlays de arma/escudo/casco en el personaje (Armas/Escudos/Cascos.ind)
- Lluvia y noche
- Proyectil visible (flecha volando)
- Puertas que abren/cierran, carteles legibles
