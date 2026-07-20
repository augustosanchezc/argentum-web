import { Application, Container, Graphics, Sprite, Text, TextStyle, type Texture } from "pixi.js";
import {
  ClientToServerOp,
  golpeUsuario,
  getAoSpell,
  CLASS_SPELLBOOK,
  getClassSkill,
  getItem,
  isWaterGraphic,
  ITEMS,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AllocStatRequest,
  type AnyPacket,
  type AttackRequest,
  type CastSpellRequest,
  type ConsoleMsg,
  type CraftRequest,
  type CriminalUpdate,
  type SkillEffect,
  type SpellsKnown,
  type UseSkillRequest,
  type RestToggle,
  type SafeToggleRequest,
  type WorkRequest,
  type WhisperReceived,
  type WhisperSendRequest,
  type BankDepositGoldRequest,
  type BankDepositItemRequest,
  type BankOpen,
  type BankUpdate,
  type BankWithdrawGoldRequest,
  type BankWithdrawItemRequest,
  type ChatBroadcast,
  type ChatError,
  type ChatSend,
  type Damage,
  type Death,
  type Direction,
  type DropItemRequest,
  type EntityAppearance,
  type EntityDespawn,
  type EntityEffect,
  type EntityId,
  type EntityKind,
  type EntitySpawn,
  type EntityUpdate,
  type FactionUpdate,
  type GameConfigMsg,
  type QuitRequest,
  type GuildTagUpdate,
  type MapTileUpdate,
  type GoHomeRequest,
  type CancelGoHomeRequest,
  type ShootGroundRequest,
  type InteractRequest,
  type InventoryReorderRequest,
  type InventoryUpdate,
  type MapData,
  type MeditateToggle,
  type MeditateUpdate,
  type MoveRequest,
  type PartyAcceptRequest,
  type PartyDisbanded,
  type PartyInviteReceived,
  type PartyInviteRequest,
  type PartyLeaveRequest,
  type PartyUpdate,
  type PickupRequest,
  type Respawn,
  type ShopBuyRequest,
  type ShopOpen,
  type ShopSellRequest,
  type StatsUpdate,
  type TradeAcceptMsg,
  type TradeAddItemMsg,
  type TradeCancelled,
  type TradeCancelMsg,
  type TradeComplete,
  type TradeConfirmMsg,
  type TradeInviteReceived,
  type TradeRequestMsg,
  type TradeSetGoldMsg,
  type TradeUpdate,
  type UseItemRequest,
  type Vector2,
  type NpcInfoRequest,
  type NpcInfoResponse,
  type PlayerInfoRequest,
  type PlayerInfoResponse,
} from "@ao/shared";
import type { CharacterSummary } from "../api";
import { audio, SND } from "../audio";
import { getToken } from "../auth";
import { ReconnectingClient, type ClientStatus } from "../net/ws";
import { mountBank, type BankHandle } from "../ui/bank";
import { mountChat, type ChatHandle } from "../ui/chat";
import { mountCraft, type CraftHandle } from "../ui/craft";
import { mountInventory, type InventoryHandle, type PanelStats } from "../ui/inventory";
import { mountKeyConfig, type KeyConfigHandle } from "../ui/key-config";
import { loadKeymap, type Keymap } from "../ui/keybinds";
import { mountMacroBar, type MacroBarHandle, type MacroSlot } from "../ui/macro-bar";
import { mountMinimap, type MinimapHandle } from "../ui/minimap";
import { mountWorldMap, type WorldMapHandle } from "../ui/world-map";
import { mountPartyUi, type PartyUiHandle } from "../ui/party-ui";
import { mountQuests, type QuestsHandle } from "../ui/quests";
import { mountPlayerList, type PlayerListHandle } from "../ui/player-list";
import { mountShop, type ShopHandle } from "../ui/shop";
import { mountStatsPanel, type StatsPanelHandle } from "../ui/stats-panel";
import { mountTouchControls, type TouchControlsHandle } from "../ui/touch-controls";
import { mountTrade, type TradeHandle } from "../ui/trade";
import { FxPlayer, type FxHandle } from "../world/fx";
import { Personajes, type CharDirection } from "../world/personajes";
import { Equipamiento } from "../world/equipamiento";
import { Tileset } from "../world/tileset";

const TILE_SIZE = 32;
// Zoom del mundo: el AO clásico muestra ~17x13 tiles en su viewport. A 1:1
// en una pantalla moderna se ven ~60 tiles y todo queda diminuto; con 2x
// la escala del personaje respecto de la pantalla es la del juego original.
const WORLD_SCALE = 1.25;
const MOVE_COOLDOWN_MS = 200;
// Espejo del cooldown autoritativo del server (combat.ts). El cliente lo
// aplica localmente para no spamear paquetes ni la animación de swing.
const ATTACK_COOLDOWN_MS = 800;
// Duración de la animación de golpe y del número de daño flotante.
const SWING_DURATION_MS = 160;
const FLOATER_DURATION_MS = 800;
// Velocidad de interpolacion visual: en cuanto tiempo el sprite recorre 1 tile.
// IGUAL al cooldown de movimiento: así, manteniendo la tecla, el personaje
// se desliza de tile en tile SIN micro-frenadas (el flow continuo del AO).
const TWEEN_DURATION_MS = 200;

// Paleta heuristica de FALLBACK. Ya renderizamos el tileset real del AO
// (ver world/tileset.ts), pero si un tile no tiene textura — grh 0 (vacio)
// o un PNG que no pudo bajarse — pintamos un color por rango para que el
// mapa siga siendo legible: tierra, piedra, baldosa de pueblo, agua, vegetacion.
function tileColors(graphic: number, blocked: boolean): { base: number; hi: number } {
  // Agua y piso liquido — indices tipicos de agua del AO clasico estan
  // en rangos bajos especificos. Por ahora marcamos blocked + un graphic
  // alto como agua mas oscura, lo que coincide visualmente.
  if (graphic >= 1505 && graphic <= 1520) {
    return { base: 0x1b3654, hi: 0x255080 }; // agua
  }
  if (blocked) {
    return { base: 0x2a2620, hi: 0x3d3830 }; // piedra / pared
  }
  // Heuristica simple: tonos verdes/marrones segun rango del graphic.
  if (graphic >= 2000 && graphic <= 4000) {
    return { base: 0x3b3220, hi: 0x4d432d }; // baldosa pueblo / madera
  }
  if (graphic >= 8000) {
    return { base: 0x223526, hi: 0x2e4733 }; // bosque / vegetacion densa
  }
  return { base: 0x1d2a18, hi: 0x2b3f23 }; // tierra / pasto base
}

// Flechas: SIEMPRE mueven (además de las teclas configurables del keymap).
const ARROW_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "north",
  ArrowDown: "south",
  ArrowLeft: "west",
  ArrowRight: "east",
};

const DELTAS: Record<Direction, Vector2> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

// Codigo de tecla equivalente por direccion — los controles tactiles
// reutilizan el mismo mecanismo de "tecla mantenida" que el teclado.
const DIR_TO_CODE: Record<Direction, string> = {
  north: "ArrowUp",
  south: "ArrowDown",
  west: "ArrowLeft",
  east: "ArrowRight",
};

export interface GameSceneResult {
  destroy: () => Promise<void>;
}

interface EntityVisual {
  container: Container;
  // Nombre de la entidad (para las líneas del log de combate).
  name: string;
  // Etiqueta SOBRE la cabeza: "Lv. N" y la clase. Jugadores: siempre visible.
  label: Text;
  // Nombre, DEBAJO del personaje (color por rol/criminal, como el de arriba).
  nameLabel: Text;
  criminal: boolean;
  // Facción y clan — arman el tag bajo el nombre (el clan tiene prioridad).
  faction: number;
  guild: string | null;
  // Rol GM (0 jugador · 1 Consejero · 2 Semidiós · 3 Dios) — nombre en verde.
  role: number;
  // Nivel y clase del jugador (para el label "Lv. N / Nombre - Clase").
  level: number;
  classId: number;
  // Habla sobre la cabeza (ChatOverHead del AO).
  // Burbuja de diálogo (globo + texto) sobre la cabeza.
  overheadText: Container | null;
  overheadUntil: number;
  // Aura de meditación (FX en loop) y estado invisible.
  meditateFx: FxHandle | null;
  invisible: boolean;
  // Silueta de fallback: se usa mientras no hay body/head del AO cargados,
  // o cuando el NPC no tiene sprite del sistema de personajes.
  body: Graphics;
  // Sprites del AO cuando hay body/head disponibles. Cuando bodySprite es
  // no nulo, ocultamos `body` (fallback) y usamos estos.
  bodySprite: Sprite | null;
  headSprite: Sprite | null;
  // Overlays de equipo (Armas/Escudos/Cascos): índices de anim + sprites.
  weaponAnim: number;
  shieldAnim: number;
  helmetAnim: number;
  weaponSprite: Sprite | null;
  shieldSprite: Sprite | null;
  helmetSprite: Sprite | null;
  equipLoadPending: boolean;
  hpBar: Graphics;
  position: Vector2; // tile destino (verdad logica)
  renderX: number;
  renderY: number;
  tweenFromX: number;
  tweenFromY: number;
  tweenStart: number;
  tweenDuration: number;
  isSelf: boolean;
  kind: EntityKind;
  hp: number;
  maxHp: number;
  dead: boolean;
  facing: Direction;
  // Animacion de golpe: SOLO el arma se desplaza en swingDx/swingDy (el
  // cuerpo queda quieto). swingAppliedX/Y = offset ya aplicado al sprite del
  // arma (para sumar deltas sin acumular error).
  swingStart: number; // 0 = sin swing
  swingAppliedX: number;
  swingAppliedY: number;
  swingDx: number;
  swingDy: number;
  // Sprite del AO (0 = usa silueta fallback).
  bodyId: number;
  headId: number;
  // Barra de HP flotante: visible hasta este timestamp (0 = oculta).
  hpBarUntil: number;
  // true mientras se bajan los PNGs del body/head (evita ensure duplicados).
  spriteLoadPending: boolean;
  // Reintentos de carga de sprites (cuerpo/cabeza): tope para no loopear si un
  // PNG está roto; después se dibuja con lo que haya.
  spriteLoadTries: number;
  // Frame actual del walk cycle y timestamp del último avance.
  walkFrame: number;
  lastFrameAt: number;
}

// Numero de daño que sube y se desvanece sobre una entidad.
interface Floater {
  text: Text;
  startY: number;
  start: number;
}

// Color del nombre de un jugador: los GM van en tonos de verde según el rango
// (Consejero → Semidiós → Dios), el resto azul ciudadano / rojo criminal.
function nameColor(role: number, criminal: boolean): string {
  if (role >= 3) return "#2bff2b"; // Dios — verde brillante
  if (role === 2) return "#57d957"; // Semidiós — verde medio
  if (role === 1) return "#a6e8a6"; // Consejero — verde claro
  return criminal ? "#ff4b4b" : "#6e9eff";
}

export async function startGameScene(
  root: HTMLElement,
  character: CharacterSummary,
  onAuthExpired: () => void,
  onChangeCharacter: () => void = () => undefined,
): Promise<GameSceneResult> {
  // ── Layout "Arte 1": placa redondeada centrada (más chica que el
  // navegador) con SEGMENTOS separados. Columna izquierda apilada:
  // chat (arriba) → mundo → macros (abajo), los tres del mismo ancho.
  // Columna derecha: inventario/personaje (arriba) → mapa (abajo).
  const frame = document.createElement("div");
  frame.className = "ao-frame";
  const mainCol = document.createElement("div");
  mainCol.className = "ao-main";
  const sideCol = document.createElement("div");
  sideCol.className = "ao-side";
  // Slots (segmentos) de la columna izquierda, en orden vertical.
  const chatSlot = document.createElement("div");
  chatSlot.className = "ao-seg ao-seg--chat";
  const stageEl = document.createElement("div");
  stageEl.className = "ao-stage ao-seg";
  const macroSlot = document.createElement("div");
  macroSlot.className = "ao-seg ao-seg--macros";
  mainCol.appendChild(chatSlot);
  mainCol.appendChild(stageEl);
  mainCol.appendChild(macroSlot);
  frame.appendChild(mainCol);
  frame.appendChild(sideCol);
  root.appendChild(frame);

  // Recuadro fijo del viewport (~21x15 tiles): acota el mundo visible al alcance
  // de casteo (SPELL_RANGE 10), para no ver de más en pantallas anchas. Se
  // centra en el stage con letterbox a los costados.
  const viewportBox = document.createElement("div");
  viewportBox.className = "ao-viewbox";
  stageEl.appendChild(viewportBox);

  const app = new Application();
  await app.init({
    background: "#05070c",
    resizeTo: viewportBox,
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  app.canvas.classList.add("ao-viewport");
  viewportBox.appendChild(app.canvas);

  // HUD flotante sobre el mundo (arriba-izquierda): nombre, vida, maná,
  // mapa y coordenadas — como el overlay del cliente moderno de Arte 1.
  const hudEl = document.createElement("div");
  hudEl.className = "ao-hud";
  hudEl.innerHTML = `
    <div class="ao-hud__name">—</div>
    <div class="ao-hud__bar ao-hud__bar--hp"><i></i><span>—</span></div>
    <div class="ao-hud__bar ao-hud__bar--mp"><i></i><span>—</span></div>
    <div class="ao-hud__loc">—</div>
  `;
  stageEl.appendChild(hudEl);
  const hudNameEl = hudEl.querySelector<HTMLDivElement>(".ao-hud__name")!;
  const hudHpFill = hudEl.querySelector<HTMLElement>(".ao-hud__bar--hp i")!;
  const hudHpLbl = hudEl.querySelector<HTMLElement>(".ao-hud__bar--hp span")!;
  const hudMpFill = hudEl.querySelector<HTMLElement>(".ao-hud__bar--mp i")!;
  const hudMpLbl = hudEl.querySelector<HTMLElement>(".ao-hud__bar--mp span")!;
  const hudLocEl = hudEl.querySelector<HTMLDivElement>(".ao-hud__loc")!;
  hudNameEl.textContent = character.name;
  // Color del nombre: se ajusta al estado criminal en handleCriminalUpdate.
  function updateHudVitals(hp: number, maxHp: number, mp: number, maxMp: number): void {
    hudHpFill.style.width = `${maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0}%`;
    hudHpLbl.textContent = `${hp}/${maxHp}`;
    if (maxMp > 0) {
      hudEl.classList.remove("ao-hud--nomp");
      hudMpFill.style.width = `${Math.round((mp / maxMp) * 100)}%`;
      hudMpLbl.textContent = `${mp}/${maxMp}`;
    } else {
      hudEl.classList.add("ao-hud--nomp");
    }
  }
  function updateHudLocation(mapName: string, mapId: number, x: number, y: number): void {
    hudLocEl.textContent = `${mapName} — Mapa ${mapId} (${x},${y})`;
  }

  // El stage captura TODOS los clicks del mundo. La detección de qué entidad
  // se clickeó se hace manualmente en onStagePointerDown (por posición en el
  // mundo), porque el hit-testing por-sprite de Pixi no es fiable con la cámara
  // escalada + y-sort de esta escena. Igual que el AO: se clickea por tile.
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  app.stage.on("pointerdown", (e) => {
    onStagePointerDown(
      e as unknown as { global: { x: number; y: number }; target: unknown; altKey?: boolean; shiftKey?: boolean; button?: number },
    );
  });
  // Click derecho: accionar puertas y leer carteles (doble click del AO).
  app.stage.on("rightdown", (e) => {
    onStageRightDown(e as unknown as { global: { x: number; y: number } });
  });
  app.canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // Contenedor del mundo: tiles + entidades. Lo movemos para emular camara.
  const world = new Container();
  world.scale.set(WORLD_SCALE);
  app.stage.addChild(world);

  // Orden de capas del AO: suelo (1) + decoración (2) → items del piso →
  // entidades + objetos que ocluyen (capa 3, árboles/paredes, y-sort) →
  // techos (capa 4, se atenúan cuando el jugador está bajo techo).
  const tilesLayer = new Container();
  const groundLayer = new Container();
  const entitiesLayer = new Container();
  const roofLayer = new Container();
  // y-sort del AO: dentro de entitiesLayer conviven jugadores, NPCs y los
  // objetos de la capa 3; el zIndex por Y decide quién tapa a quién.
  entitiesLayer.sortableChildren = true;
  world.addChild(tilesLayer);
  world.addChild(groundLayer);
  world.addChild(entitiesLayer);
  world.addChild(roofLayer);

  // Overlay de estado durante el handshake. Vive en el stage, no en el world,
  // porque no debe moverse con la camara.
  const statusStyle = new TextStyle({
    fill: "#f5e6c8",
    fontFamily: "Georgia, serif",
    fontSize: 22,
    align: "center",
    stroke: { color: "#0a0805", width: 4 },
  });
  const statusText = new Text({ text: "Conectando al servidor...", style: statusStyle });
  statusText.anchor.set(0.5);
  app.stage.addChild(statusText);

  // HUD pequenio arriba a la izquierda con info de debug.
  const hudStyle = new TextStyle({
    fill: "#a89c80",
    fontFamily: "Consolas, monospace",
    fontSize: 12,
    stroke: { color: "#0a0805", width: 2 },
  });
  const hud = new Text({ text: "", style: hudStyle });
  hud.x = 12;
  hud.y = 12;
  // Línea de debug de conexión: la reemplaza el HUD DOM de Arte 1.
  hud.visible = false;
  app.stage.addChild(hud);

  // Las barras de HP/MP/XP/hambre/sed viven en el panel lateral DOM
  // (ui/inventory.ts). Acá solo mantenemos el estado y lo empujamos.
  const panelStats: PanelStats = {
    name: character.name,
    level: 1,
    xpInto: 0,
    xpForNext: 1,
    hp: 0,
    maxHp: 0,
    mana: 0,
    maxMana: 0,
    hunger: 100,
    thirst: 100,
    sta: 100,
    maxSta: 100,
    strBonus: 0,
    agiBonus: 0,
    buffExpiresAt: 0,
    str: 0,
    agi: 0,
  };
  function pushPanelStats(): void {
    inventory?.setStats({ ...panelStats });
    updateHudVitals(panelStats.hp, panelStats.maxHp, panelStats.mana, panelStats.maxMana);
  }

  // -- Muerte: velo gris suave (el fantasma sigue viendo y caminando) +
  // panel DOM con la opción de volver al hogar (sistema /hogar del AO) --
  const deathOverlay = new Graphics();
  deathOverlay.visible = false;
  app.stage.addChild(deathOverlay);

  const deathPanel = document.createElement("div");
  deathPanel.className = "ao-deathpanel";
  deathPanel.innerHTML = `
    <div class="ao-deathpanel__title">☠ Estás muerto</div>
    <div class="ao-deathpanel__hint">Esperá a que un sacerdote u otro personaje te reviva, o viajá a la ciudad.</div>
    <button type="button" class="ao-deathpanel__home">🏠 Ir a la ciudad</button>
    <button type="button" class="ao-deathpanel__cancel" hidden>✖ Cancelar viaje</button>
  `;
  stageEl.appendChild(deathPanel);
  const deathHomeBtn = deathPanel.querySelector<HTMLButtonElement>(".ao-deathpanel__home")!;
  const deathCancelBtn = deathPanel.querySelector<HTMLButtonElement>(".ao-deathpanel__cancel")!;
  let homeCountdown: ReturnType<typeof setInterval> | null = null;
  function stopHomeCountdown(): void {
    if (homeCountdown) { clearInterval(homeCountdown); homeCountdown = null; }
  }
  // Restaura los botones al estado inicial (no viajando).
  function resetHomeUi(): void {
    stopHomeCountdown();
    deathHomeBtn.disabled = false;
    deathHomeBtn.textContent = "🏠 Ir a la ciudad";
    deathCancelBtn.hidden = true;
  }
  deathHomeBtn.addEventListener("click", () => {
    client?.send({ op: ClientToServerOp.GoHome } satisfies GoHomeRequest);
    deathHomeBtn.disabled = true;
    deathCancelBtn.hidden = false; // permite cancelar mientras viaja
    // Cuenta regresiva en vivo (3s = HOME_TRAVEL_MS del server).
    let secs = 3;
    deathHomeBtn.textContent = `🏠 Viajando… ${secs}s`;
    stopHomeCountdown();
    homeCountdown = setInterval(() => {
      secs -= 1;
      deathHomeBtn.textContent = secs > 0 ? `🏠 Viajando… ${secs}s` : "🏠 Llegando…";
      if (secs <= 0) stopHomeCountdown();
    }, 1000);
  });
  // Cancelar el viaje: seguís muerto donde estás (para que otro te reviva).
  deathCancelBtn.addEventListener("click", () => {
    client?.send({ op: ClientToServerOp.CancelGoHome } satisfies CancelGoHomeRequest);
    resetHomeUi();
  });

  function layoutCombatHud(): void {
    deathOverlay.clear();
    // Velo suave: el fantasma tiene que poder ver por dónde camina.
    deathOverlay
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: 0x12100b, alpha: 0.3 });
  }

  function updateSelfHud(): void {
    const own = entityVisuals.get(character.id);
    if (!own) return;
    panelStats.hp = own.hp;
    panelStats.maxHp = own.maxHp;
    pushPanelStats();
  }

  function showDeathOverlay(): void {
    deathOverlay.visible = true;
    deathPanel.classList.add("ao-deathpanel--on");
  }

  function hideDeathOverlay(): void {
    deathOverlay.visible = false;
    deathPanel.classList.remove("ao-deathpanel--on");
    resetHomeUi();
  }

  function centerStatus(): void {
    statusText.x = app.screen.width / 2;
    statusText.y = app.screen.height / 2;
  }
  centerStatus();
  layoutCombatHud();
  // El panel lateral recibe los stats reales con el primer StatsUpdate del
  // server — no lo tocamos acá porque todavía no está montado (TDZ).

  // Tileset clásico del AO. Arrancamos la carga del índice en paralelo con
  // la conexión; renderTiles espera a que esté listo antes de dibujar.
  const tileset = new Tileset();
  const tilesetIndexReady = tileset.loadIndex().catch((err: unknown) => {
    console.warn("[ao-client] no se pudo cargar el tileset, se usa fallback de color", err);
  });

  // FX del AO (fxs.ini): animaciones de hechizos, meditación, etc.
  const fxPlayer = new FxPlayer(tileset);
  void fxPlayer.load().catch((err: unknown) => {
    console.warn("[ao-client] no se pudieron cargar los FX", err);
  });

  // Sistema de sprites de personaje (Personajes.ind / Cabezas.ind del AO).
  // Se carga en paralelo. Mientras no esté listo, las entidades usan la
  // silueta de fallback. Cuando termina, se les enchufa el sprite real.
  const personajes = new Personajes(tileset);
  const personajesReady = personajes.load().catch((err: unknown) => {
    console.warn("[ao-client] no se pudo cargar personajes.json, siluetas de fallback", err);
  });
  void personajesReady.then(() => {
    for (const v of entityVisuals.values()) tryAttachCharSprites(v);
  });

  // Overlays de arma/escudo/casco (Armas.dat / Escudos.dat / Cascos.ini).
  const equip = new Equipamiento(tileset);
  void equip.load().then(() => {
    for (const v of entityVisuals.values()) attachEquipSprites(v);
  }).catch((err: unknown) => {
    console.warn("[ao-client] no se pudo cargar equipamiento.json", err);
  });

  // Los íconos del inventario se muestran vía CSS (tileset.entry) y no
  // necesitan precarga. Los sprites de items en el suelo se cargan lazy
  // por item al aparecer (ver addGroundItemVisual) — con el catálogo real
  // de 1237 items precargar todo al inicio sería demasiado.

  // Overlay de transición de mapa: flash negro que se desvanece en 400 ms.
  const TRANSITION_FLASH_MS = 400;
  let transitionFlashEnd = 0;
  const transitionFlash = new Graphics();
  // Rect sobredimensionado para cubrir cualquier tamaño de pantalla.
  transitionFlash.rect(-500, -500, 10000, 10000).fill({ color: 0x000000 });
  transitionFlash.alpha = 0;
  transitionFlash.visible = false;
  app.stage.addChild(transitionFlash);

  let currentMapId = -1;

  const entityVisuals = new Map<number, EntityVisual>();
  const groundItemVisuals = new Map<number, Container>();
  // Datos del item en el suelo (para mostrar su nombre al clickearlo — ya no
  // se dibuja un cartel permanente sobre cada item).
  const groundItemMeta = new Map<number, { x: number; y: number; item: number; qty: number }>();
  let mapWidth = 0;
  let mapHeight = 0;
  let mapBlocked: ReadonlyArray<number> = [];
  // Agua por tile (para la predicción de navegación).
  let mapWater: number[] = [];
  // Trigger por tile (1/2/4 = bajo techo → atenuar la capa de techos).
  let mapTrigger: ReadonlyArray<number> = [];
  // Sprites de la capa 3 (árboles/paredes) que viven en entitiesLayer;
  // se destruyen al cambiar de mapa sin tocar a las entidades.
  let mapObjectSprites: Sprite[] = [];
  // Sprites de capa 3 indexados por tile — para actualizar puertas en vivo.
  const layer3ByTile = new Map<number, Sprite>();
  // Tiles animados (agua, lava, costas — GRHs animados del Graficos.ind).
  // speed = duración del ciclo completo en ms (semántica del TileEngine).
  let animatedTiles: Array<{ sprite: Sprite; frames: number[]; speed: number }> = [];
  let tileAnims: Record<string, { frames: number[]; speed: number }> | null = null;

  // Dibuja la barra de HP de una entidad en el origen local del Graphics;
  // la posición vertical la decide showEntityHpBar según la altura del sprite.
  function drawHpBar(g: Graphics, hp: number, maxHp: number): void {
    const w = 28;
    const h = 4;
    const x = -w / 2;
    const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    g.clear();
    g.rect(x - 1, -1, w + 2, h + 2).fill({ color: 0x0a0805, alpha: 0.75 });
    // Color por tramos: verde, ambar, rojo.
    const color = frac > 0.5 ? 0x4cb87e : frac > 0.25 ? 0xd4af37 : 0xc93838;
    if (frac > 0) {
      g.rect(x, 0, w * frac, h).fill({ color });
    }
  }

  // Barra de HP de jugador, estilo panel lateral (.ao-bar--hp): roja, bordes
  // redondeados y un poco más larga. Siempre roja (la de NPCs va por tramos).
  function drawPlayerHpBar(g: Graphics, hp: number, maxHp: number): void {
    const w = 52;
    const h = 6;
    const x = -w / 2;
    const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    g.clear();
    g.roundRect(x - 1, -1, w + 2, h + 2, 4)
      .fill({ color: 0x0a0805, alpha: 0.8 })
      .stroke({ width: 1, color: 0x2a1f14 });
    if (frac > 0) {
      g.roundRect(x, 0, w * frac, h, 3).fill({ color: 0xc94a3a });
    }
  }

  // El AO original no muestra barras de vida flotantes. Compromiso: la barra
  // aparece SOLO al recibir daño, por 3 segundos, y siempre por ENCIMA del
  // sprite (calculado con su altura real — nunca sobre la cara).
  const HP_BAR_SHOW_MS = 3_000;
  function showEntityHpBar(v: EntityVisual): void {
    if (v.kind === "player") {
      // Jugadores: barra roja SIEMPRE visible, DEBAJO del nombre.
      drawPlayerHpBar(v.hpBar, v.hp, v.maxHp);
      v.hpBar.y = 30;
      v.hpBar.visible = true;
      v.hpBarUntil = 0;
    } else {
      // NPCs/criaturas: como el AO, solo unos segundos al recibir daño, arriba.
      drawHpBar(v.hpBar, v.hp, v.maxHp);
      v.hpBar.y = v.bodySprite ? v.bodySprite.y - v.bodySprite.height - 10 : -34;
      v.hpBar.visible = true;
      v.hpBarUntil = performance.now() + HP_BAR_SHOW_MS;
    }
  }

  // Dibuja la figura humana orientada en `facing`. Se llama al crear y cada
  // vez que cambia la direccion. NPCs comerciantes / hostiles usan la misma
  // silueta con paletas distintas para que a simple vista se distinga oro
  // (self) / azul (otro jugador) / verde (comerciante) / rojo (NPC hostil).
  function drawEntityBody(
    body: Graphics,
    isSelf: boolean,
    kind: EntityKind,
    facing: Direction,
  ): void {
    const isNpc = kind === "npc";
    const isMerchant = kind === "merchant";
    const isBanker = kind === "banker";
    const bodyColor = isMerchant
      ? 0x2d7d5a
      : isBanker
        ? 0x2d4d8c
        : isNpc
          ? 0x8c3b2e
          : isSelf
            ? 0xa8862c
            : 0x4a6d8f;
    const bodyStroke = isMerchant
      ? 0x4cb87e
      : isBanker
        ? 0x6b9fff
        : isNpc
          ? 0xc9603f
          : isSelf
            ? 0xf4d56a
            : 0x9bc6f1;
    // Tono "piel" para la cabeza — un poco de contraste con el torso.
    const headColor = isNpc ? 0xd4a68c : 0xe5c9a8;

    body.clear();

    // Sombra ovalada en el suelo (siempre visible, marca la posicion base).
    body.ellipse(0, 10, 9, 3).fill({ color: 0x000000, alpha: 0.35 });

    // Torso (siluetas ligeramente distintas segun facing para dar 3/4 view).
    if (facing === "east" || facing === "west") {
      // De perfil: torso mas angosto.
      body
        .roundRect(-5, -4, 10, 14, 2)
        .fill({ color: bodyColor })
        .stroke({ width: 1.5, color: bodyStroke });
    } else {
      // De frente / espalda: torso ancho.
      body
        .roundRect(-7, -4, 14, 14, 3)
        .fill({ color: bodyColor })
        .stroke({ width: 1.5, color: bodyStroke });
    }

    // Cabeza — un poco desplazada en la direccion facing (efecto de mirar).
    const headOffsetX = facing === "east" ? 1 : facing === "west" ? -1 : 0;
    const headY = -9;
    body
      .circle(headOffsetX, headY, 5)
      .fill({ color: headColor })
      .stroke({ width: 1.5, color: bodyStroke });

    // Indicador direccional — punto "cara" que muestra el frente.
    // De espaldas (north) queda oculto detras de la cabeza, dando el
    // efecto de estar dandonos la espalda.
    if (facing === "south") {
      body.circle(headOffsetX, headY + 1, 1.2).fill({ color: 0x1a1208 });
    } else if (facing === "east") {
      body.circle(headOffsetX + 2, headY, 1.2).fill({ color: 0x1a1208 });
    } else if (facing === "west") {
      body.circle(headOffsetX - 2, headY, 1.2).fill({ color: 0x1a1208 });
    }
    // north: sin punto — vemos la nuca.
  }

  function buildEntityVisual(
    name: string,
    isSelf: boolean,
    kind: EntityKind,
    facing: Direction,
  ): { container: Container; body: Graphics; hpBar: Graphics; label: Text; nameLabel: Text } {
    const c = new Container();
    const body = new Graphics();
    drawEntityBody(body, isSelf, kind, facing);
    c.addChild(body);

    // Colores del AO: jugadores azul ciudadano (criminal se pinta rojo al
    // conocerse el estado); NPCs con tinte por rol (solo visibles al hover).
    const labelFill =
      kind === "merchant" ? "#a7e0c4"
      : kind === "banker" ? "#9ec2f0"
      : kind === "npc" ? "#e8b3a3"
      : "#6e9eff";
    const label = new Text({
      text: name,
      // El mundo se escala 2x: el texto se rasteriza a resolución doble
      // (por el zoom y el devicePixelRatio) para que quede nítido.
      resolution: WORLD_SCALE * (window.devicePixelRatio || 1),
      // Jugadores: "Lv. N / Clase" va más chico que el nombre (info
      // secundaria). NPCs: el label es su nombre al hover — tamaño normal.
      style: new TextStyle({
        fill: labelFill,
        fontFamily: "Verdana, Geneva, sans-serif",
        fontSize: kind === "player" ? 7.5 : 10,
        fontWeight: "bold",
        align: "center",
        stroke: { color: "#0a0805", width: kind === "player" ? 2 : 3 },
      }),
    });
    // Label SOBRE la cabeza. Los NPCs muestran su nombre al pasar el mouse; los
    // JUGADORES ya NO muestran "Lv. N / Clase" arriba (molestaba) — solo el nombre
    // debajo. Por eso el label arranca oculto para todos.
    label.anchor.set(0.5, 1);
    label.y = -40;
    label.visible = false;
    c.addChild(label);

    // Nombre DEBAJO del personaje (mismo estilo; se colorea por rol/criminal).
    const nameLabel = new Text({
      text: name,
      resolution: WORLD_SCALE * (window.devicePixelRatio || 1),
      style: new TextStyle({
        fill: labelFill,
        fontFamily: "Verdana, Geneva, sans-serif",
        fontSize: 10,
        fontWeight: "bold",
        align: "center",
        stroke: { color: "#0a0805", width: 3 },
      }),
    });
    nameLabel.anchor.set(0.5, 0);
    nameLabel.y = 15;
    if (kind !== "player") nameLabel.visible = false;
    c.addChild(nameLabel);

    // Oculta por defecto (el AO no muestra barras flotantes); aparece unos
    // segundos al recibir daño — ver showEntityHpBar.
    const hpBar = new Graphics();
    hpBar.visible = false;
    c.addChild(hpBar);

    return { container: c, body, hpBar, label, nameLabel };
  }

  function entityCenterPx(pos: Vector2): { x: number; y: number } {
    return {
      x: pos.x * TILE_SIZE + TILE_SIZE / 2,
      y: pos.y * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  function addEntity(
    id: number,
    pos: Vector2,
    name: string,
    isSelf: boolean,
    hp: number,
    maxHp: number,
    kind: EntityKind,
    facing: Direction,
    bodyId: number,
    headId: number,
    criminal = false,
    faction = 0,
    guild: string | null = null,
    weaponAnim = 0,
    shieldAnim = 0,
    helmetAnim = 0,
    role = 0,
    level = 1,
    classId = 1,
  ): EntityVisual {
    const { container, body, hpBar, label, nameLabel } = buildEntityVisual(name, isSelf, kind, facing);
    if (kind === "player") {
      const col = nameColor(role, criminal);
      label.style.fill = col;
      nameLabel.style.fill = col;
    }
    // NPCs: nombre visible solo al pasar el mouse (como el AO).
    if (kind !== "player") {
      container.on("pointerover", () => { label.visible = true; });
      container.on("pointerout", () => { label.visible = false; });
    }
    const c = entityCenterPx(pos);
    container.x = c.x;
    container.y = c.y;
    const dead = hp <= 0;
    if (dead) body.alpha = 0.35;
    // Los clicks sobre entidades (atacar, abrir tienda/banco, party/trade,
    // castear) se resuelven en onStagePointerDown por posición en el mundo:
    // el hit-testing por-sprite de Pixi no es fiable en esta escena (cámara
    // escalada + y-sort). Dejamos el container interactivo solo para el cursor.
    container.eventMode = "static";
    if (!isSelf) container.cursor = "pointer";
    entitiesLayer.addChild(container);
    const visual: EntityVisual = {
      container,
      name,
      label,
      nameLabel,
      criminal,
      faction,
      guild,
      role,
      overheadText: null,
      overheadUntil: 0,
      meditateFx: null,
      invisible: false,
      body,
      bodySprite: null,
      headSprite: null,
      weaponAnim,
      shieldAnim,
      helmetAnim,
      weaponSprite: null,
      shieldSprite: null,
      helmetSprite: null,
      equipLoadPending: false,
      hpBar,
      position: { x: pos.x, y: pos.y },
      renderX: c.x,
      renderY: c.y,
      tweenFromX: c.x,
      tweenFromY: c.y,
      tweenStart: 0,
      tweenDuration: 0,
      isSelf,
      kind,
      level,
      classId,
      hp,
      maxHp,
      dead,
      facing,
      swingStart: 0,
      swingAppliedX: 0,
      swingAppliedY: 0,
      swingDx: 0,
      swingDy: 0,
      bodyId,
      headId,
      hpBarUntil: 0,
      spriteLoadPending: false,
      spriteLoadTries: 0,
      walkFrame: 0,
      lastFrameAt: 0,
    };
    entityVisuals.set(id, visual);
    applyNameTag(visual);
    if (kind === "player" && !dead) showEntityHpBar(visual);
    tryAttachCharSprites(visual);
    return visual;
  }

  // Duración de cada frame del walk cycle. TWEEN_DURATION_MS lo recorre un
  // tile completo; dividimos en ~6 frames para que la animación quepa en
  // el tiempo del movimiento.
  const WALK_FRAME_MS = 60;

  // Mapa de Direction del server a la Direction del AO (mismos nombres).
  function toCharDir(d: Direction): CharDirection {
    return d;
  }

  // Si el sistema de personajes está cargado y la entidad tiene bodyId>0,
  // creamos body/head Sprites y ocultamos la silueta Graphics. Idempotente:
  // si ya están creados o el índice todavía no cargó, no hace nada.
  // Todos los bodies (jugadores, NPCs humanoides, criaturas y ropajes) viven
  // en el mismo espacio de Personajes.ini; la head se agrega si headId > 0.
  function tryAttachCharSprites(v: EntityVisual): void {
    if (v.bodySprite) return;
    if (!personajes.ready) return;
    if (v.bodyId <= 0) return;
    if (!personajes.hasBody(v.bodyId)) return;

    const dir = toCharDir(v.facing);
    const bodyTex = personajes.bodyFrame(v.bodyId, dir, 0);
    // La cabeza también debe estar cargada: si el body ya estaba (atlas de otro
    // jugador) pero el PNG de esta cabeza no, ANTES se dibujaba el cuerpo SIN
    // cabeza y sin reintento → jugador sin cabeza para ese observador. Ahora se
    // espera a que ambos estén listos (con tope de reintentos por si un PNG falla).
    const needHead = v.headId > 0 && personajes.hasHead(v.headId);
    const headReady = !needHead || personajes.head(v.headId, dir) !== null;
    if (!bodyTex || !headReady) {
      if (!v.spriteLoadPending && v.spriteLoadTries < 5) {
        v.spriteLoadPending = true;
        v.spriteLoadTries += 1;
        const wantedBody = v.bodyId;
        const wantedHead = v.headId;
        void personajes.ensure(v.bodyId, v.headId).then(() => {
          v.spriteLoadPending = false;
          if (!v.container.destroyed && v.bodyId === wantedBody && v.headId === wantedHead) {
            tryAttachCharSprites(v);
          }
        });
      }
      // Sin body no dibujamos nada; si tras varios intentos falta solo la cabeza,
      // seguimos y dibujamos el cuerpo (mejor cuerpo sin cabeza que nada).
      if (!bodyTex) return;
      if (!headReady && v.spriteLoadTries < 5) return;
    }

    // Colocación EXACTA del motor original (Draw_Grh con center=1,
    // TileEngine.bas L1850): centrado horizontal en el tile y con el borde
    // INFERIOR del frame alineado al borde inferior del tile. La cabeza va a
    // tile-bottom + HeadOffset — posición FIJA, independiente de la altura
    // del frame del cuerpo (por eso no "baila" al caminar).
    const TILE_BOTTOM = TILE_SIZE / 2; // container centrado en el tile

    const bodySprite = new Sprite(bodyTex);
    bodySprite.anchor.set(0.5, 1);
    bodySprite.y = TILE_BOTTOM;
    v.bodySprite = bodySprite;
    v.container.addChildAt(bodySprite, 0); // debajo de la barra HP

    // Cabeza separada (jugadores y NPCs humanoides; las criaturas van sin head).
    // Los frames de cabeza del AO son 17x50 con la cara arriba: alineados al
    // fondo del tile + offset quedan exactamente sobre los hombros.
    if (v.headId > 0 && personajes.hasHead(v.headId)) {
      const headTex = personajes.head(v.headId, dir);
      if (headTex) {
        const headSprite = new Sprite(headTex);
        headSprite.anchor.set(0.5, 1);
        const offset = personajes.headOffset(v.bodyId);
        headSprite.x = offset.x;
        headSprite.y = TILE_BOTTOM + offset.y;
        v.headSprite = headSprite;
        v.container.addChildAt(headSprite, 1);
      }
    }

    // Ocultamos la silueta fallback ahora que hay sprite real.
    v.body.visible = false;

    attachEquipSprites(v);
  }

  // Overlays de arma/escudo/casco sobre el body (draw order del TileEngine:
  // body → head → casco → arma → escudo). El casco va en la posición de la
  // cabeza; arma y escudo alineados al fondo del tile como el body.
  function attachEquipSprites(v: EntityVisual): void {
    if (!equip.ready || !v.bodySprite || v.kind !== "player") return;
    const dir = toCharDir(v.facing);
    const TILE_BOTTOM = TILE_SIZE / 2;
    const anchorIdx = (): number =>
      v.container.getChildIndex(v.helmetSprite ?? v.headSprite ?? v.bodySprite!) + 1;
    let missing = false;

    if (v.helmetAnim > 0 && !v.helmetSprite && equip.hasHelmet(v.helmetAnim) && v.headSprite) {
      const tex = equip.helmet(v.helmetAnim, dir);
      if (tex) {
        const sp = new Sprite(tex);
        // El casco (grh ~17x16) va alineado al TOPE de la cabeza (grh 17x50),
        // no anclado abajo como la cabeza: si no, el casco corto queda al ras
        // del cuello (parecía "en los pies"). Top-center sobre el tope de la
        // cabeza = como el Draw_Grh del AO (mismo top-left que la cabeza).
        sp.anchor.set(0.5, 0);
        sp.x = v.headSprite.x;
        sp.y = v.headSprite.y - v.headSprite.height;
        v.helmetSprite = sp;
        v.container.addChildAt(sp, v.container.getChildIndex(v.headSprite) + 1);
      } else missing = true;
    }
    if (v.weaponAnim > 0 && !v.weaponSprite && equip.hasWeapon(v.weaponAnim)) {
      const tex = equip.weaponFrame(v.weaponAnim, dir, 0);
      if (tex) {
        const sp = new Sprite(tex);
        sp.anchor.set(0.5, 1);
        sp.y = TILE_BOTTOM;
        v.weaponSprite = sp;
        // Sprite nuevo en posición base: resetear el offset de swing aplicado
        // (si se re-crea a mitad de un golpe, no debe quedar corrido).
        v.swingAppliedX = 0;
        v.swingAppliedY = 0;
        v.container.addChildAt(sp, anchorIdx());
      } else missing = true;
    }
    if (v.shieldAnim > 0 && !v.shieldSprite && equip.hasShield(v.shieldAnim)) {
      const tex = equip.shieldFrame(v.shieldAnim, dir, 0);
      if (tex) {
        const sp = new Sprite(tex);
        sp.anchor.set(0.5, 1);
        sp.y = TILE_BOTTOM;
        v.shieldSprite = sp;
        v.container.addChildAt(sp, (v.weaponSprite ? v.container.getChildIndex(v.weaponSprite) : anchorIdx() - 1) + 1);
      } else missing = true;
    }

    // PNGs aún no bajados: precargar y reintentar una vez listos.
    if (missing && !v.equipLoadPending) {
      v.equipLoadPending = true;
      void equip.ensure(v.weaponAnim, v.shieldAnim, v.helmetAnim).then(() => {
        v.equipLoadPending = false;
        if (!v.container.destroyed) attachEquipSprites(v);
      });
    }
  }

  function detachEquipSprites(v: EntityVisual): void {
    for (const key of ["weaponSprite", "shieldSprite", "helmetSprite"] as const) {
      const sp = v[key];
      if (sp) {
        v.container.removeChild(sp);
        sp.destroy();
        v[key] = null;
      }
    }
  }

  // Actualiza texturas del sprite según facing y walkFrame actuales.
  function refreshCharTextures(v: EntityVisual): void {
    if (!v.bodySprite) return;
    const dir = toCharDir(v.facing);
    const bt = personajes.bodyFrame(v.bodyId, dir, v.walkFrame);
    if (bt) v.bodySprite.texture = bt;
    if (v.headSprite) {
      const ht = personajes.head(v.headId, dir);
      if (ht) v.headSprite.texture = ht;
    }
    if (v.weaponSprite) {
      const wt = equip.weaponFrame(v.weaponAnim, dir, v.walkFrame);
      if (wt) v.weaponSprite.texture = wt;
    }
    if (v.shieldSprite) {
      const st = equip.shieldFrame(v.shieldAnim, dir, v.walkFrame);
      if (st) v.shieldSprite.texture = st;
    }
    if (v.helmetSprite) {
      const ct = equip.helmet(v.helmetAnim, dir);
      if (ct) v.helmetSprite.texture = ct;
    }
  }

  // Cambio de ropaje: el server avisa que el body/head visible cambió.
  // Destruimos los sprites actuales y re-attacheamos con el nuevo body.
  function setEntityAppearance(
    v: EntityVisual,
    bodyId: number,
    headId: number,
    weaponAnim = 0,
    shieldAnim = 0,
    helmetAnim = 0,
  ): void {
    if (
      v.bodyId === bodyId && v.headId === headId &&
      v.weaponAnim === weaponAnim && v.shieldAnim === shieldAnim && v.helmetAnim === helmetAnim
    ) return;
    v.bodyId = bodyId;
    v.headId = headId;
    v.spriteLoadTries = 0; // apariencia nueva → reintentos de carga desde cero
    v.weaponAnim = weaponAnim;
    v.shieldAnim = shieldAnim;
    v.helmetAnim = helmetAnim;
    if (v.bodySprite) {
      v.container.removeChild(v.bodySprite);
      v.bodySprite.destroy();
      v.bodySprite = null;
    }
    if (v.headSprite) {
      v.container.removeChild(v.headSprite);
      v.headSprite.destroy();
      v.headSprite = null;
    }
    detachEquipSprites(v);
    // Silueta fallback visible hasta que el attach la reemplace.
    v.body.visible = true;
    v.walkFrame = 0;
    tryAttachCharSprites(v);
  }

  // Cambia la direccion en la que mira la entidad y redibuja el body.
  // No-op si el facing no cambio, para evitar el redraw en cada tick.
  function setEntityFacing(v: EntityVisual, facing: Direction): void {
    if (v.facing === facing) return;
    v.facing = facing;
    if (v.bodySprite) {
      // Girar en movimiento NO reinicia el ciclo de caminata (flow AO);
      // solo resetea a idle si está quieto.
      if (v.tweenDuration === 0) v.walkFrame = 0;
      refreshCharTextures(v);
    } else {
      drawEntityBody(v.body, v.isSelf, v.kind, facing);
      if (v.dead) v.body.alpha = 0.35;
    }
  }

  function moveEntityTo(id: number, pos: Vector2): void {
    const v = entityVisuals.get(id);
    if (!v) return;
    v.position = { x: pos.x, y: pos.y };
    v.tweenFromX = v.renderX;
    v.tweenFromY = v.renderY;
    v.tweenStart = performance.now();
    v.tweenDuration = TWEEN_DURATION_MS;
    // Pasos de OTROS jugadores (el AO los reproduce para todos los cercanos;
    // antes solo sonaban los propios). Volumen bajo; NPCs sin pasos.
    if (v.kind === "player" && id !== character.id && !v.dead) {
      stepToggle = !stepToggle;
      audio.play(stepToggle ? SND.paso1 : SND.paso2, 0.3);
    }
    // El target real lo aplica el ticker frame a frame con la interpolacion.
  }

  function snapEntityTo(id: number, pos: Vector2): void {
    const v = entityVisuals.get(id);
    if (!v) return;
    const c = entityCenterPx(pos);
    v.position = { x: pos.x, y: pos.y };
    v.renderX = c.x;
    v.renderY = c.y;
    v.tweenFromX = c.x;
    v.tweenFromY = c.y;
    v.tweenDuration = 0;
    v.container.x = c.x;
    v.container.y = c.y;
  }

  function removeEntity(id: number): void {
    const v = entityVisuals.get(id);
    if (!v) return;
    entitiesLayer.removeChild(v.container);
    v.container.destroy({ children: true });
    entityVisuals.delete(id);
  }

  function addGroundItemVisual(id: number, pos: Vector2, item: number, qty = 1): void {
    if (groundItemVisuals.has(id)) return;
    const def = getItem(item);
    const c = new Container();

    // Sprite real del AO si el atlas ya tiene el grh del item. Si el PNG
    // todavía no se bajó, mostramos el cuadrado dorado y lo cargamos lazy:
    // al terminar, si el item sigue en el suelo, se reemplaza por el sprite.
    const tex = def && def.graphic > 0 ? tileset.get(def.graphic) : null;
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5);
      c.addChild(s);
    } else {
      const g = new Graphics();
      g.rect(-6, -6, 12, 12)
        .fill({ color: 0xd4af37 })
        .stroke({ width: 1, color: 0xf4d56a });
      c.addChild(g);
      if (def && def.graphic > 0 && tileset.ready) {
        void tileset.preload([def.graphic]).then(() => {
          if (!groundItemVisuals.has(id)) return; // ya lo levantaron
          const loaded = tileset.get(def.graphic);
          if (!loaded) return;
          c.removeChild(g);
          g.destroy();
          const s = new Sprite(loaded);
          s.anchor.set(0.5);
          c.addChildAt(s, 0);
        });
      }
    }

    // Sin cartel de nombre: el item se ve solo por su sprite. El nombre se
    // consulta clickeándolo (aparece en el chat) — ver onStagePointerDown.
    const px = entityCenterPx(pos);
    c.x = px.x;
    c.y = px.y;
    groundLayer.addChild(c);
    groundItemVisuals.set(id, c);
    groundItemMeta.set(id, { x: pos.x, y: pos.y, item, qty });
  }

  function removeGroundItemVisual(id: number): void {
    groundItemMeta.delete(id);
    const c = groundItemVisuals.get(id);
    if (!c) return;
    groundLayer.removeChild(c);
    c.destroy({ children: true });
    groundItemVisuals.delete(id);
  }

  // Item en el suelo en un tile (o null). Para mostrar su nombre al clickear.
  function groundItemAtTile(tx: number, ty: number): { item: number; qty: number } | null {
    for (const m of groundItemMeta.values()) {
      if (m.x === tx && m.y === ty) return { item: m.item, qty: m.qty };
    }
    return null;
  }

  function clearGroundItems(): void {
    for (const c of groundItemVisuals.values()) c.destroy({ children: true });
    groundItemVisuals.clear();
    groundItemMeta.clear();
    groundLayer.removeChildren();
  }

  // Recolecta los nombres de las entidades conocidas y refresca el panel
  // de jugadores online. El nombre se lee del label del container.
  function refreshPlayerList(): void {
    if (!playerList) return;
    const names: string[] = [];
    for (const v of entityVisuals.values()) {
      if (v.kind !== "player") continue; // los NPCs no van en la lista de online
      if (v.name.startsWith("?")) continue; // placeholder de entidad desconocida
      names.push(v.name);
    }
    playerList.setPlayers(names);
  }

  function centerCameraOnSelf(): void {
    const own = entityVisuals.get(character.id);
    if (!own) return;
    // Redondeo a píxel entero: evita el shimmer de subpíxel del pixel-art 2x.
    // El canvas ES el viewport (hueco de la VentanaPrincipal): centrar simple.
    world.x = Math.round(app.screen.width / 2 - own.renderX * WORLD_SCALE);
    world.y = Math.round(app.screen.height / 2 - own.renderY * WORLD_SCALE);
  }

  let mapRenderToken = 0;
  // El primer mapa (login) se dibuja recién cuando TODOS sus atlas están listos,
  // para que nunca se vea el terreno en color de fallback. Después ya no.
  let firstMapDrawn = false;
  // Mientras un MapData se aplica (la carga de atlas puede tardar segundos),
  // los paquetes entrantes se BUFFEREAN y se re-aplican al terminar: sin esto,
  // spawns/despawns llegados durante la carga se procesaban contra el mapa
  // viejo y el snapshot los pisaba (entidades/items fantasma o invisibles).
  let mapLoadToken = 0;
  let mapLoading = false;
  const packetsWhileLoading: AnyPacket[] = [];

  // Dibuja las 4 capas con las texturas que YA están en caché; las que falten
  // quedan como fallback de color. Es reejecutable: se vuelve a llamar cuando la
  // precarga en segundo plano trae las texturas nuevas (dibujo progresivo).
  function drawTiles(data: MapData): void {
    // destroy() explícito: removeChildren() solo suelta la referencia y los
    // ~10k sprites del mapa anterior quedaban reteniendo geometría GPU.
    for (const c of tilesLayer.removeChildren()) c.destroy();
    for (const c of roofLayer.removeChildren()) c.destroy();
    // Limpiar los objetos de capa 3 del mapa anterior (viven en entitiesLayer).
    for (const s of mapObjectSprites) {
      entitiesLayer.removeChild(s);
      s.destroy();
    }
    mapObjectSprites = [];
    layer3ByTile.clear();
    animatedTiles = [];

    // Fallback de color: un solo Graphics con las celdas que no tienen textura
    // (grh 0 = vacío, o PNG todavía no cargado). PixiJS lo bachea como un mesh.
    const fallback = new Graphics();
    tilesLayer.addChild(fallback);

    // Los gráficos de las capas 2-4 pueden ser más grandes que un tile
    // (árboles de 96x128, techos). El AO los dibuja centrados en X y
    // apoyados en el borde inferior del tile: anchor (0.5, 1).
    const placeAnchored = (tex: Texture, x: number, y: number): Sprite => {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 1);
      sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
      sprite.y = (y + 1) * TILE_SIZE;
      return sprite;
    };

    // Pasada 1: todo el suelo (capa 1). Pasada 2: toda la decoración
    // (capa 2) — así una decoración más ancha que un tile nunca queda
    // tapada por el piso del tile vecino.
    for (let y = 0; y < data.height; y += 1) {
      for (let x = 0; x < data.width; x += 1) {
        const idx = y * data.width + x;
        const g1 = data.graphic[idx] ?? 0;
        const tex1 = g1 ? tileset.get(g1) : null;
        if (tex1) {
          const sprite = new Sprite(tex1);
          sprite.x = x * TILE_SIZE;
          sprite.y = y * TILE_SIZE;
          tilesLayer.addChild(sprite);
          const anim = tileAnims?.[g1.toString()];
          if (anim) animatedTiles.push({ sprite, frames: anim.frames, speed: anim.speed });
        } else {
          const blocked = (data.blocked[idx] ?? 0) === 1;
          const { base } = tileColors(g1, blocked);
          fallback.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill({ color: base });
        }
      }
    }

    for (let y = 0; y < data.height; y += 1) {
      for (let x = 0; x < data.width; x += 1) {
        const idx = y * data.width + x;

        // Capa 2: decoración de suelo (alfombras, bordes, detalles).
        const g2 = data.layer2[idx] ?? 0;
        if (g2) {
          const tex = tileset.get(g2);
          if (tex) {
            const sprite = placeAnchored(tex, x, y);
            tilesLayer.addChild(sprite);
            const anim = tileAnims?.[g2.toString()];
            if (anim) animatedTiles.push({ sprite, frames: anim.frames, speed: anim.speed });
          }
        }

        // Capa 3: objetos que ocluyen entidades (árboles, paredes, carteles).
        const g3 = data.layer3[idx] ?? 0;
        if (g3) {
          const tex = tileset.get(g3);
          if (tex) {
            const sprite = placeAnchored(tex, x, y);
            sprite.zIndex = (y + 1) * TILE_SIZE;
            entitiesLayer.addChild(sprite);
            mapObjectSprites.push(sprite);
            layer3ByTile.set(idx, sprite);
          }
        }

        // Capa 4: techos. Se atenúan cuando el jugador está bajo techo.
        const g4 = data.layer4[idx] ?? 0;
        if (g4) {
          const tex = tileset.get(g4);
          if (tex) roofLayer.addChild(placeAnchored(tex, x, y));
        }
      }
    }
  }

  async function renderTiles(data: MapData): Promise<void> {
    const token = ++mapRenderToken;
    mapWidth = data.width;
    mapHeight = data.height;
    // Copia mutable: las puertas cambian el bloqueo en vivo (MapTileUpdate).
    mapBlocked = [...data.blocked];
    mapTrigger = data.trigger;
    mapWater = data.graphic.map((g) => (isWaterGraphic(g) ? 1 : 0));

    await tilesetIndexReady;
    // Animaciones de tiles (mismo animaciones.json que usan los FX). Una sola vez.
    if (!tileAnims) {
      try {
        const res = await fetch("/ao-assets/animaciones.json", { cache: "force-cache" });
        if (res.ok) tileAnims = (await res.json()) as Record<string, { frames: number[]; speed: number }>;
      } catch {
        tileAnims = {};
      }
    }

    // Reunir los grh de las 4 capas (+ frames animados de suelo/decoración).
    const ids = new Set<number>();
    for (const g of data.graphic) if (g) ids.add(g);
    for (const g of data.layer2) if (g) ids.add(g);
    for (const g of data.layer3) if (g) ids.add(g);
    for (const g of data.layer4) if (g) ids.add(g);
    if (tileAnims) {
      for (const g of [...data.graphic, ...data.layer2]) {
        const anim = g ? tileAnims[g.toString()] : undefined;
        if (anim) for (const f of anim.frames) ids.add(f);
      }
    }

    // SIEMPRE (primer mapa Y cambios de mapa): esperar a que TODOS los atlas del
    // mapa estén cargados ANTES de dibujar. Así el mundo aparece completo y NUNCA
    // se ven los tiles en color de fallback ("pastel"). Durante la espera se ve
    // el mapa anterior + el flash de transición (no el fallback); los PNGs ya
    // visitados están en caché del browser (Cache-Control immutable) → instantáneo.
    if (tileset.ready && tileset.missingFileCount(ids) > 0) {
      if (!firstMapDrawn) {
        statusText.text = "Cargando el mundo...";
        statusText.style.fill = "#4cb87e";
        statusText.visible = true;
      } else {
        // Mantener el flash de transición encendido mientras carga el mapa nuevo.
        transitionFlash.visible = true;
        transitionFlash.alpha = 1;
        transitionFlashEnd = performance.now() + TRANSITION_FLASH_MS;
      }
      await tileset.preload(ids);
      if (token !== mapRenderToken) return; // cambió de mapa mientras cargaba
      // Reiniciar el flash tras la carga para que el fade arranque recién ahora
      // (si la carga tardó, el flash no quedó "consumido" antes de ver el mapa).
      if (firstMapDrawn) transitionFlashEnd = performance.now() + TRANSITION_FLASH_MS;
    }

    // Ya está todo el atlas cargado → dibujar el mapa completo (sin fallback).
    drawTiles(data);
    firstMapDrawn = true;
  }

  // Trigger 1/2/4 del .map original = "bajo techo": los techos se atenúan
  // para ver el interior (comportamiento del cliente AO clásico).
  function updateRoofVisibility(): void {
    if (mapWidth === 0) return;
    const own = entityVisuals.get(character.id);
    if (!own) return;
    const t = mapTrigger[own.position.y * mapWidth + own.position.x] ?? 0;
    const underRoof = t === 1 || t === 2 || t === 4;
    roofLayer.alpha = underRoof ? 0.15 : 1;
  }

  function renderEntities(data: MapData): void {
    // Sacamos solo los containers de entidades — los objetos de la capa 3
    // (árboles) también viven en entitiesLayer y los limpia renderTiles.
    for (const v of entityVisuals.values()) {
      entitiesLayer.removeChild(v.container);
      v.container.destroy({ children: true });
    }
    entityVisuals.clear();

    for (const ent of data.entities) {
      const entId = ent.id as unknown as number;
      const isSelf = entId === character.id;
      addEntity(entId, ent.position, ent.name, isSelf, ent.hp, ent.maxHp, ent.kind, ent.direction, ent.bodyId, ent.headId, ent.criminal ?? false, ent.faction ?? 0, ent.guild ?? null, ent.weaponAnim ?? 0, ent.shieldAnim ?? 0, ent.helmetAnim ?? 0, ent.role ?? 0, ent.level ?? 1, ent.classId ?? 1);
      if (ent.dead) applyDeadVisual(entId);
      if (ent.invisible) applyInvisibleVisual(entId);
      // Aura de meditación de quien YA estaba meditando al entrar al mapa.
      if (ent.meditating) handleMeditateUpdate({ op: ServerToClientOp.MeditateUpdate, id: ent.id, meditating: true });
    }
    updateSelfHud();
  }

  async function applyMapData(data: MapData): Promise<void> {
    const loadToken = ++mapLoadToken;
    mapLoading = true;
    playMapMusic(data.music ?? 0);
    const isTransition = currentMapId !== -1 && data.mapId !== currentMapId;
    currentMapId = data.mapId;

    if (isTransition) {
      // Reset de estado de input para que no queden teclas "pegadas"
      // ni predicciones pendientes al reconstruir la escena.
      keysHeld.length = 0;
      lastLocalMoveAt = 0;
      transitionFlash.visible = true;
      transitionFlash.alpha = 1;
      transitionFlashEnd = performance.now() + TRANSITION_FLASH_MS;
      audio.play(SND.warp, 0.7);
      chat?.appendMessage({ fromName: "", text: `Has llegado a ${data.name}.`, timestamp: Date.now(), isSelf: false, kind: "global" });
      // Floaters del mapa anterior (números de daño, etc.): fuera.
      for (const f of floaters) f.text.destroy();
      floaters.length = 0;
    }

    await renderTiles(data);
    // Si llegó un MapData más nuevo durante la carga (portales encadenados,
    // /telep doble), abortar: aplicar entidades/minimapa/nombre del mapa VIEJO
    // sobre los tiles del nuevo era el desync clásico.
    if (loadToken !== mapLoadToken) return;
    renderEntities(data);
    clearGroundItems();
    for (const gi of data.groundItems) {
      addGroundItemVisual(gi.id as unknown as number, gi.position, gi.item, gi.qty);
    }
    refreshPlayerList();
    statusText.visible = false;
    centerCameraOnSelf();

    // Minimapa: mapa nuevo → re-render del fondo + posición propia.
    minimap?.setMap({
      mapId: data.mapId,
      name: data.name,
      width: data.width,
      height: data.height,
      graphic: data.graphic,
      layer3: data.layer3,
      blocked: data.blocked,
    });
    // Ubicación actual (nombre + id de mapa) para el panel y el HUD.
    currentMapName = data.name;
    inventory?.setLocation(data.name);
    const ownV = entityVisuals.get(character.id);
    if (ownV) {
      minimap?.setPos(ownV.position.x, ownV.position.y);
      updateHudLocation(currentMapName, currentMapId, ownV.position.x, ownV.position.y);
    }

    // Fin de la carga: re-aplicar los paquetes bufferados sobre el mapa nuevo.
    // Cada uno en su try/catch: si uno falla (p. ej. un Respawn en el combo
    // muerto→viaje a la ciudad), NO debe cortar el replay y dejar sin aplicar el
    // InventoryUpdate/StatsUpdate que vienen después (paneles vacíos al revivir).
    mapLoading = false;
    for (const p of packetsWhileLoading.splice(0)) {
      try {
        handlePacket(p);
      } catch (err) {
        console.error("[ao-client] error re-aplicando paquete bufferado", p.op, err);
      }
    }
  }
  let currentMapName = "";

  // Bodies de barco (para saber si estamos navegando por el body visible).
  const BOAT_BODIES = new Set(
    Object.values(ITEMS)
      .filter((d) => d.objType === 31 && (d.bodyId ?? 0) > 0)
      .map((d) => d.bodyId!),
  );

  // Lookup local de walkability — para la prediccion optimista.
  // Coincide con la verdad del server: bloqueado no; agua solo navegando;
  // tierra solo a pie.
  function isWalkableLocal(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return false;
    const idx = y * mapWidth + x;
    if (mapBlocked[idx] !== 0) return false;
    const own = entityVisuals.get(character.id);
    const navigating = own !== undefined && BOAT_BODIES.has(own.bodyId);
    return (mapWater[idx] === 1) === navigating;
  }

  // -- Movimiento y combate --
  let client: ReconnectingClient | null = null;
  let chat: ChatHandle | null = null;
  let playerList: PlayerListHandle | null = null;
  let touchControls: TouchControlsHandle | null = null;
  let inventory: InventoryHandle | null = null;
  let shop: ShopHandle | null = null;
  let bank: BankHandle | null = null;
  let partyUi: PartyUiHandle | null = null;
  let tradeUi: TradeHandle | null = null;
  let statsPanel: StatsPanelHandle | null = null;
  let macroBar: MacroBarHandle | null = null;
  // Estado que alimenta el selector de macros (usar/equipar/hechizo).
  let macroInventory: ReadonlyArray<{ item: number; qty: number }> = [];
  let macroSpellIds: ReadonlyArray<number> = [];
  let keyConfig: KeyConfigHandle | null = null;
  let minimap: MinimapHandle | null = null;
  let worldMap: WorldMapHandle | null = null;
  let craftUi: CraftHandle | null = null;
  let questsUi: QuestsHandle | null = null;
  // Herramienta armada (modo trabajo): click en el tile objetivo.
  let armedTool: number | null = null;
  let classSkillId = 0; // ID de la skill del personaje (0 = sin skill conocida)
  // Hechizo del libro seleccionado para lanzar (click en objetivo = cast).
  let selectedSpellId: number | null = null;
  // Último objeto del inventario clickeado (para la tecla "Usar / Equipar").
  let lastSelectedItem: number | null = null;
  // Teclas configurables (panel ⚙). Las flechas siempre mueven.
  let keymap: Keymap = loadKeymap();
  // Nivel actual del personaje (para detectar subidas reales, no el StatsUpdate
  // inicial del login).
  let prevLevel = character.level;
  let lastLocalMoveAt = 0;
  let moveSequence = 0;
  // Alternador de sonido de pasos (23/24 como el cliente original).
  let stepToggle = false;
  // Orden de pulsación: la última dirección presionada manda (flow del AO).
  const keysHeld: string[] = [];
  // Direccion a la que mira el personaje (define a quien golpea el ataque).
  let selfFacing: Direction = "south";
  let lastLocalAttackAt = 0;
  // Cooldowns de ataque SINCRONIZADOS con el server (panel admin). Arrancan en el
  // fallback local y se actualizan al recibir GameConfig (login + cada cambio del
  // admin). Así el tempo del golpe/flecha refleja el intervalo del panel en vivo.
  let serverMeleeMs = ATTACK_COOLDOWN_MS;
  let serverArrowMs = 1400;
  const floaters: Floater[] = [];

  function tryStep(direction: Direction): void {
    if (!client) return;
    const now = performance.now();
    // Paralizado/inmovilizado: no hay predicción local de movimiento.
    if (selfParalyzedUntil > now || selfImmobilizedUntil > now) return;
    const own = entityVisuals.get(character.id);
    // Los muertos SÍ caminan (fantasma del AO — para llegar al sacerdote).
    if (!own) return;

    // El giro se aplica JUNTO con el paso (más abajo) para que el sprite no
    // mire la nueva dirección ANTES de moverse (ese era el parpadeo). Excepción:
    // si estamos QUIETOS giramos en el acto (turn-in-place responsivo; ahí no
    // hay parpadeo porque no nos estamos deslizando a otra dirección).
    selfFacing = direction;
    const midStep = own.tweenDuration > 0 && now - own.tweenStart < own.tweenDuration;
    if (!midStep) setEntityFacing(own, direction);

    // El PASO respeta el cooldown.
    if (now - lastLocalMoveAt < MOVE_COOLDOWN_MS) return;

    const delta = DELTAS[direction];
    const target: Vector2 = {
      x: own.position.x + delta.x,
      y: own.position.y + delta.y,
    };
    // Predicado optimista: si localmente sabemos que esta bloqueado,
    // no mandamos paquete. Si lo dejamos pasar, el server nos rebotaria
    // con un EntityUpdate de correccion — funciona pero gasta.
    if (!isWalkableLocal(target.x, target.y)) return;

    lastLocalMoveAt = now;
    moveSequence += 1;

    // Pasos alternados del AO (WAV 23/24).
    stepToggle = !stepToggle;
    audio.play(stepToggle ? SND.paso1 : SND.paso2, 0.7);

    // El giro coincide con el paso real (evita el parpadeo de dirección al
    // cambiar de rumbo mientras se camina).
    setEntityFacing(own, direction);
    // Prediccion: movemos el sprite YA (sin esperar el ACK).
    moveEntityTo(character.id, target);

    const packet: MoveRequest = {
      op: ClientToServerOp.Move,
      direction,
      sequence: moveSequence,
    };
    client.send(packet);
  }

  function playSwing(v: EntityVisual, dir: Direction): void {
    // Girar el sprite hacia donde se efectúa el golpe (antes solo hacía el
    // lunge y la entidad quedaba mirando su dirección anterior).
    setEntityFacing(v, dir);
    const delta = DELTAS[dir];
    v.swingStart = performance.now();
    v.swingDx = delta.x;
    v.swingDy = delta.y;
  }

  function tryAttack(): void {
    if (!client) return;
    const now = performance.now();
    // Paralizado no pega (sí puede castear Remover Parálisis).
    if (selfParalyzedUntil > now) return;
    if (now - lastLocalAttackAt < (selfWeaponRanged ? serverArrowMs : serverMeleeMs)) return;
    const own = entityVisuals.get(character.id);
    if (!own || own.dead) return;

    // Arco: sin flecha cargada, la tecla CARGA (aparece la cruz). Con la
    // flecha cargada, dispara al primer objetivo en línea recta y descarga.
    if (selfWeaponRanged) {
      if (!armedArrow) { nockArrow(); return; }
      const delta = DELTAS[selfFacing];
      let targetId: number | null = null;
      for (let step = 1; step <= 10 && targetId === null; step += 1) {
        const tx = own.position.x + delta.x * step;
        const ty = own.position.y + delta.y * step;
        for (const [id, v] of entityVisuals) {
          if (id === character.id || v.dead) continue;
          if (v.kind === "merchant" || v.kind === "banker") continue;
          if (v.position.x === tx && v.position.y === ty) { targetId = id; break; }
        }
      }
      if (targetId === null) return; // sin objetivo en línea: la cruz sigue
      lastLocalAttackAt = now;
      playSwing(own, selfFacing);
      client.send({ op: ClientToServerOp.Attack, targetId: targetId as unknown as EntityId } satisfies AttackRequest);
      setArmedArrow(false); // se gastó la flecha → descargar
      return;
    }

    lastLocalAttackAt = now;
    // Feedback inmediato: el swing siempre se anima Y SUENA, haya o no
    // objetivo (el AO reproduce SND_SWING también al golpe al aire).
    playSwing(own, selfFacing);
    audio.play(SND.swing, 0.8);

    // Melee: objetivo vivo en el tile adyacente del frente.
    const delta = DELTAS[selfFacing];
    const tx = own.position.x + delta.x;
    const ty = own.position.y + delta.y;
    let targetId: number | null = null;
    for (const [id, v] of entityVisuals) {
      if (id === character.id || v.dead) continue;
      if (v.kind === "merchant" || v.kind === "banker") continue;
      if (v.position.x === tx && v.position.y === ty) { targetId = id; break; }
    }
    if (targetId === null) return;

    const packet: AttackRequest = {
      op: ClientToServerOp.Attack,
      targetId: targetId as unknown as EntityId,
    };
    client.send(packet);
  }

  // Lanza el hechizo armado sobre targetId. Devuelve true si el click se
  // consumió como casteo. ONE-SHOT como el AO clásico: después de lanzar,
  // el modo se desarma — hay que volver a «Lanzar» (o macro) para repetir.
  function castSelectedSpell(targetId: number): boolean {
    if (selectedSpellId === null || !client) return false;
    const pkt: CastSpellRequest = {
      op: ClientToServerOp.CastSpell,
      spellId: selectedSpellId,
      targetId: targetId as unknown as EntityId,
    };
    client.send(pkt);
    // Desarmar (la selección de la lista queda para re-lanzar rápido).
    setArmedSpell(null);
    return true;
  }

  // Clic sobre una entidad: si es comerciante, abrimos la tienda; si no,
  // atacamos (solo si es adyacente). Giramos hacia el objetivo.
  function clickAttack(targetId: number): void {
    if (!client) return;
    const target = entityVisuals.get(targetId);
    if (!target) return;

    if (target.kind === "merchant" || target.kind === "banker") {
      const interact: InteractRequest = {
        op: ClientToServerOp.Interact,
        targetId: targetId as unknown as EntityId,
      };
      client.send(interact);
      return;
    }

    // Con arco equipado SOLO se dispara con la flecha cargada (doble-click en el
    // arco, tecla Usar, o macro). Un click "pelado" sobre un objetivo NO ataca:
    // la única vía de disparo es la cruz (armedArrow), que el caller pone antes.
    if (selfWeaponRanged && !armedArrow) return;

    const now = performance.now();
    if (now - lastLocalAttackAt < (selfWeaponRanged ? serverArrowMs : serverMeleeMs)) return;
    const own = entityVisuals.get(character.id);
    if (!own || own.dead || target.dead) return;
    const dx = target.position.x - own.position.x;
    const dy = target.position.y - own.position.y;
    // Con arco: hasta 10 tiles (mismo alcance que un hechizo). Melee: adyacente.
    if (selfWeaponRanged) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 10) return;
    } else if (Math.abs(dx) + Math.abs(dy) !== 1) {
      return; // no adyacente
    }

    selfFacing =
      Math.abs(dx) >= Math.abs(dy)
        ? (dx >= 0 ? "east" : "west")
        : (dy >= 0 ? "south" : "north");
    lastLocalAttackAt = now;
    playSwing(own, selfFacing);

    const packet: AttackRequest = {
      op: ClientToServerOp.Attack,
      targetId: targetId as unknown as EntityId,
    };
    client.send(packet);
  }

  // Al hacer click izquierdo en una criatura, escupe su nombre y vida
  // actual/total al chat global. La vida sale del visual, que el server mantiene
  // al día vía los paquetes de daño/respawn → siempre el valor real.
  function announceNpcVida(v: EntityVisual): void {
    const hp = Math.max(0, Math.round(v.hp));
    const maxHp = Math.max(hp, Math.round(v.maxHp));
    chat?.appendMessage({
      fromName: "",
      text: `${v.name} (Vida: ${hp.toString()}/${maxHp.toString()})`,
      timestamp: Date.now(),
      isSelf: false,
      kind: "global",
    });
  }

  function spawnFloater(x: number, y: number, label: string, color: string): void {
    const text = new Text({
      text: label,
      resolution: WORLD_SCALE * (window.devicePixelRatio || 1),
      style: new TextStyle({
        fill: color,
        fontFamily: "Consolas, monospace",
        fontSize: 14,
        fontWeight: "bold",
        stroke: { color: "#0a0805", width: 3 },
      }),
    });
    text.anchor.set(0.5, 1);
    text.x = x;
    text.y = y - 18;
    // Siempre por encima de árboles y entidades en el y-sort.
    text.zIndex = 1_000_000;
    entitiesLayer.addChild(text);
    floaters.push({ text, startY: text.y, start: performance.now() });
  }

  // Dirección para un event.code: flechas fijas + teclas configurables.
  function codeToDirection(code: string): Direction | null {
    const arrow = ARROW_TO_DIRECTION[code];
    if (arrow) return arrow;
    if (code === keymap.north) return "north";
    if (code === keymap.south) return "south";
    if (code === keymap.west) return "west";
    if (code === keymap.east) return "east";
    return null;
  }

  function pumpHeldKeys(): void {
    // Prioridad del AO: gana la ÚLTIMA tecla de dirección presionada que
    // siga apretada (keysHeld es un array en orden de pulsación).
    for (let i = keysHeld.length - 1; i >= 0; i -= 1) {
      const dir = codeToDirection(keysHeld[i]!);
      if (dir) {
        tryStep(dir);
        return;
      }
    }
  }

  // Cartel de modo casteo: visible SOLO mientras hay un hechizo armado.
  const castBanner = document.createElement("div");
  castBanner.className = "ao-castbanner";
  viewportBox.appendChild(castBanner);

  // Flecha "cargada" (modo apuntar del arco): cursor de cruz + cartel; el
  // próximo click sobre un objetivo dispara. Se carga con la tecla de atacar,
  // o con U/doble-click sobre las flechas.
  let armedArrow = false;
  function setArmedArrow(on: boolean): void {
    armedArrow = on;
    if (on) {
      selectedSpellId = null;
      armedTool = null;
    }
    app.canvas.style.cursor = on ? "crosshair" : "default";
    app.renderer.events.cursorStyles.pointer = on ? "crosshair" : "pointer";
    viewportBox.classList.toggle("ao-casting", on || selectedSpellId !== null || armedTool !== null);
    if (on) {
      castBanner.textContent = "🏹 Flecha cargada — click para disparar · Esc cancela";
      castBanner.classList.add("ao-castbanner--on");
    } else if (selectedSpellId === null && armedTool === null) {
      castBanner.classList.remove("ao-castbanner--on");
    }
  }

  // Único punto que arma/desarma el casteo: cursor + cartel + estado.
  function setArmedSpell(spellId: number | null): void {
    selectedSpellId = spellId;
    if (spellId !== null) {
      armedTool = null;
      armedArrow = false;
    }
    app.canvas.style.cursor = spellId !== null ? "crosshair" : "default";
    app.renderer.events.cursorStyles.pointer = spellId !== null ? "crosshair" : "pointer";
    // Fuerza la cruz por CSS (!important) mientras se apunta: le gana a cualquier
    // cursor inline que PixiJS setee al pasar el mouse sobre entidades/targets.
    // Es el método robusto: evita que "desaparezca la cruz" sobre un objetivo.
    viewportBox.classList.toggle("ao-casting", spellId !== null || armedTool !== null || armedArrow);
    if (spellId !== null) {
      const spell = getAoSpell(spellId);
      castBanner.textContent = `⚡ Lanzando ${spell?.name ?? "hechizo"} — click en el objetivo · Esc cancela`;
      castBanner.classList.add("ao-castbanner--on");
    } else {
      castBanner.classList.remove("ao-castbanner--on");
    }
  }

  // Modo trabajo: herramienta armada → click en el tile (árbol/agua/roca).
  const TOOL_KIND: Record<number, string> = {
    127: "árbol", 561: "árbol", 1005: "árbol élfico",
    187: "yacimiento", 562: "yacimiento",
    138: "agua", 563: "agua", 543: "agua",
  };

  // Acción USAR del AO (UseInvItem): pociones/comida/bebida, barcos, monturas,
  // llaves… Las herramientas arman el modo de trabajo y martillo/serrucho
  // abren su ventana de crafteo. La comparte el doble-click y la tecla Usar.
  function useItemAction(item: number): void {
    if (item in TOOL_KIND) {
      setArmedTool(item);
      return;
    }
    if (item === 389 || item === 565) {
      craftUi?.open("herreria");
      return;
    }
    if (item === 198 || item === 564) {
      craftUi?.open("carpinteria");
      return;
    }
    client?.send({ op: ClientToServerOp.UseItem, item } satisfies UseItemRequest);
  }

  // Tipos que corresponden a EQUIPAR (EquipInvItem del AO), no a Usar. Las
  // flechas se "equipan" (elegir munición → tilde verde ✓).
  const EQUIP_TYPES = new Set(["weapon", "armor", "helmet", "shield", "arrow"]);

  function setArmedTool(item: number | null): void {
    armedTool = item;
    if (item !== null) {
      selectedSpellId = null;
      armedArrow = false;
    }
    app.canvas.style.cursor = item !== null ? "crosshair" : "default";
    app.renderer.events.cursorStyles.pointer = item !== null ? "crosshair" : "pointer";
    // Igual que el casteo: fuerza la cruz por CSS mientras la herramienta está armada.
    viewportBox.classList.toggle("ao-casting", selectedSpellId !== null || item !== null || armedArrow);
    if (item !== null) {
      castBanner.textContent = `🪓 Trabajando — click en el ${TOOL_KIND[item] ?? "objetivo"} · Esc cancela`;
      castBanner.classList.add("ao-castbanner--on");
    } else if (selectedSpellId === null) {
      castBanner.classList.remove("ao-castbanner--on");
    }
  }

  function clearSpellSelection(): void {
    setArmedSpell(null);
    setArmedTool(null);
    setArmedArrow(false); // Esc descarga la flecha
    inventory?.clearSpellSelection();
  }

  // Entidad viva parada en un tile (para castear por tile, no por píxel).
  // Prioriza otras entidades sobre uno mismo (hechizos de ataque).
  function entityAtTile(tx: number, ty: number): number | null {
    let selfHit: number | null = null;
    for (const [id, v] of entityVisuals) {
      if (v.position.x !== tx || v.position.y !== ty || v.dead) continue;
      if (id === character.id) { selfHit = id; continue; }
      return id;
    }
    return selfHit;
  }

  // Entidad cuyo SPRITE cubre el punto clickeado (en píxeles del mundo). El
  // hit-testing por-sprite de Pixi no es fiable en esta escena (cámara escalada
  // + y-sort), así que lo hacemos a mano: el sprite se ancla en los pies y sube
  // ~1.75 tiles, ~1 tile de ancho. Prioriza a los demás sobre uno mismo y, entre
  // varios, al del frente (mayor Y de pies = dibujado encima).
  function entityAtWorldPoint(wx: number, wy: number): number | null {
    let best: number | null = null;
    let bestFeetY = -Infinity;
    let selfHit: number | null = null;
    let selfFeetY = -Infinity;
    for (const [id, v] of entityVisuals) {
      if (v.dead) continue;
      const fx = v.position.x * TILE_SIZE + TILE_SIZE / 2;
      const fy = v.position.y * TILE_SIZE + TILE_SIZE / 2;
      if (wx < fx - 18 || wx > fx + 18 || wy < fy - 56 || wy > fy + 10) continue;
      if (id === character.id) {
        if (fy > selfFeetY) { selfHit = id; selfFeetY = fy; }
      } else if (fy > bestFeetY) {
        best = id;
        bestFeetY = fy;
      }
    }
    return best ?? selfHit;
  }

  // Como entityAtWorldPoint pero SOLO criaturas (kind "npc"). Se usa al disparar
  // con el arco: si hay una criatura bajo el click, se le tira a ELLA aunque otro
  // jugador esté encima peleándola (así el cazador nunca queda "sin poder pegarle").
  function npcAtWorldPoint(wx: number, wy: number): number | null {
    let best: number | null = null;
    let bestFeetY = -Infinity;
    for (const [id, v] of entityVisuals) {
      if (v.dead || v.kind !== "npc") continue;
      const fx = v.position.x * TILE_SIZE + TILE_SIZE / 2;
      const fy = v.position.y * TILE_SIZE + TILE_SIZE / 2;
      if (wx < fx - 18 || wx > fx + 18 || wy < fy - 56 || wy > fy + 10) continue;
      if (fy > bestFeetY) { best = id; bestFeetY = fy; }
    }
    return best;
  }

  // Estado para detectar doble-click (accionar puertas/carteles como el AO).
  let lastTapAt = 0;
  let lastTapX = -1;
  let lastTapY = -1;

  // Click en el mundo: con hechizo armado castea sobre la entidad del tile
  // clickeado (tolerante al píxel, como el AO); con herramienta, trabaja.
  const onStagePointerDown = (
    e: { global: { x: number; y: number }; target: unknown; altKey?: boolean; shiftKey?: boolean; button?: number },
  ): void => {
    if (!client) return;
    if (e.button !== undefined && e.button !== 0) return; // solo click izquierdo
    const wx = (e.global.x - world.x) / WORLD_SCALE;
    const wy = (e.global.y - world.y) / WORLD_SCALE;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) return;

    // Flecha cargada (cruz): el click la dispara. Sobre un objetivo → daño +
    // gasta flecha; sobre el piso vacío → la flecha cae al suelo y se gasta.
    // En ambos casos la cruz DESAPARECE (hay que recargar).
    if (armedArrow) {
      // Prioridad a la criatura bajo el click (aunque haya un jugador encima),
      // luego cualquier entidad, luego la entidad del tile exacto.
      const entId = npcAtWorldPoint(wx, wy) ?? entityAtWorldPoint(wx, wy) ?? entityAtTile(tx, ty);
      const v = entId !== null ? entityVisuals.get(entId) : undefined;
      if (v && (v.kind === "merchant" || v.kind === "banker")) {
        clickAttack(entId!); // interactuar (comerciante/banquero): no dispara
        return;
      }
      if (entId !== null && v && entId !== character.id && !v.dead) {
        if (v.kind === "npc") announceNpcVida(v); // nombre + vida al chat
        clickAttack(entId); // dispara al objetivo (server gasta la flecha)
      } else {
        // Piso vacío: la flecha se lanza y cae al suelo (se gasta).
        client.send({ op: ClientToServerOp.ShootGround, x: tx, y: ty } satisfies ShootGroundRequest);
      }
      setArmedArrow(false);
      return;
    }

    // Hechizo armado: castea sobre la entidad clickeada (por sprite; si no,
    // por tile). One-shot como el AO.
    if (selectedSpellId !== null) {
      const targetId = entityAtWorldPoint(wx, wy) ?? entityAtTile(tx, ty);
      if (targetId !== null) castSelectedSpell(targetId);
      return;
    }

    // Herramienta armada: trabajar en el tile (árbol/agua/roca).
    if (armedTool !== null) {
      const pkt: WorkRequest = { op: ClientToServerOp.Work, item: armedTool, x: tx, y: ty };
      client.send(pkt);
      return;
    }

    // Sin nada armado: ¿se clickeó una entidad? → interactuar. Comerciante abre
    // tienda, banquero abre banco, sacerdote revive/cura, otros: atacar.
    // Alt+clic = invitar a party; Shift+clic = proponer trade (solo jugadores).
    const entId = entityAtWorldPoint(wx, wy);
    if (entId !== null) {
      const v = entityVisuals.get(entId);
      if (v) {
        const isOther = entId !== character.id;
        if (isOther && e.altKey && v.kind === "player") {
          const pkt: PartyInviteRequest = { op: ClientToServerOp.PartyInvite, targetId: entId as unknown as EntityId };
          client.send(pkt);
        } else if (isOther && e.shiftKey && v.kind === "player") {
          const pkt: TradeRequestMsg = { op: ClientToServerOp.TradeRequest, targetId: entId as unknown as EntityId };
          client.send(pkt);
        } else if (v.kind === "player") {
          // Click sobre un personaje (propio u otro): ver su info en el chat.
          const pkt: PlayerInfoRequest = { op: ClientToServerOp.PlayerInfo, targetId: entId as unknown as EntityId };
          client.send(pkt);
        } else if (isOther) {
          if (v.kind === "npc") announceNpcVida(v); // nombre + vida al chat
          clickAttack(entId);
        }
        return;
      }
    }

    // Item en el suelo: click muestra su nombre en el chat (ya no hay cartel).
    const ground = groundItemAtTile(tx, ty);
    if (ground !== null) {
      const def = getItem(ground.item);
      const name = def ? def.name : `#${ground.item.toString()}`;
      const text = ground.qty > 1 ? `Ves ${name} (x${ground.qty.toString()}).` : `Ves ${name}.`;
      chat?.appendMessage({ fromName: "", text, timestamp: Date.now(), isSelf: false, kind: "global" });
      return;
    }

    // Shift-click de GM sobre zona vacía: teletransportarse a ese tile (mover
    // por el mapa). Reusa el comando /telep; el server lo valida (sólo role > 0).
    if (e.shiftKey && (entityVisuals.get(character.id)?.role ?? 0) > 0) {
      const pkt: ChatSend = { op: ClientToServerOp.ChatSend, text: `/telep ${currentMapId.toString()} ${tx.toString()} ${ty.toString()}` };
      client.send(pkt);
      return;
    }

    // Zona vacía: doble-click acciona la puerta/cartel del tile (el AO clásico
    // abre puertas con doble-click). Mismo efecto que el click derecho.
    const now = performance.now();
    if (now - lastTapAt < 350 && lastTapX === tx && lastTapY === ty) {
      lastTapAt = 0;
      const pkt: InteractRequest = {
        op: ClientToServerOp.Interact,
        targetId: 0 as EntityId,
        tile: { x: tx, y: ty },
      };
      client.send(pkt);
      return;
    }
    lastTapAt = now;
    lastTapX = tx;
    lastTapY = ty;
  };

  const onStageRightDown = (e: { global: { x: number; y: number } }): void => {
    if (!client) return;
    const wx = (e.global.x - world.x) / WORLD_SCALE;
    const wy = (e.global.y - world.y) / WORLD_SCALE;
    // Click derecho: detalle (exp, oro, drops) SOLO de criaturas (kind "npc").
    // Comerciantes/banqueros y personajes no muestran este detalle.
    const entId = entityAtWorldPoint(wx, wy);
    if (entId !== null && entId !== character.id) {
      const v = entityVisuals.get(entId);
      if (v && v.kind === "npc") {
        const pkt: NpcInfoRequest = { op: ClientToServerOp.NpcInfo, targetId: entId as EntityId };
        client.send(pkt);
        return;
      }
    }
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) return;
    const pkt: InteractRequest = {
      op: ClientToServerOp.Interact,
      targetId: 0 as EntityId,
      tile: { x: tx, y: ty },
    };
    client.send(pkt);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    // Si el chat tiene foco, dejamos que el input se quede con todas
    // las teclas — no movemos al personaje ni capturamos nada.
    if (chat?.isInputFocused()) return;
    // El panel de configuración captura teclas propias.
    if (keyConfig?.isOpen()) return;

    // Escape: cerrar el mapa-mundi si está abierto; si no, deseleccionar hechizo.
    if (e.code === "Escape") {
      if (worldMap?.isOpen()) worldMap.close();
      else clearSpellSelection();
      return;
    }
    // Ataque (configurable; Ctrl derecho siempre funciona como alias).
    if (e.code === keymap.attack || e.code === "ControlRight") {
      e.preventDefault();
      tryAttack();
      return;
    }
    if (e.code === keymap.pickup) {
      e.preventDefault();
      const pickup: PickupRequest = { op: ClientToServerOp.Pickup };
      client?.send(pickup);
      return;
    }
    if (e.code === keymap.inventory) {
      e.preventDefault();
      inventory?.toggle();
      return;
    }
    if (e.code === "KeyB") {
      e.preventDefault();
      if (bank?.isOpen()) bank.close();
      // Si está cerrado, el servidor lo abre al interactuar con el banquero.
      return;
    }
    if (e.code === keymap.stats) {
      e.preventDefault();
      const panel = root.querySelector<HTMLElement>(".ao-stats-panel");
      if (panel) panel.classList.toggle("ao-stats-panel--open");
      return;
    }
    // Meditar (recupera maná acelerado; se corta al moverse/atacar).
    if (e.code === keymap.meditate) {
      e.preventDefault();
      const pkt: MeditateToggle = { op: ClientToServerOp.Meditate };
      client?.send(pkt);
      return;
    }
    // Descansar junto a una fogata (toggle).
    if (e.code === keymap.rest) {
      e.preventDefault();
      const pkt: RestToggle = { op: ClientToServerOp.Rest };
      client?.send(pkt);
      return;
    }
    // Ocultarse (skill del AO).
    if (e.code === keymap.hide) {
      e.preventDefault();
      client?.send({ op: ClientToServerOp.Hide });
      return;
    }
    // USAR objeto (U, UseInvItem del AO): pociones, comida, bebida, barcos,
    // herramientas… y el ARCO (usarlo = cargar una flecha). El resto del
    // equipo NO se "usa" (se equipa con E).
    if (e.code === keymap.use) {
      e.preventDefault();
      if (lastSelectedItem !== null) {
        const def = getItem(lastSelectedItem);
        if (def?.type === "weapon" && def.ranged) {
          // Arco: "usar" = cargar flecha (si está equipado).
          if (selfEquippedWeapon === lastSelectedItem) nockArrow();
          else chat?.appendMessage({ fromName: "", text: "Equipá el arco (E) antes de cargar una flecha.", timestamp: Date.now(), isSelf: false, kind: "combate" });
        } else if (def && !EQUIP_TYPES.has(def.type)) {
          useItemAction(lastSelectedItem);
        }
      }
      return;
    }
    // EQUIPAR objeto (E, EquipInvItem del AO): solo arma/armadura/casco/escudo
    // (toggle: sobre el ya equipado, desequipa).
    if (e.code === keymap.equip) {
      e.preventDefault();
      if (lastSelectedItem !== null) {
        const def = getItem(lastSelectedItem);
        if (def && EQUIP_TYPES.has(def.type)) {
          client?.send({ op: ClientToServerOp.UseItem, item: lastSelectedItem } satisfies UseItemRequest);
        }
      }
      return;
    }
    if (e.code === keymap.drop) {
      e.preventDefault();
      inventory?.dropSelected(); // tira el objeto seleccionado del inventario
      return;
    }
    const dir = codeToDirection(e.code);
    if (!dir) return;
    e.preventDefault();
    // Re-pulsación: mover al final (la última presionada manda).
    holdKey(e.code);
    tryStep(dir);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    releaseKey(e.code);
  };

  function holdKey(code: string): void {
    const i = keysHeld.indexOf(code);
    if (i !== -1) keysHeld.splice(i, 1);
    keysHeld.push(code);
  }
  function releaseKey(code: string): void {
    const i = keysHeld.indexOf(code);
    if (i !== -1) keysHeld.splice(i, 1);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ── Música del mapa (MP3 oficiales del AO Libre — MusicNumMp3) ─────────
  let musicEl: HTMLAudioElement | null = null;
  let currentMusic = -1;
  function playMapMusic(music: number): void {
    if (music === currentMusic) return;
    currentMusic = music;
    if (musicEl) {
      musicEl.pause();
      musicEl = null;
    }
    if (music <= 0) return;
    const el = new Audio(`/ao-assets/mp3/${music.toString()}.mp3`);
    el.loop = true;
    el.volume = audio.musicVol;
    musicEl = el;
    // Si el autoplay está bloqueado, el unlock del primer gesto la arranca.
    if (audio.musicOn) void el.play().catch(() => undefined);
  }

  // ── Lluvia global (/LLUVIA de GM — overlay + loop lluviaout.wav) ───────
  let rainEl: HTMLDivElement | null = null;
  let rainAudio: HTMLAudioElement | null = null;
  function setRaining(raining: boolean): void {
    if (raining && !rainEl) {
      rainEl = document.createElement("div");
      rainEl.className = "ao-rain";
      stageEl.appendChild(rainEl); // solo sobre el mundo, no sobre la UI
      rainAudio = new Audio("/ao-assets/wav/lluviaout.wav");
      rainAudio.loop = true;
      rainAudio.volume = audio.volume;
      if (audio.sfxOn) void rainAudio.play().catch(() => undefined);
      chat?.appendMessage({ fromName: "", text: "Comienza a llover.", timestamp: Date.now(), isSelf: false, kind: "normal" });
    } else if (!raining && rainEl) {
      rainEl.remove();
      rainEl = null;
      rainAudio?.pause();
      rainAudio = null;
      chat?.appendMessage({ fromName: "", text: "Deja de llover.", timestamp: Date.now(), isSelf: false, kind: "normal" });
    }
  }

  // Aplica los settings de audio (config) a la música y la lluvia en vivo.
  function applyAudioSettings(): void {
    if (musicEl) {
      musicEl.volume = audio.musicVol;
      if (audio.musicOn) void musicEl.play().catch(() => undefined);
      else musicEl.pause();
    }
    if (rainAudio) {
      rainAudio.volume = audio.volume;
      if (!audio.sfxOn) rainAudio.pause();
      else if (rainAudio.paused) void rainAudio.play().catch(() => undefined);
    }
  }
  audio.onChange = applyAudioSettings;

  // Los navegadores bloquean el audio hasta el primer gesto del usuario.
  const unlockAudio = (): void => {
    audio.unlock();
    // Reintentar música/lluvia que el autoplay haya bloqueado.
    if (musicEl && musicEl.paused) void musicEl.play().catch(() => undefined);
    if (rainAudio && rainAudio.paused) void rainAudio.play().catch(() => undefined);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("pointerdown", unlockAudio);
  };
  window.addEventListener("keydown", unlockAudio);
  window.addEventListener("pointerdown", unlockAudio);

  // -- Ticker: interpolacion + pump de teclas mantenidas --
  const tick = (): void => {
    const now = performance.now();
    // Tiles animados (agua/lava): frame = reloj global → todas las celdas
    // del mismo GRH quedan en fase, igual que el TileEngine del AO.
    for (const at of animatedTiles) {
      const n = at.frames.length;
      const idx = Math.floor((now * n) / at.speed) % n;
      const tex = tileset.get(at.frames[idx]!);
      if (tex && at.sprite.texture !== tex) at.sprite.texture = tex;
    }
    for (const v of entityVisuals.values()) {
      if (v.tweenDuration > 0) {
        const t = Math.min(1, (now - v.tweenStart) / v.tweenDuration);
        const targetPx = entityCenterPx(v.position);
        v.renderX = v.tweenFromX + (targetPx.x - v.tweenFromX) * t;
        v.renderY = v.tweenFromY + (targetPx.y - v.tweenFromY) * t;
        if (t >= 1) v.tweenDuration = 0;
        // Walk cycle: mientras la entidad se está trasladando avanzamos
        // el frame del cuerpo cada WALK_FRAME_MS. Cuando el tween termina,
        // el else de abajo lo devuelve a idle (frame 0).
        if (v.bodySprite && now - v.lastFrameAt >= WALK_FRAME_MS) {
          v.walkFrame += 1;
          v.lastFrameAt = now;
          refreshCharTextures(v);
        }
      } else if (v.bodySprite && v.walkFrame !== 0) {
        // Idle: reset al primer frame para que quede parado con pose base.
        v.walkFrame = 0;
        refreshCharTextures(v);
      }
      // Swing de ataque: SOLO el arma hace el movimiento hacia el objetivo —
      // el personaje queda quieto (pedido del usuario: sin lunge del cuerpo).
      let ox = 0;
      let oy = 0;
      if (v.swingStart > 0) {
        const st = (now - v.swingStart) / SWING_DURATION_MS;
        if (st >= 1) {
          v.swingStart = 0;
        } else {
          const k = Math.sin(st * Math.PI) * 10;
          ox = v.swingDx * k;
          oy = v.swingDy * k;
        }
      }
      v.container.x = v.renderX;
      v.container.y = v.renderY;
      if (v.weaponSprite) {
        // Delta contra lo ya aplicado: no acumula error y vuelve solo a 0.
        v.weaponSprite.x += ox - v.swingAppliedX;
        v.weaponSprite.y += oy - v.swingAppliedY;
      }
      v.swingAppliedX = ox;
      v.swingAppliedY = oy;
      // y-sort: el zIndex por Y decide la oclusión con los árboles/paredes
      // de la capa 3 (que usan el pie del objeto como zIndex).
      v.container.zIndex = v.renderY + TILE_SIZE / 2;
      // Expirar la barra de HP flotante (solo se ve unos segundos tras daño).
      if (v.hpBarUntil > 0 && now >= v.hpBarUntil) {
        v.hpBar.visible = false;
        v.hpBarUntil = 0;
      }
      // Expirar el habla sobre la cabeza.
      if (v.overheadText && now >= v.overheadUntil) {
        v.container.removeChild(v.overheadText);
        v.overheadText.destroy({ children: true });
        v.overheadText = null;
      }
    }
    // Numeros de daño flotantes: suben y se desvanecen, luego se destruyen.
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      if (!f) continue;
      const t = (now - f.start) / FLOATER_DURATION_MS;
      if (t >= 1) {
        entitiesLayer.removeChild(f.text);
        f.text.destroy();
        floaters.splice(i, 1);
        continue;
      }
      f.text.y = f.startY - 24 * t;
      f.text.alpha = 1 - t;
    }
    // Fade-out del flash de transición de mapa.
    if (transitionFlash.visible) {
      const remaining = transitionFlashEnd - now;
      if (remaining <= 0) {
        transitionFlash.visible = false;
        transitionFlash.alpha = 0;
      } else {
        transitionFlash.alpha = remaining / TRANSITION_FLASH_MS;
      }
    }

    fxPlayer.update(now);
    pumpHeldKeys();
    if (mapWidth > 0) {
      centerCameraOnSelf();
      updateRoofVisibility();
      // Punto del jugador en el minimapa (no-op si no cambió de tile).
      const ownV = entityVisuals.get(character.id);
      if (ownV && (ownV.position.x !== hudTileX || ownV.position.y !== hudTileY)) {
        hudTileX = ownV.position.x;
        hudTileY = ownV.position.y;
        minimap?.setPos(ownV.position.x, ownV.position.y);
        updateHudLocation(currentMapName, currentMapId, ownV.position.x, ownV.position.y);
      }
    }
  };
  let hudTileX = -1;
  let hudTileY = -1;
  app.ticker.add(tick);

  // -- Handlers de paquetes del server --
  function handlePacket(packet: AnyPacket): void {
    // Mapa cargando: buffer (se re-aplican al terminar). Un MapData nuevo
    // pasa directo — toma el control vía mapLoadToken.
    if (mapLoading && packet.op !== ServerToClientOp.MapData) {
      packetsWhileLoading.push(packet);
      return;
    }
    switch (packet.op) {
      case ServerToClientOp.MapData:
        void applyMapData(packet);
        break;
      case ServerToClientOp.EntityUpdate:
        handleEntityUpdate(packet);
        break;
      case ServerToClientOp.EntitySpawn:
        handleEntitySpawn(packet);
        break;
      case ServerToClientOp.EntityDespawn:
        handleEntityDespawn(packet);
        break;
      case ServerToClientOp.EntityAppearance:
        handleEntityAppearance(packet);
        break;
      case ServerToClientOp.ChatBroadcast:
        handleChatBroadcast(packet);
        break;
      case ServerToClientOp.ChatError:
        handleChatError(packet);
        break;
      case ServerToClientOp.Damage:
        handleDamage(packet);
        break;
      case ServerToClientOp.Death:
        handleDeath(packet);
        break;
      case ServerToClientOp.Respawn:
        handleRespawn(packet);
        break;
      case ServerToClientOp.StatsUpdate:
        handleStatsUpdate(packet);
        break;
      case ServerToClientOp.NpcInfo:
        showNpcInfo(packet);
        break;
      case ServerToClientOp.PlayerInfo:
        showPlayerInfo(packet);
        break;
      case ServerToClientOp.GroundItemSpawn:
        addGroundItemVisual(packet.id as unknown as number, packet.position, packet.item, packet.qty);
        break;
      case ServerToClientOp.GroundItemDespawn:
        removeGroundItemVisual(packet.id as unknown as number);
        break;
      case ServerToClientOp.InventoryUpdate:
        handleInventoryUpdate(packet);
        break;
      case ServerToClientOp.ShopOpen:
        handleShopOpen(packet);
        break;
      case ServerToClientOp.BankOpen:
        handleBankOpen(packet);
        break;
      case ServerToClientOp.BankUpdate:
        handleBankUpdate(packet);
        break;
      case ServerToClientOp.PartyInviteReceived:
        handlePartyInviteReceived(packet);
        break;
      case ServerToClientOp.PartyUpdate:
        handlePartyUpdate(packet);
        break;
      case ServerToClientOp.PartyDisbanded:
        handlePartyDisbanded(packet);
        break;
      case ServerToClientOp.TradeInviteReceived:
        handleTradeInviteReceived(packet);
        break;
      case ServerToClientOp.TradeUpdate:
        handleTradeUpdatePacket(packet);
        break;
      case ServerToClientOp.TradeComplete:
        handleTradeComplete(packet);
        break;
      case ServerToClientOp.TradeCancelled:
        handleTradeCancelled(packet);
        break;
      case ServerToClientOp.SkillEffect:
        handleSkillEffect(packet);
        break;
      case ServerToClientOp.WhisperReceived:
        handleWhisperReceived(packet);
        break;
      case ServerToClientOp.MeditateUpdate:
        handleMeditateUpdate(packet);
        break;
      case ServerToClientOp.SpellsKnown:
        handleSpellsKnown(packet);
        break;
      case ServerToClientOp.EntityEffect:
        handleEntityEffect(packet);
        break;
      case ServerToClientOp.ConsoleMsg:
        handleConsoleMsg(packet);
        break;
      case ServerToClientOp.QuestOffer:
        questsUi?.showOffer(packet.questId);
        break;
      case ServerToClientOp.QuestState:
        questsUi?.setState(packet.active, packet.done);
        break;
      case ServerToClientOp.FactionUpdate:
        handleFactionUpdate(packet);
        break;
      case ServerToClientOp.GuildTagUpdate:
        handleGuildTagUpdate(packet);
        break;
      case ServerToClientOp.MapTileUpdate:
        handleMapTileUpdate(packet);
        break;
      case ServerToClientOp.RainToggle:
        setRaining(packet.raining);
        break;
      case ServerToClientOp.GameConfig:
        handleGameConfig(packet);
        break;
      case ServerToClientOp.ExitOk:
        onChangeCharacter(); // el server autorizó la salida → selección de personaje
        break;
      case ServerToClientOp.CriminalUpdate:
        handleCriminalUpdate(packet);
        break;
      default:
        // LoginResponse ya lo consumio el handshake; nada mas que hacer.
        break;
    }
  }

  // Habla sobre la cabeza (ChatOverHead — la marca registrada del AO).
  // El texto flota sobre el personaje y se desvanece según su largo.
  function showOverheadText(v: EntityVisual, text: string): void {
    if (v.overheadText) {
      v.container.removeChild(v.overheadText);
      v.overheadText.destroy({ children: true });
      v.overheadText = null;
    }
    // Texto oscuro dentro de un globo claro (burbuja de diálogo).
    const label = new Text({
      text,
      resolution: WORLD_SCALE * (window.devicePixelRatio || 1),
      style: new TextStyle({
        fill: "#141414",
        fontFamily: "Verdana, Geneva, sans-serif",
        fontSize: 9,
        fontWeight: "bold",
        align: "center",
        wordWrap: true,
        wordWrapWidth: 108,
      }),
    });
    label.anchor.set(0.5, 0.5);
    const padX = 6;
    const padY = 4;
    const w = Math.ceil(label.width) + padX * 2;
    const h = Math.ceil(label.height) + padY * 2;
    // El globo se inclina hacia adelante según la dirección que mira el personaje;
    // la cola apunta de vuelta hacia la boca.
    const dx = v.facing === "east" ? 12 : v.facing === "west" ? -12 : 0;
    const tailX = Math.max(-w / 2 + 5, Math.min(w / 2 - 5, -dx));
    const g = new Graphics();
    g.roundRect(-w / 2, -h / 2, w, h, 6).fill({ color: 0xf6f4ec, alpha: 0.8 }).stroke({ width: 1.5, color: 0x141414 });
    // Cola triangular (fill que solapa el borde inferior → se ve continua con el globo).
    g.moveTo(tailX - 5, h / 2 - 2).lineTo(tailX, h / 2 + 6).lineTo(tailX + 5, h / 2 - 2).fill({ color: 0xf6f4ec, alpha: 0.8 });
    const bubble = new Container();
    bubble.addChild(g);
    bubble.addChild(label);
    // Sobre la cabeza (arriba del sprite o de la silueta fallback), inclinado.
    const headTop = v.bodySprite ? v.bodySprite.y - v.bodySprite.height : -34;
    bubble.x = dx;
    bubble.y = headTop - 8 - h / 2;
    v.container.addChild(bubble);
    v.overheadText = bubble;
    // Duración tipo AO: base + tiempo de lectura por caracteres.
    v.overheadUntil = performance.now() + 2_500 + text.length * 60;
  }

  // Palabras mágicas al estilo AO Libre: texto plano flotante sobre la cabeza
  // (SIN globo de diálogo), como el ChatOverHead original del AO. Reusa el slot
  // y el lifetime de overheadText para que se limpie solo y no se solape.
  function showMagicWords(v: EntityVisual, text: string): void {
    if (v.overheadText) {
      v.container.removeChild(v.overheadText);
      v.overheadText.destroy({ children: true });
      v.overheadText = null;
    }
    const label = new Text({
      text,
      resolution: WORLD_SCALE * (window.devicePixelRatio || 1),
      style: new TextStyle({
        fill: "#ffffff",
        stroke: { color: 0x000000, width: 3 },
        fontFamily: "Arial, sans-serif",
        fontSize: 9,
        fontWeight: "bold",
        align: "center",
        wordWrap: true,
        wordWrapWidth: 130,
      }),
    });
    label.anchor.set(0.5, 1);
    const headTop = v.bodySprite ? v.bodySprite.y - v.bodySprite.height : -34;
    label.x = 0;
    label.y = headTop - 6;
    v.container.addChild(label);
    v.overheadText = label;
    v.overheadUntil = performance.now() + 2_500 + text.length * 60;
  }

  function handleChatBroadcast(p: ChatBroadcast): void {
    const fromId = p.fromId as unknown as number;
    chat?.appendMessage({
      fromName: p.fromName,
      text: p.text,
      timestamp: p.timestamp,
      isSelf: fromId === character.id,
      // Grito (/gritar): naranja destacado.
      ...(p.yell ? { color: "#f0a030" } : {}),
    });
    const v = entityVisuals.get(fromId);
    if (v) showOverheadText(v, p.text);
  }

  function handleChatError(p: ChatError): void {
    chat?.showError(p.reason);
  }

  function handleDamage(p: Damage): void {
    // Rugido de la criatura atacante (Snd de NPCs.dat), si el server lo mandó.
    if (p.wav && p.wav > 0) audio.play(p.wav, 0.75);
    const targetId = p.targetId as unknown as number;
    const attackerId = p.attackerId as unknown as number;
    const target = entityVisuals.get(targetId);
    const targetIsSelf = targetId === character.id;
    const attackerIsSelf = attackerId === character.id;

    // Swing + GIRO del atacante hacia el objetivo — SIEMPRE, acierte o falle.
    // (Antes esto vivía después del `return` del fallo, así que al fallar la
    // criatura/jugador no giraba hacia donde pegaba.) El propio ya se animó
    // localmente al enviar el ataque. Daño MÁGICO (hechizo/veneno): sin swing
    // — un mago casteando a 10 tiles no "pega un golpe".
    if (!attackerIsSelf && !p.magic && target) {
      const attacker = entityVisuals.get(attackerId);
      if (attacker) {
        const dx = Math.sign(target.position.x - attacker.position.x);
        const dy = Math.sign(target.position.y - attacker.position.y);
        const dir: Direction =
          dx === 1 ? "east" : dx === -1 ? "west" : dy === -1 ? "north" : "south";
        playSwing(attacker, dir);
      }
    }

    if (target) {
      target.hp = p.hp;
      target.maxHp = p.maxHp;

      const combatLine = (line: string): void => {
        chat?.appendMessage({ fromName: "", text: line, timestamp: Date.now(), isSelf: false, kind: "combate" });
      };
      const attacker = entityVisuals.get(attackerId);
      const who = attacker?.name ?? "Alguien";

      // Fallo o rechazo con escudo (fórmulas de impacto del AO): sin daño.
      if (p.miss || p.blocked) {
        audio.play(p.blocked ? SND.escudo : SND.swing, 0.8);
        const label = p.blocked ? "¡Rechazado!" : "¡Falla!";
        spawnFloater(target.renderX, target.renderY, label, p.blocked ? "#8ab8f0" : "#9a9a9a");
        if (attackerIsSelf) {
          combatLine(p.blocked ? `¡${target.name} rechazó tu ataque con el escudo!` : "¡Has fallado el golpe!");
        } else if (targetIsSelf) {
          combatLine(p.blocked ? "¡¡Has rechazado el ataque con el escudo!!" : `¡${who} falló el golpe!`);
        }
        return;
      }

      showEntityHpBar(target);
      // Golpe que conecta: sonido de impacto del AO. El daño mágico no lo
      // reproduce (el hechizo ya sonó con su propio wav vía SkillEffect).
      if (!p.magic) audio.play(SND.impacto, 0.85);
      // Numero de daño sobre el objetivo: rojo si lo recibo yo, verde si
      // lo inflijo yo, neutro si es entre terceros.
      const color = targetIsSelf ? "#ff5555" : attackerIsSelf ? "#7cfc8a" : "#e8dfc8";
      spawnFloater(target.renderX, target.renderY, `-${p.amount.toString()}`, color);

      // Log de combate (pestaña «combate» de la consola).
      const stabTxt = p.stab ? " ¡Apuñalada!" : "";
      if (attackerIsSelf) {
        const line = p.hp === 0
          ? `¡Has matado a ${target.name}!`
          : `Le pegaste a ${target.name} por ${p.amount.toString()}.${stabTxt}`;
        combatLine(line);
      } else if (targetIsSelf) {
        const line = p.hp === 0
          ? `¡${who} te ha matado!`
          : `${who} te pegó por ${p.amount.toString()}.${stabTxt}`;
        combatLine(line);
      }
    }

    if (targetIsSelf) updateSelfHud();
  }

  // Estado "muerto" al crear una entidad (spawn/MapData con dead: true) — el
  // mismo look que handleDeath pero sin sonido ni mensajes (no acaba de morir:
  // ya estaba muerto, p. ej. un fantasma cruzando de mapa).
  function applyDeadVisual(id: number): void {
    const v = entityVisuals.get(id);
    if (!v) return;
    v.dead = true;
    v.hp = 0;
    v.hpBar.visible = false;
    v.hpBarUntil = 0;
    v.body.alpha = 0.35;
    if (id === character.id) showDeathOverlay();
  }

  // Estado "invisible" al crear la entidad (spawn/MapData): mismo look que el
  // efecto en vivo — semi-transparente si soy yo, oculto para los demás.
  function applyInvisibleVisual(id: number): void {
    const v = entityVisuals.get(id);
    if (!v) return;
    v.invisible = true;
    if (id === character.id) v.container.alpha = 0.45;
    else v.container.visible = false;
  }

  function handleDeath(p: Death): void {
    const id = p.id as unknown as number;
    const v = entityVisuals.get(id);
    if (v) {
      v.dead = true;
      v.hp = 0;
      v.hpBar.visible = false;
      v.hpBarUntil = 0;
      // Criaturas: su propio sonido (Snd de NPCs.dat). Jugadores: grito humano.
      audio.play(p.wav && p.wav > 0 ? p.wav : v.kind === "player" ? SND.muerte : 0, 0.8);
      if (v.kind === "player") {
        // Los jugadores no desaparecen (fantasma del AO): sólo se atenúan.
        v.body.alpha = 0.35;
      } else {
        // Criaturas/NPCs: desaparecen al morir (reaparecen con el Respawn).
        // Antes sólo atenuábamos v.body (la silueta fallback, invisible cuando
        // hay sprite real), así que el gráfico del bicho muerto quedaba dibujado.
        v.container.visible = false;
      }
    }
    if (id === character.id) {
      showDeathOverlay();
      updateSelfHud();
      chat?.appendMessage({ fromName: "", text: "¡Has muerto!", timestamp: Date.now(), isSelf: false, kind: "global" });
    }
  }

  // ¿El arma equipada es a distancia (arco)? — habilita el click-ataque lejano.
  let selfWeaponRanged = false;
  let selfEquippedWeapon: number | null = null;
  let selfHasArrows = false;

  // Cargar UNA flecha (aparece la cruz). Requiere arco equipado + flechas.
  // El próximo click en el mapa la dispara y descarga la cruz.
  function nockArrow(): void {
    if (!selfWeaponRanged) {
      chat?.appendMessage({ fromName: "", text: "Necesitás un arco equipado.", timestamp: Date.now(), isSelf: false, kind: "combate" });
      return;
    }
    if (!selfHasArrows) {
      chat?.appendMessage({ fromName: "", text: "¡No tenés flechas!", timestamp: Date.now(), isSelf: false, kind: "combate" });
      return;
    }
    setArmedArrow(true);
  }

  function handleInventoryUpdate(p: InventoryUpdate): void {
    const wDef = p.equippedWeapon !== null ? getItem(p.equippedWeapon) : undefined;
    selfWeaponRanged = wDef?.ranged === true;
    selfEquippedWeapon = p.equippedWeapon;
    selfHasArrows = p.slots.some((s) => s.qty > 0 && getItem(s.item)?.type === "arrow");
    // Si te quedaste sin flechas (o desequipaste el arco), se descarga la cruz.
    if (armedArrow && (!selfWeaponRanged || !selfHasArrows)) setArmedArrow(false);
    inventory?.setData({
      gold: p.gold,
      slots: p.slots,
      equippedWeapon: p.equippedWeapon,
      equippedArmor: p.equippedArmor,
      equippedHelmet: p.equippedHelmet ?? null,
      equippedShield: p.equippedShield ?? null,
      equippedArrow: p.equippedArrow ?? null,
    });
    bank?.setPlayerInventory(p.slots, p.gold);
    shop?.setPlayerInventory(p.slots, p.gold);
    tradeUi?.setInventory(p.slots, p.gold);
    macroInventory = p.slots.filter((s) => s.item > 0);
  }

  function handleShopOpen(p: ShopOpen): void {
    shop?.open(p.offers);
  }

  function handleBankOpen(p: BankOpen): void {
    bank?.open(p.bankInventory, p.bankGold);
  }

  function handleBankUpdate(p: BankUpdate): void {
    bank?.update(p.bankInventory, p.bankGold, p.playerInventory, p.playerGold);
    // Sincronizar oro + slots del jugador SIN pisar el equipo conocido (el
    // paquete del banco no lo trae; pasar null borraba el resaltado y mostraba
    // Def/Daño 0 hasta el próximo InventoryUpdate).
    inventory?.setSlots(p.playerGold, p.playerInventory);
  }

  function handlePartyInviteReceived(p: PartyInviteReceived): void {
    partyUi?.showInvite(p.inviterName);
  }

  function handlePartyUpdate(p: PartyUpdate): void {
    partyUi?.updateParty(p.members);
  }

  function handlePartyDisbanded(_p: PartyDisbanded): void {
    partyUi?.clearParty();
  }

  function handleTradeInviteReceived(p: TradeInviteReceived): void {
    tradeUi?.showInvite(p.initiatorName);
  }

  function handleTradeUpdatePacket(p: TradeUpdate): void {
    if (!tradeUi?.isOpen()) {
      tradeUi?.openTrade(p.theirName);
    }
    tradeUi?.updateTrade(p.myOffer, p.theirOffer, p.theirName);
  }

  function handleTradeComplete(_p: TradeComplete): void {
    tradeUi?.closeTrade();
  }

  function handleTradeCancelled(_p: TradeCancelled): void {
    tradeUi?.closeTrade();
  }

  function handleSkillEffect(p: SkillEffect): void {
    const casterId = p.casterId as unknown as number;
    const targetId = p.targetId as unknown as number | undefined;
    const isSelfCaster = casterId === character.id;

    // Palabras mágicas del AO: el caster las "dice" sobre su cabeza, como texto
    // plano flotante (estilo AO Libre), NO en globo de diálogo.
    const casterVisual = entityVisuals.get(casterId);
    const spellWords = getAoSpell(p.skillId)?.magicWords;
    if (casterVisual && spellWords) showMagicWords(casterVisual, spellWords);

    // Mostramos floater cuando somos el lanzador, y suena el WAV real
    // del hechizo (campo WAV de Hechizos.dat).
    if (isSelfCaster) {
      const own = entityVisuals.get(character.id);
      if (own) spawnFloater(own.renderX, own.renderY - 12, "✦", "#4a8cda");
    }
    const spellDef = getAoSpell(p.skillId);
    if ((spellDef?.wav ?? 0) > 0) audio.play(spellDef!.wav, 0.8);

    // FX visual del hechizo sobre el objetivo (FXgrh + Loops de Hechizos.dat).
    if (spellDef && spellDef.fxGrh > 0) {
      const fxTarget = targetId !== undefined ? entityVisuals.get(targetId) : entityVisuals.get(casterId);
      if (fxTarget) fxPlayer.play(fxTarget.container, spellDef.fxGrh, Math.max(1, spellDef.loops));
    }

    // Si hay objetivo, mostrar efecto sobre él.
    if (targetId !== undefined) {
      const target = entityVisuals.get(targetId);
      if (target && p.amount !== undefined && p.amount > 0) {
        // Cura vs daño: si el HP cambió, la dirección manda. Si quedó igual
        // (cura con vida llena), decide la definición del hechizo (subeHp 1).
        // Antes ese caso mostraba "-N" naranja como si fuera daño.
        const isHeal =
          p.newTargetHp !== undefined && p.newTargetHp !== target.hp
            ? p.newTargetHp > target.hp
            : getAoSpell(p.skillId)?.subeHp === 1;
        const color = isHeal ? "#7cfc8a" : "#da9c3f";
        const label = isHeal ? `+${p.amount.toString()}` : `-${p.amount.toString()}`;
        spawnFloater(target.renderX, target.renderY, label, color);
        if (p.newTargetHp !== undefined && p.newTargetMaxHp !== undefined) {
          target.hp = p.newTargetHp;
          target.maxHp = p.newTargetMaxHp;
          showEntityHpBar(target);
        }
      }
      if (p.dotApplied && target) {
        spawnFloater(target.renderX, target.renderY + 4, "☠", "#7c3dbd");
      }
    }
  }

  function handleSpellsKnown(p: SpellsKnown): void {
    inventory?.setSpells([...p.spellIds]);
    macroSpellIds = [...p.spellIds];
  }

  // Mensajes de consola del server (trabajos, seguros, avisos).
  function handleConsoleMsg(p: ConsoleMsg): void {
    // Texto vacío = solo sonido (p. ej. el glup de la poción) — sin línea en el chat.
    if (p.text) {
      const kind = p.kind === "chat" ? "normal" : p.kind;
      chat?.appendMessage({ fromName: "", text: p.text, timestamp: Date.now(), isSelf: false, kind });
    }
    if ((p.wav ?? 0) > 0) audio.play(p.wav!, 0.7);
  }

  // Meditación: el aura clásica del AO (FX en loop por tamaño según nivel:
  // FXMEDITARCHICO=4, MEDIANO=5, GRANDE=6, XGRANDE=16, XXGRANDE=34).
  function meditateFxFor(level: number): number {
    if (level < 15) return 4;
    if (level < 30) return 5;
    if (level < 45) return 6;
    if (level < 60) return 16;
    return 34;
  }

  function handleMeditateUpdate(p: MeditateUpdate): void {
    const id = p.id as unknown as number;
    const v = entityVisuals.get(id);
    if (!v) return;
    v.meditateFx?.stop();
    v.meditateFx = null;
    if (p.meditating) {
      // El aura escala con el nivel REAL de quien medita (v.level llega en el
      // spawn) — antes los demás siempre mostraban la chica (nivel 1).
      const level = id === character.id ? panelStats.level : (v.level || 1);
      v.meditateFx = fxPlayer.play(v.container, meditateFxFor(level), -1);
      spawnFloater(v.renderX, v.renderY - 8, "✦ meditando", "#8ab8f0");
    }
  }

  // Estados alterados: parálisis/inmovilización (candado de movimiento),
  // invisibilidad (desaparece para los demás), ceguera y estupidez.
  let selfParalyzedUntil = 0;
  let selfImmobilizedUntil = 0;

  const blindOverlay = document.createElement("div");
  blindOverlay.className = "ao-blind";
  stageEl.appendChild(blindOverlay);

  function handleEntityEffect(p: EntityEffect): void {
    const id = p.id as unknown as number;
    const v = entityVisuals.get(id);
    const isSelf = id === character.id;
    const now = performance.now();

    switch (p.effect) {
      case "paralyzed":
      case "immobilized": {
        if (isSelf) {
          if (p.effect === "paralyzed") selfParalyzedUntil = p.active ? now + (p.durationMs ?? 0) : 0;
          else selfImmobilizedUntil = p.active ? now + (p.durationMs ?? 0) : 0;
        }
        if (v && p.active) {
          spawnFloater(v.renderX, v.renderY - 10, p.effect === "paralyzed" ? "¡Paralizado!" : "¡Inmovilizado!", "#7fd4e0");
        }
        if (isSelf && p.active) {
          chat?.appendMessage({ fromName: "", text: p.effect === "paralyzed" ? "¡Te han paralizado!" : "¡Te han inmovilizado!", timestamp: Date.now(), isSelf: false, kind: "combate" });
        }
        break;
      }
      case "invisible": {
        if (!v) return;
        v.invisible = p.active;
        if (isSelf) {
          // Uno se ve a sí mismo semi-transparente.
          v.container.alpha = p.active ? 0.45 : 1;
        } else {
          v.container.visible = !p.active;
        }
        break;
      }
      case "blind": {
        if (!isSelf) return;
        blindOverlay.classList.toggle("ao-blind--on", p.active);
        break;
      }
      case "dumb": {
        if (!isSelf) return;
        if (p.active) {
          chat?.appendMessage({ fromName: "", text: "¡Te sientes estúpido! No podés concentrarte.", timestamp: Date.now(), isSelf: false, kind: "combate" });
        }
        break;
      }
    }
  }

  function handleWhisperReceived(p: WhisperReceived): void {
    chat?.appendMessage({
      fromName: p.outgoing ? `→ ${p.toName}` : `← ${p.fromName}`,
      text: p.text,
      timestamp: p.timestamp,
      isSelf: p.outgoing,
      kind: "whisper",
    });
  }

  // Criminal badge encima del propio personaje.
  let criminalBadge: HTMLElement | null = null;

  // Intervalos del panel admin → cooldowns locales. Sincroniza el tempo de golpe
  // melee (INTERVALS.melee) y de flechas (INTERVALS.arrow) con el server, en vivo.
  function handleGameConfig(p: GameConfigMsg): void {
    const melee = p.intervals.melee;
    const arrow = p.intervals.arrow;
    if (typeof melee === "number" && melee > 0) serverMeleeMs = melee;
    if (typeof arrow === "number" && arrow > 0) serverArrowMs = arrow;
  }

  function handleCriminalUpdate(p: CriminalUpdate): void {
    const id = p.id as unknown as number;
    // Color del nombre para todos (azul ciudadano / rojo criminal — AO).
    const v = entityVisuals.get(id);
    if (v) {
      v.criminal = p.criminal;
      if (v.kind === "player") {
        // Los GM conservan su verde; el criminal solo pinta a jugadores.
        v.label.style.fill = nameColor(v.role, p.criminal);
        v.nameLabel.style.fill = nameColor(v.role, p.criminal);
      }
    }
    // Badge solo para el propio personaje.
    if (id !== character.id) return;
    // Nombre del HUD flotante en rojo si sos criminal.
    hudNameEl.classList.toggle("ao-hud__name--criminal", p.criminal);
    if (p.criminal) {
      if (!criminalBadge) {
        criminalBadge = document.createElement("div");
        criminalBadge.className = "ao-criminal-badge";
        criminalBadge.textContent = "CRIMINAL";
        stageEl.appendChild(criminalBadge);
      }
    } else {
      criminalBadge?.remove();
      criminalBadge = null;
    }
  }


  // Popup de detalle de criatura/NPC (click derecho): exp, oro y drops con su
  // probabilidad. Un solo popup a la vez; se cierra con la ✕ o al reabrir otro.
  let npcInfoEl: HTMLDivElement | null = null;
  const escapeHtml = (s: string): string =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
  function showNpcInfo(p: NpcInfoResponse): void {
    npcInfoEl?.remove();
    const pct = (c: number): string => `${Math.round(c * 100).toString()}%`;
    const goldRows = p.gold.length > 0
      ? p.gold.map((g) => `<div class="ao-npcinfo__row"><span>Oro · ${g.qty.toLocaleString("es")}</span><b>${pct(g.chance)}</b></div>`).join("")
      : `<div class="ao-npcinfo__row"><span class="ao-npcinfo__faint">Sin oro</span></div>`;
    const dropRows = p.drops.length > 0
      ? p.drops.map((d) => {
          const name = getItem(d.item)?.name ?? `#${d.item.toString()}`;
          const qty = d.qty > 1 ? ` ×${d.qty.toString()}` : "";
          return `<div class="ao-npcinfo__row"><span>${escapeHtml(name)}${qty}</span><b>${pct(d.chance)}</b></div>`;
        }).join("")
      : `<div class="ao-npcinfo__row"><span class="ao-npcinfo__faint">Sin drops</span></div>`;
    const el = document.createElement("div");
    el.className = "ao-npcinfo";
    el.innerHTML = `
      <div class="ao-npcinfo__head">
        <span class="ao-npcinfo__name">${escapeHtml(p.name)}</span>
        <button class="ao-npcinfo__close" title="Cerrar">✕</button>
      </div>
      <div class="ao-npcinfo__sub">#${p.number.toString()} · Vida ${p.hp.toLocaleString("es")} / ${p.maxHp.toLocaleString("es")}</div>
      <div class="ao-npcinfo__stat"><span>Experiencia</span><b>${p.xpReward.toLocaleString("es")}</b></div>
      <div class="ao-npcinfo__sectitle">Oro <small>(por probabilidad)</small></div>${goldRows}
      <div class="ao-npcinfo__sectitle">Drops <small>(por probabilidad)</small></div>${dropRows}
    `;
    el.querySelector<HTMLButtonElement>(".ao-npcinfo__close")?.addEventListener("click", () => {
      el.remove();
      if (npcInfoEl === el) npcInfoEl = null;
    });
    root.appendChild(el);
    npcInfoEl = el;
  }

  // Click sobre un personaje: "Ves a {nombre} [{clase}] [Nivel: {nv}] - {estado}"
  // (Ciudadano azul · Criminal rojo · Game Master verde, en bold). El GM no
  // muestra clase ni nivel.
  function showPlayerInfo(p: PlayerInfoResponse): void {
    let line: string;
    let color: string;
    if (p.role > 0) {
      // Game Master: sin clase ni nivel, verde.
      line = `Ves a ${p.name}${p.clan ? ` <${p.clan}>` : ""} - Game Master`;
      color = "#4cd07a";
    } else {
      const estado = p.criminal ? "Criminal" : "Ciudadano";
      color = p.criminal ? "#e5484d" : "#4f8ff0";
      const cls = p.classN ? ` [${p.classN}]` : "";
      line = `Ves a ${p.name}${p.clan ? ` <${p.clan}>` : ""}${cls} [Nivel: ${p.level.toString()}] - ${estado}`;
    }
    // Descripción del personaje (sistema /desc del AO), si tiene una.
    if (p.description) line += ` - "${p.description}"`;
    chat?.appendMessage({ fromName: "", text: line, timestamp: Date.now(), isSelf: false, kind: "global", color });
  }

  function handleStatsUpdate(p: StatsUpdate): void {
    // Deltas para el aviso de subir de nivel (calculados ANTES de pisar los viejos).
    const dHp = p.maxHp - panelStats.maxHp;
    const dMana = (p.maxMana ?? 0) - panelStats.maxMana;
    const dSta = (p.maxSta ?? 0) - panelStats.maxSta;
    // Sincroniza HP propio (p. ej. curación al subir de nivel) y las barras.
    const own = entityVisuals.get(character.id);
    if (own) {
      own.hp = p.hp;
      own.maxHp = p.maxHp;
      // Redibujar la barra roja bajo el nombre: sin esto, curas/pociones/regen
      // (que llegan por StatsUpdate, no por Damage) dejaban la barra congelada.
      if (!own.dead) showEntityHpBar(own);
    }
    panelStats.hp = p.hp;
    panelStats.maxHp = p.maxHp;
    panelStats.mana = p.mana ?? 0;
    panelStats.maxMana = p.maxMana ?? 0;
    panelStats.level = p.level;
    // Mantener el label propio (Lv. N) al día al subir de nivel.
    const selfVisual = entityVisuals.get(character.id);
    if (selfVisual) { selfVisual.level = p.level; applyNameTag(selfVisual); }
    panelStats.xpInto = p.xp;
    panelStats.xpForNext = p.xpForNextLevel;
    panelStats.hunger = p.hunger ?? 100;
    panelStats.thirst = p.thirst ?? 100;
    panelStats.sta = p.sta ?? 100;
    panelStats.maxSta = p.maxSta ?? 100;
    panelStats.strBonus = p.strBonus ?? 0;
    panelStats.agiBonus = p.agiBonus ?? 0;
    panelStats.buffExpiresAt = p.buffExpiresAt ?? 0;
    panelStats.str = p.str ?? panelStats.str;
    panelStats.agi = p.agi ?? panelStats.agi;
    pushPanelStats();
    statsPanel?.update(p);
    if (p.level > prevLevel) {
      // Subir de nivel: aviso con el desglose de lo ganado, en AMARILLO y NEGRITA
      // (definir `color` en el chat ⇒ fontWeight 700). Mostramos lo que sube con
      // el nivel: vida, maná, energía y golpe (MinHIT/MaxHIT del AO). Los atributos
      // en este port son fijos (AO Libre) → no se dan puntos, no se listan.
      audio.play(SND.nivel, 0.9);
      const classId = entityVisuals.get(character.id)?.classId ?? p.classId ?? 1;
      const newHit = golpeUsuario(classId, p.level);
      const dHit = newHit.max - golpeUsuario(classId, prevLevel).max;
      const gains: string[] = [];
      if (dHp > 0) gains.push(`+${dHp.toString()} vida`);
      if (dMana > 0) gains.push(`+${dMana.toString()} maná`);
      if (dSta > 0) gains.push(`+${dSta.toString()} energía`);
      if (dHit > 0) gains.push(`+${dHit.toString()} golpe`);
      const extra = gains.length > 0 ? ` — ${gains.join(" · ")}` : "";
      chat?.appendMessage({
        fromName: "",
        text: `¡Has subido a nivel ${p.level.toString()}!${extra}`,
        timestamp: Date.now(),
        isSelf: false,
        kind: "global",
        color: "#ffe23a",
      });
      // Debajo, el detalle de los valores ACTUALES tras subir.
      const cur: string[] = [
        `Golpe actual: ${newHit.min.toString()}-${newHit.max.toString()}`,
        `Vida actual: ${p.maxHp.toString()}`,
      ];
      if ((p.maxMana ?? 0) > 0) cur.push(`Maná actual: ${(p.maxMana ?? 0).toString()}`);
      cur.push(`Energía actual: ${(p.maxSta ?? 0).toString()}`);
      chat?.appendMessage({
        fromName: "",
        text: cur.join(", "),
        timestamp: Date.now(),
        isSelf: false,
        kind: "global",
        color: "#ffe23a",
      });
      prevLevel = p.level;
    }
    // Si la skill de clase no estaba seteada todavía, cargarla ahora.
    if (p.classId && p.classId !== 0 && classSkillId === 0) {
      const skill = getClassSkill(p.classId);
      if (skill) {
        classSkillId = skill.id;
        // Macro por defecto: la skill de clase en el slot 1 (si está libre).
        macroBar?.setDefaultSkill(skill.id);
      }
    }
  }

  function handleRespawn(p: Respawn): void {
    const id = p.id as unknown as number;
    const v = entityVisuals.get(id);
    if (v) {
      v.dead = false;
      v.hp = p.hp;
      v.maxHp = p.maxHp;
      v.body.alpha = 1;
      v.container.visible = true; // criatura oculta al morir vuelve a mostrarse
      v.hpBar.visible = false;
      v.hpBarUntil = 0;
      if (v.kind === "player") showEntityHpBar(v);
      snapEntityTo(id, p.position);
    }
    if (id === character.id) {
      hideDeathOverlay();
      updateSelfHud();
      centerCameraOnSelf();
    }
  }

  function handleEntityUpdate(p: EntityUpdate): void {
    const id = p.id as unknown as number;
    const existing = entityVisuals.get(id);
    if (!existing) {
      // Llego un update de algo que no conocemos — lo creamos.
      // Sucede si nos perdimos el spawn (race en reconexion). No tenemos
      // su HP real todavia; lo mostramos lleno hasta el proximo DAMAGE.
      addEntity(id, p.position, `?${id.toString()}`, id === character.id, 1, 1, "player", p.direction, 0, 0);
      refreshPlayerList();
      return;
    }
    // Actualizar direccion tanto para self como para otros.
    setEntityFacing(existing, p.direction);
    if (id === character.id) {
      // ACK del server para el propio: si coincide con nuestra prediccion
      // hacemos nada visual; si difiere, snap a la verdad del server.
      if (existing.position.x === p.position.x && existing.position.y === p.position.y) {
        return;
      }
      snapEntityTo(id, p.position);
      return;
    }
    moveEntityTo(id, p.position);
  }

  function handleEntitySpawn(p: EntitySpawn): void {
    const id = p.id as unknown as number;
    const existing = entityVisuals.get(id);
    if (existing) {
      // Si ya lo teníamos con datos reales (MAP_DATA inicial), no tocamos nada.
      // Pero si es un PLACEHOLDER ("?<id>", creado por un EntityUpdate que llegó
      // antes que el spawn — race de reconexión), lo eliminamos y lo recreamos
      // con los datos reales; si no, quedaba pegado como "?1000051 / Lv.1 Guerrero".
      if (!existing.name.startsWith("?")) return;
      removeEntity(id);
    }
    addEntity(id, p.position, p.name, id === character.id, p.hp, p.maxHp, p.kind, p.direction, p.bodyId, p.headId, p.criminal ?? false, p.faction ?? 0, p.guild ?? null, p.weaponAnim ?? 0, p.shieldAnim ?? 0, p.helmetAnim ?? 0, p.role ?? 0, p.level ?? 1, p.classId ?? 1);
    if (p.dead) applyDeadVisual(id);
    if (p.invisible) applyInvisibleVisual(id);
    if (p.meditating) handleMeditateUpdate({ op: ServerToClientOp.MeditateUpdate, id: p.id, meditating: true });
    refreshPlayerList();
  }

  // Label sobre la cabeza: "Lv. N" arriba y "Nombre - Clase" abajo (siempre
  // visible para jugadores). Ej: "Lv. 32" / "Jasmine - Guerrero".
  function applyNameTag(v: EntityVisual): void {
    if (v.kind !== "player") return;
    // Ya no se muestra "Lv. N / Clase" arriba (molestaba): solo el nombre debajo.
    v.nameLabel.text = v.name;
  }

  function handleFactionUpdate(p: FactionUpdate): void {
    const v = entityVisuals.get(p.id as unknown as number);
    if (!v) return;
    v.faction = p.faction;
    applyNameTag(v);
  }

  function handleGuildTagUpdate(p: GuildTagUpdate): void {
    const v = entityVisuals.get(p.id as unknown as number);
    if (!v) return;
    v.guild = p.guild;
    applyNameTag(v);
  }

  // Puertas del AO: el server cambia el GRH de capa 3 y el bloqueo del tile
  // (y del tile oeste — las puertas ocupan 2 tiles).
  function handleMapTileUpdate(p: MapTileUpdate): void {
    if (mapWidth === 0) return;
    const idx = p.y * mapWidth + p.x;
    const blockedArr = mapBlocked as number[];
    blockedArr[idx] = p.blocked ? 1 : 0;
    // Solo el tile indicado: replicar al tile oeste era la convención de
    // puertas de 2 tiles, pero las puertas ya no se togglean (siempre
    // abiertas) y para teleports de GM desbloqueaba una pared client-side.
    const apply = (tex: Texture): void => {
      const existing = layer3ByTile.get(idx);
      if (existing) {
        existing.texture = tex;
      } else {
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 1);
        sprite.x = p.x * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = (p.y + 1) * TILE_SIZE;
        sprite.zIndex = (p.y + 1) * TILE_SIZE;
        entitiesLayer.addChild(sprite);
        mapObjectSprites.push(sprite);
        layer3ByTile.set(idx, sprite);
      }
    };
    // grh3 = 0 → limpiar el tile (p. ej. borrar un teleport de GM).
    if (p.grh3 === 0) {
      const existing = layer3ByTile.get(idx);
      if (existing) {
        const i = mapObjectSprites.indexOf(existing);
        if (i >= 0) mapObjectSprites.splice(i, 1);
        entitiesLayer.removeChild(existing);
        existing.destroy();
        layer3ByTile.delete(idx);
      }
      if ((p.wav ?? 0) > 0) audio.play(p.wav!, 0.7);
      return;
    }
    const tex = tileset.get(p.grh3);
    if (tex) apply(tex);
    else if (tileset.ready) {
      void tileset.preload([p.grh3]).then(() => {
        const loaded = tileset.get(p.grh3);
        if (loaded) apply(loaded);
      });
    }
    if ((p.wav ?? 0) > 0) audio.play(p.wav!, 0.7);
  }

  function handleEntityDespawn(p: EntityDespawn): void {
    // Nunca borrar la PROPIA entidad: un despawn rezagado (p. ej. el close de
    // una sesión vieja tras reloguear) nos dejaba invisibles y sin poder
    // movernos (tryStep necesita el visual propio).
    if ((p.id as unknown as number) === character.id) return;
    removeEntity(p.id as unknown as number);
    refreshPlayerList();
  }

  function handleEntityAppearance(p: EntityAppearance): void {
    const v = entityVisuals.get(p.id as unknown as number);
    if (!v) return;
    setEntityAppearance(v, p.bodyId, p.headId, p.weaponAnim ?? 0, p.shieldAnim ?? 0, p.helmetAnim ?? 0);
  }

  // Botón de pantalla completa: amplía el juego a toda la pantalla del navegador.
  // El recuadro se ESCALA (mantiene los mismos ~21x15 tiles) para no ver de más.
  const fsBtn = document.createElement("button");
  fsBtn.type = "button";
  fsBtn.className = "ao-fsbtn";
  fsBtn.title = "Pantalla completa (Esc para salir)";
  fsBtn.setAttribute("aria-label", "Pantalla completa");
  fsBtn.textContent = "⛶";
  stageEl.appendChild(fsBtn);

  function applyFsScale(): void {
    if (!viewportBox.isConnected) return;
    // Escala SIEMPRE (no solo en fullscreen): en 4K el juego se agranda; en
    // pantallas bajas (720p) se encoge manteniendo los 21x15 tiles — el ratio
    // y la coincidencia con el alcance de casteo quedan intactos.
    const r = stageEl.getBoundingClientRect();
    const s = Math.min(r.width / 840, r.height / 600);
    viewportBox.style.transform =
      Number.isFinite(s) && s > 0 && Math.abs(s - 1) > 0.01 ? `scale(${s.toFixed(4)})` : "";
    fsBtn.classList.toggle("ao-fsbtn--on", document.fullscreenElement !== null);
  }
  fsBtn.addEventListener("click", () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void frame.requestFullscreen().catch(() => undefined);
  });
  const onFsChange = (): void => { applyFsScale(); };
  document.addEventListener("fullscreenchange", onFsChange);
  applyFsScale(); // escala inicial (viewbox fijo 840x600 → espacio real)

  const onResize = (): void => {
    centerStatus();
    layoutCombatHud();
    applyFsScale();
    if (mapWidth > 0) centerCameraOnSelf();
  };
  app.renderer.on("resize", onResize);
  window.addEventListener("resize", onResize);

  // Conexion WebSocket
  const token = getToken();
  let authExpiredHandled = false;

  if (!token) {
    statusText.text = "Sin token — volvé a iniciar sesión.";
    statusText.style.fill = "#c93838";
    onAuthExpired();
  } else {
    client = new ReconnectingClient({
      token,
      characterId: character.id,
      onPacket: handlePacket,
      onStatus: (status: ClientStatus) => {
        hud.text = `v${PROTOCOL_VERSION} · ${character.name} · ${status.kind}`;
        switch (status.kind) {
          case "connecting":
            statusText.text = "Conectando al servidor...";
            statusText.style.fill = "#a89c80";
            statusText.visible = true;
            break;
          case "connected":
            // Mantenemos el overlay hasta que llegue MAP_DATA.
            statusText.text = `Sesión activa · esperando mapa (v${PROTOCOL_VERSION})`;
            statusText.style.fill = "#4cb87e";
            break;
          case "reconnecting":
            statusText.text = `Conexión perdida — reintentando ${status.attempt}/3 en ${Math.round(status.nextDelayMs / 1000)}s...`;
            statusText.style.fill = "#c97b1f";
            statusText.visible = true;
            break;
          case "failed":
            statusText.text = `Sesión terminada: ${status.reason}`;
            statusText.style.fill = "#c93838";
            statusText.visible = true;
            if (
              !authExpiredHandled &&
              (status.reason === "INVALID_TOKEN" || status.reason === "CHARACTER_NOT_FOUND")
            ) {
              authExpiredHandled = true;
              onAuthExpired();
            }
            break;
        }
      },
    });
    void client.start();

    // Lista de jugadores online: overlay arriba-derecha del segmento del mundo.
    playerList = mountPlayerList(viewportBox);

    keyConfig = mountKeyConfig(frame, (map) => {
      keymap = map;
    });

    craftUi = mountCraft(frame, {
      onCraft: (item) => {
        const pkt: CraftRequest = { op: ClientToServerOp.Craft, item };
        client?.send(pkt);
      },
    });

    questsUi = mountQuests(frame, {
      onAccept: (questId) => {
        client?.send({ op: ClientToServerOp.QuestAccept, questId });
      },
      onAbandon: (questId) => {
        client?.send({ op: ClientToServerOp.QuestAbandon, questId });
      },
    });

    inventory = mountInventory(sideCol, {
      onUse: (item) => {
        const def = getItem(item);
        // Arco: si ya está equipado, "click en el arco" CARGA una flecha
        // (cruz); si no, lo equipa. Para desequiparlo usá la tecla Equipar (E).
        if (def?.type === "weapon" && def.ranged) {
          if (selfEquippedWeapon === item) nockArrow();
          else client?.send({ op: ClientToServerOp.UseItem, item } satisfies UseItemRequest);
          return;
        }
        // Resto del equipo: equipar/desequipar (el server resuelve).
        if (def && EQUIP_TYPES.has(def.type)) {
          client?.send({ op: ClientToServerOp.UseItem, item } satisfies UseItemRequest);
          return;
        }
        useItemAction(item);
      },
      onSelectItem: (item) => { lastSelectedItem = item; },
      onSell: (item) => {
        const pkt: ShopSellRequest = { op: ClientToServerOp.ShopSell, item, qty: 1 };
        client?.send(pkt);
      },
      onReorder: (from, to) => {
        const pkt: InventoryReorderRequest = {
          op: ClientToServerOp.InventoryReorder,
          from,
          to,
        };
        client?.send(pkt);
      },
      onDrop: (slot, qty) => {
        const pkt: DropItemRequest = {
          op: ClientToServerOp.DropItem,
          slot,
          qty,
        };
        client?.send(pkt);
      },
      resolveIcon: (grh) => tileset.entry(grh),
      onSelectSpell: (spellId) => {
        setArmedSpell(spellId);
      },
      onSpellInfo: (spellId) => {
        const sp = getAoSpell(spellId);
        if (!sp) return;
        const parts: string[] = [];
        if (sp.subeHp === 2) parts.push(`Daño ${sp.minHp.toString()}-${sp.maxHp.toString()} (+3%/nivel)`);
        if (sp.subeHp === 1) parts.push(`Cura ${sp.minHp.toString()}-${sp.maxHp.toString()} (+3%/nivel)`);
        if (sp.paraliza) parts.push("Paraliza");
        if (sp.inmoviliza) parts.push("Inmoviliza");
        if (sp.removerParalisis) parts.push("Remueve parálisis");
        if (sp.invisibilidad) parts.push("Invisibilidad");
        if (sp.envenena) parts.push("Envenena");
        if (sp.curaVeneno) parts.push("Cura veneno");
        if (sp.ceguera) parts.push("Ciega");
        if (sp.estupidez) parts.push("Estupidiza");
        if (sp.revivir) parts.push("Resucita (vida completa)");
        const strMax = sp.strBoostMax ?? sp.strBoost ?? 0;
        const agiMax = sp.agiBoostMax ?? sp.agiBoost ?? 0;
        if (strMax > 0) parts.push(`+${(sp.strBoostMin ?? strMax).toString()}-${strMax.toString()} Fuerza`);
        if (agiMax > 0) parts.push(`+${(sp.agiBoostMin ?? agiMax).toString()}-${agiMax.toString()} Agilidad`);
        parts.push(`Maná ${sp.manaCost.toString()}`);
        if (sp.staCost > 0) parts.push(`Energía ${sp.staCost.toString()}`);
        const ownClass = entityVisuals.get(character.id)?.classId ?? 0;
        const entry = (CLASS_SPELLBOOK[ownClass] ?? []).find((e) => e.spellId === spellId);
        if (entry) parts.push(`Nivel ${entry.minLevel.toString()}`);
        if (sp.minSkill > 0) parts.push(`Skill magia ${sp.minSkill.toString()}`);
        const words = sp.magicWords ? ` «${sp.magicWords}»` : "";
        chat?.appendMessage({
          fromName: "",
          text: `${sp.name}${words} — ${parts.join(" · ")}`,
          timestamp: Date.now(),
          isSelf: false,
          kind: "global",
        });
      },
      onAddSpellMacro: (spellId) => {
        const ok = macroBar?.addSpellToFirstFree(spellId) ?? false;
        const sp = getAoSpell(spellId);
        chat?.appendMessage({
          fromName: "",
          text: ok
            ? `«${sp?.name ?? "Hechizo"}» agregado a la barra de macros.`
            : "No hay slots de macro libres.",
          timestamp: Date.now(),
          isSelf: false,
          kind: "global",
        });
      },
      onOpenStats: () => {
        const panel = root.querySelector<HTMLElement>(".ao-stats-panel");
        if (panel) panel.classList.toggle("ao-stats-panel--open");
      },
      onOpenKeys: () => {
        keyConfig?.open();
      },
      onOpenQuests: () => {
        questsUi?.toggleLog();
      },
      onChangeCharacter: () => {
        // Pasa por el timer de salida del server (instantáneo en zona segura).
        client?.send({ op: ClientToServerOp.Quit } satisfies QuitRequest);
      },
      onOpenParty: () => {
        chat?.appendMessage({ fromName: "", text: "Party: Alt+click en un jugador para invitarlo. /salirparty para salir.", timestamp: Date.now(), isSelf: false, kind: "global" });
      },
      onOpenClanes: () => {
        chat?.appendMessage({ fromName: "", text: "Clanes: /fundarclan <nombre> (nv25+Liderazgo90) · /invitarclan <nombre> · /cmsg <texto> · /onlineclan.", timestamp: Date.now(), isSelf: false, kind: "global" });
      },
      onOpenWorldMap: () => {
        worldMap?.open(currentMapId);
      },
    });

    // Minimapa DENTRO del box de vitales del panel (diseño Arte 3).
    minimap = mountMinimap(inventory.getMinimapSlot());
    worldMap = mountWorldMap(frame);

    macroBar = mountMacroBar(macroSlot, character.name, {
      resolveIcon: (grh) => tileset.entry(grh),
      getItems: () => macroInventory,
      getSpells: () => macroSpellIds,
      onTrigger: (slot) => {
        if (slot.kind === "item") {
          // Equipo → equipar directo; usables → flujo Usar completo (las
          // herramientas arman el modo de trabajo, martillo abre herrería).
          const def = getItem(slot.id);
          if (def?.type === "weapon" && def.ranged) {
            // Arco: si está equipado, el macro CARGA una flecha; si no, equipa.
            if (selfEquippedWeapon === slot.id) nockArrow();
            else client?.send({ op: ClientToServerOp.UseItem, item: slot.id } satisfies UseItemRequest);
          } else if (def && EQUIP_TYPES.has(def.type)) {
            client?.send({ op: ClientToServerOp.UseItem, item: slot.id } satisfies UseItemRequest);
          } else {
            useItemAction(slot.id);
          }
        } else if (slot.kind === "skill") {
          const pkt: UseSkillRequest = {
            op: ClientToServerOp.UseSkill,
            skillId: slot.id,
            targetId: undefined,
          };
          client?.send(pkt);
        } else if (slot.kind === "command") {
          // Acción custom: se envía como chat/comando (ej. /meditar).
          const text = slot.command?.trim();
          if (text) client?.send({ op: ClientToServerOp.ChatSend, text } satisfies ChatSend);
        } else {
          // Hechizo: armar el modo casteo (click en el objetivo lanza).
          setArmedSpell(slot.id);
        }
      },
      // Persistir la config de macros en el server (no se pierde al reloguear).
      onSave: (slots) => {
        client?.send({ op: ClientToServerOp.SaveMacros, macros: slots });
      },
    }, character.macros as ReadonlyArray<MacroSlot | null> | undefined);

    shop = mountShop(frame, {
      onBuy: (item, qty) => {
        const pkt: ShopBuyRequest = { op: ClientToServerOp.ShopBuy, item, qty };
        client?.send(pkt);
      },
      onSell: (item, qty) => {
        const pkt: ShopSellRequest = { op: ClientToServerOp.ShopSell, item, qty };
        client?.send(pkt);
      },
      resolveIcon: (grh) => tileset.entry(grh),
    });

    bank = mountBank(frame, {
      onDepositItem: (item, qty) => {
        const pkt: BankDepositItemRequest = {
          op: ClientToServerOp.BankDepositItem,
          item,
          qty,
        };
        client?.send(pkt);
      },
      onWithdrawItem: (item, qty) => {
        const pkt: BankWithdrawItemRequest = {
          op: ClientToServerOp.BankWithdrawItem,
          item,
          qty,
        };
        client?.send(pkt);
      },
      onDepositGold: (amount) => {
        const pkt: BankDepositGoldRequest = {
          op: ClientToServerOp.BankDepositGold,
          amount,
        };
        client?.send(pkt);
      },
      onWithdrawGold: (amount) => {
        const pkt: BankWithdrawGoldRequest = {
          op: ClientToServerOp.BankWithdrawGold,
          amount,
        };
        client?.send(pkt);
      },
      resolveIcon: (grh) => tileset.entry(grh),
    });

    // El toast de invitación se monta en el stage (flota sobre el mundo); el
    // panel de party lo relocalizamos al slot del panel derecho (Arte 1).
    partyUi = mountPartyUi(viewportBox, {
      onAcceptInvite: () => {
        const pkt: PartyAcceptRequest = { op: ClientToServerOp.PartyAccept };
        client?.send(pkt);
      },
      onDeclineInvite: () => {
        // El servidor expira la invitación automáticamente. No enviar nada.
      },
      onLeave: () => {
        const pkt: PartyLeaveRequest = { op: ClientToServerOp.PartyLeave };
        client?.send(pkt);
      },
    });
    const partyPanelEl = stageEl.querySelector<HTMLElement>(".ao-party");
    if (partyPanelEl && inventory) inventory.getPartySlot().appendChild(partyPanelEl);

    tradeUi = mountTrade(frame, {
      onAccept: () => {
        const pkt: TradeAcceptMsg = { op: ClientToServerOp.TradeAccept };
        client?.send(pkt);
      },
      onAddItem: (item, qty) => {
        const pkt: TradeAddItemMsg = { op: ClientToServerOp.TradeAddItem, item, qty };
        client?.send(pkt);
      },
      onSetGold: (amount) => {
        const pkt: TradeSetGoldMsg = { op: ClientToServerOp.TradeSetGold, amount };
        client?.send(pkt);
      },
      onConfirm: () => {
        const pkt: TradeConfirmMsg = { op: ClientToServerOp.TradeConfirm };
        client?.send(pkt);
      },
      onCancel: () => {
        const pkt: TradeCancelMsg = { op: ClientToServerOp.TradeCancel };
        client?.send(pkt);
      },
      resolveIcon: (grh) => tileset.entry(grh),
    });

    statsPanel = mountStatsPanel(frame, (stat) => {
      const pkt: AllocStatRequest = { op: ClientToServerOp.AllocStat, stat };
      client?.send(pkt);
    });

    touchControls = mountTouchControls(root, {
      onDirDown: (dir) => {
        holdKey(DIR_TO_CODE[dir]);
        tryStep(dir);
      },
      onDirUp: (dir) => {
        releaseKey(DIR_TO_CODE[dir]);
      },
      onAttack: () => {
        tryAttack();
      },
    });

    chat = mountChat({
      parent: chatSlot,
      selfCharacterName: character.name,
      onSend: (text) => {
        if (!client) return;
        // Comandos del AO clásico.
        const cmd = text.trim().toLowerCase();
        // /salir → pedir salir al server (instantáneo en zona segura, cuenta
        // regresiva en zona insegura). El server responde ExitOk cuando corresponde.
        if (cmd === "/salir") { client?.send({ op: ClientToServerOp.Quit } satisfies QuitRequest); return; }
        // /est y /stats → estadísticas completas (como el /EST de AO Libre).
        // Lo resuelve el server (tiene toda la data: defensas de equipo, etc.).
        if (cmd === "/est" || cmd === "/stats") {
          client.send({ op: ClientToServerOp.ChatSend, text: cmd } satisfies ChatSend);
          return;
        }
        // /ayuda → lista de comandos disponibles.
        if (cmd === "/ayuda") {
          chat?.appendMessage({ fromName: "", text: "Comandos: /salir · /est · /desc <texto> · /online · /uptime · /motd · /gritar <texto> · /gm <texto> · /meditar · /descansar · /seg · /hogar · /ocultarse · /domar · /amigos · /w <nombre> <msg> · /fundarclan <nombre> · /invitarclan <nombre> · /aceptarclan · /salirclan · /cmsg <msg>", timestamp: Date.now(), isSelf: false, kind: "global" });
          return;
        }
        if (cmd === "/seg") {
          client.send({ op: ClientToServerOp.SafeToggle } satisfies SafeToggleRequest);
          return;
        }
        if (cmd === "/descansar") {
          client.send({ op: ClientToServerOp.Rest } satisfies RestToggle);
          return;
        }
        if (cmd === "/meditar") {
          client.send({ op: ClientToServerOp.Meditate } satisfies MeditateToggle);
          return;
        }
        if (cmd === "/hogar") {
          client.send({ op: ClientToServerOp.GoHome } satisfies GoHomeRequest);
          return;
        }
        // Clanes (modGuilds.bas)
        if (cmd === "/aceptarclan") {
          client.send({ op: ClientToServerOp.GuildAccept });
          return;
        }
        if (cmd === "/salirclan") {
          client.send({ op: ClientToServerOp.GuildLeave });
          return;
        }
        if (cmd === "/onlineclan") {
          client.send({ op: ClientToServerOp.GuildOnline });
          return;
        }
        const guildCreate = /^\/fundarclan\s+(.+)$/i.exec(text.trim());
        if (guildCreate) {
          client.send({ op: ClientToServerOp.GuildCreate, name: guildCreate[1]! });
          return;
        }
        const guildInvite = /^\/invitarclan\s+(\S+)$/i.exec(text.trim());
        if (guildInvite) {
          client.send({ op: ClientToServerOp.GuildInvite, targetName: guildInvite[1]! });
          return;
        }
        const guildMsg = /^\/cmsg\s+(.+)$/i.exec(text);
        if (guildMsg) {
          client.send({ op: ClientToServerOp.GuildMessage, text: guildMsg[1]! });
          return;
        }
        // Ocultarse (skill del AO)
        if (cmd === "/ocultarse") {
          client.send({ op: ClientToServerOp.Hide });
          return;
        }
        // Domar animales (junto a la criatura, radio 2)
        if (cmd === "/domar") {
          client.send({ op: ClientToServerOp.Tame });
          return;
        }
        // Amigos
        if (cmd === "/amigos") {
          client.send({ op: ClientToServerOp.FriendList });
          return;
        }
        const friendAdd = /^\/addamigo\s+(\S+)$/i.exec(text.trim());
        if (friendAdd) {
          client.send({ op: ClientToServerOp.FriendAdd, name: friendAdd[1]! });
          return;
        }
        const friendDel = /^\/delamigo\s+(\S+)$/i.exec(text.trim());
        if (friendDel) {
          client.send({ op: ClientToServerOp.FriendRemove, name: friendDel[1]! });
          return;
        }
        // /w nombre mensaje  →  whisper privado
        const whisperMatch = /^\/w\s+(\S+)\s+(.+)$/i.exec(text);
        if (whisperMatch) {
          const pkt: WhisperSendRequest = {
            op: ClientToServerOp.WhisperSend,
            targetName: whisperMatch[1]!,
            text: whisperMatch[2]!,
          };
          client.send(pkt);
          return;
        }
        const packet: ChatSend = {
          op: ClientToServerOp.ChatSend,
          text,
        };
        client.send(packet);
      },
    });

  }

  console.log(`[ao-client] sesión iniciada para ${character.name} (id=${character.id})`);

  // Referencia futura cuando agreguemos mini-map / culling por viewport.
  void mapHeight;
  void (null as EntityId | null);

  return {
    destroy: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      app.ticker.remove(tick);
      chat?.destroy();
      playerList?.destroy();
      inventory?.destroy();
      shop?.destroy();
      bank?.destroy();
      partyUi?.destroy();
      tradeUi?.destroy();
      statsPanel?.destroy();
      macroBar?.destroy();
      keyConfig?.destroy();
      minimap?.destroy();
      worldMap?.destroy();
      castBanner.remove();
      deathPanel.remove();
      blindOverlay.remove();
      npcInfoEl?.remove();
      audio.onChange = null;
      musicEl?.pause();
      rainAudio?.pause();
      rainEl?.remove();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      frame.remove();
      craftUi?.destroy();
      questsUi?.destroy();
      criminalBadge?.remove();
      touchControls?.destroy();
      client?.destroy();
      app.destroy(true, { children: true });
      return Promise.resolve();
    },
  };
}
