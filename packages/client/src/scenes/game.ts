import { Application, Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import {
  ClientToServerOp,
  getItem,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AnyPacket,
  type AttackRequest,
  type ChatBroadcast,
  type ChatError,
  type ChatSend,
  type Damage,
  type Death,
  type Direction,
  type DropItemRequest,
  type EntityDespawn,
  type EntityId,
  type EntityKind,
  type EntitySpawn,
  type EntityUpdate,
  type InteractRequest,
  type InventoryReorderRequest,
  type InventoryUpdate,
  type MapData,
  type MoveRequest,
  type PickupRequest,
  type Respawn,
  type ShopBuyRequest,
  type ShopOpen,
  type ShopSellRequest,
  type StatsUpdate,
  type UseItemRequest,
  type Vector2,
} from "@ao/shared";
import type { CharacterSummary } from "../api";
import { getToken } from "../auth";
import { ReconnectingClient, type ClientStatus } from "../net/ws";
import { mountChat, type ChatHandle } from "../ui/chat";
import { mountInventory, type InventoryHandle } from "../ui/inventory";
import { mountPlayerList, type PlayerListHandle } from "../ui/player-list";
import { mountShop, type ShopHandle } from "../ui/shop";
import { mountTouchControls, type TouchControlsHandle } from "../ui/touch-controls";
import { Tileset } from "../world/tileset";

const TILE_SIZE = 32;
const MOVE_COOLDOWN_MS = 200;
// Espejo del cooldown autoritativo del server (combat.ts). El cliente lo
// aplica localmente para no spamear paquetes ni la animación de swing.
const ATTACK_COOLDOWN_MS = 800;
// Duración de la animación de golpe y del número de daño flotante.
const SWING_DURATION_MS = 160;
const FLOATER_DURATION_MS = 800;
// Velocidad de interpolacion visual: en cuanto tiempo el sprite recorre 1 tile.
// Debe ser <= MOVE_COOLDOWN_MS para que el sprite llegue al destino antes
// del siguiente paso y no se vea "atrasado".
const TWEEN_DURATION_MS = 180;

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

const KEY_TO_DIRECTION: Record<string, Direction> = {
  KeyW: "north",
  ArrowUp: "north",
  KeyS: "south",
  ArrowDown: "south",
  KeyA: "west",
  ArrowLeft: "west",
  KeyD: "east",
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
  body: Graphics;    // figura humana (la redibujamos al cambiar direccion / morir)
  hpBar: Graphics;   // barra de HP sobre la cabeza (la redibujamos)
  position: Vector2; // tile destino (verdad logica)
  renderX: number;   // px actual (interpolado)
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
  // Animacion de golpe: lunge en la direccion swingDx/swingDy.
  swingStart: number; // 0 = sin swing
  swingDx: number;
  swingDy: number;
}

// Numero de daño que sube y se desvanece sobre una entidad.
interface Floater {
  text: Text;
  startY: number;
  start: number;
}

export async function startGameScene(
  root: HTMLElement,
  character: CharacterSummary,
  onAuthExpired: () => void,
): Promise<GameSceneResult> {
  const app = new Application();
  await app.init({
    background: "#0a0805",
    resizeTo: window,
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  root.appendChild(app.canvas);

  // Contenedor del mundo: tiles + entidades. Lo movemos para emular camara.
  const world = new Container();
  app.stage.addChild(world);

  const tilesLayer = new Container();
  const groundLayer = new Container();
  const entitiesLayer = new Container();
  world.addChild(tilesLayer);
  world.addChild(groundLayer);
  world.addChild(entitiesLayer);

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
  app.stage.addChild(hud);

  // -- HUD de combate: barra de HP propia, abajo a la izquierda --
  const HP_BAR_W = 220;
  const HP_BAR_H = 18;
  const hpBarBg = new Graphics();
  const hpBarFg = new Graphics();
  const hpBarText = new Text({
    text: "",
    style: new TextStyle({
      fill: "#f5e6c8",
      fontFamily: "Consolas, monospace",
      fontSize: 12,
      fontWeight: "bold",
      stroke: { color: "#0a0805", width: 3 },
    }),
  });
  hpBarText.anchor.set(0.5);
  app.stage.addChild(hpBarBg, hpBarFg, hpBarText);

  // Barra de XP + nivel, justo encima de la de HP.
  const XP_BAR_H = 8;
  const xpBarBg = new Graphics();
  const xpBarFg = new Graphics();
  const levelText = new Text({
    text: "Nivel 1",
    style: new TextStyle({
      fill: "#f4d56a",
      fontFamily: "Consolas, monospace",
      fontSize: 12,
      fontWeight: "bold",
      stroke: { color: "#0a0805", width: 3 },
    }),
  });
  app.stage.addChild(xpBarBg, xpBarFg, levelText);

  // -- Overlay de muerte: gris translucido sobre toda la pantalla --
  const deathOverlay = new Graphics();
  const deathText = new Text({
    text: "Has muerto",
    style: new TextStyle({
      fill: "#e8dfc8",
      fontFamily: "Georgia, serif",
      fontSize: 40,
      fontWeight: "bold",
      align: "center",
      stroke: { color: "#0a0805", width: 5 },
    }),
  });
  deathText.anchor.set(0.5);
  deathOverlay.visible = false;
  deathText.visible = false;
  app.stage.addChild(deathOverlay, deathText);

  function layoutCombatHud(): void {
    const x = 16;
    const y = app.screen.height - HP_BAR_H - 16;
    hpBarBg.x = x;
    hpBarBg.y = y;
    hpBarFg.x = x;
    hpBarFg.y = y;
    hpBarText.x = x + HP_BAR_W / 2;
    hpBarText.y = y + HP_BAR_H / 2;

    const xpY = y - XP_BAR_H - 4;
    xpBarBg.x = x;
    xpBarBg.y = xpY;
    xpBarFg.x = x;
    xpBarFg.y = xpY;
    levelText.x = x + HP_BAR_W + 10;
    levelText.y = xpY - 4;

    deathOverlay.clear();
    deathOverlay
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: 0x12100b, alpha: 0.55 });
    deathText.x = app.screen.width / 2;
    deathText.y = app.screen.height / 2;
  }

  function updateSelfHud(): void {
    const own = entityVisuals.get(character.id);
    if (!own) return;
    const frac = own.maxHp > 0 ? Math.max(0, Math.min(1, own.hp / own.maxHp)) : 0;
    hpBarBg.clear();
    hpBarBg.rect(0, 0, HP_BAR_W, HP_BAR_H).fill({ color: 0x0a0805, alpha: 0.85 });
    hpBarBg.rect(0, 0, HP_BAR_W, HP_BAR_H).stroke({ width: 1, color: 0x4d432d });
    hpBarFg.clear();
    const color = frac > 0.5 ? 0x4cb87e : frac > 0.25 ? 0xd4af37 : 0xc93838;
    if (frac > 0) {
      hpBarFg.rect(1, 1, (HP_BAR_W - 2) * frac, HP_BAR_H - 2).fill({ color });
    }
    hpBarText.text = `HP ${own.hp.toString()} / ${own.maxHp.toString()}`;
  }

  function updateXpHud(level: number, xpInto: number, xpForNext: number): void {
    levelText.text = `Nivel ${level.toString()}`;
    xpBarBg.clear();
    xpBarBg.rect(0, 0, HP_BAR_W, XP_BAR_H).fill({ color: 0x0a0805, alpha: 0.85 });
    xpBarBg.rect(0, 0, HP_BAR_W, XP_BAR_H).stroke({ width: 1, color: 0x4d432d });
    xpBarFg.clear();
    const frac = xpForNext > 0 ? Math.max(0, Math.min(1, xpInto / xpForNext)) : 1;
    if (frac > 0) {
      xpBarFg.rect(1, 1, (HP_BAR_W - 2) * frac, XP_BAR_H - 2).fill({ color: 0x6b8cff });
    }
  }

  function showDeathOverlay(): void {
    deathOverlay.visible = true;
    deathText.visible = true;
  }

  function hideDeathOverlay(): void {
    deathOverlay.visible = false;
    deathText.visible = false;
  }

  function centerStatus(): void {
    statusText.x = app.screen.width / 2;
    statusText.y = app.screen.height / 2;
  }
  centerStatus();
  layoutCombatHud();
  updateXpHud(1, 0, 1);

  // Tileset clásico del AO. Arrancamos la carga del índice en paralelo con
  // la conexión; renderTiles espera a que esté listo antes de dibujar.
  const tileset = new Tileset();
  const tilesetIndexReady = tileset.loadIndex().catch((err: unknown) => {
    console.warn("[ao-client] no se pudo cargar el tileset, se usa fallback de color", err);
  });

  const entityVisuals = new Map<number, EntityVisual>();
  const groundItemVisuals = new Map<number, Container>();
  let mapWidth = 0;
  let mapHeight = 0;
  let mapBlocked: ReadonlyArray<number> = [];

  // Dibuja la barra de HP de una entidad (coordenadas locales al container).
  function drawHpBar(g: Graphics, hp: number, maxHp: number): void {
    const w = 28;
    const h = 4;
    const x = -w / 2;
    const y = -30;
    const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    g.clear();
    g.rect(x - 1, y - 1, w + 2, h + 2).fill({ color: 0x0a0805, alpha: 0.75 });
    // Color por tramos: verde, ambar, rojo.
    const color = frac > 0.5 ? 0x4cb87e : frac > 0.25 ? 0xd4af37 : 0xc93838;
    if (frac > 0) {
      g.rect(x, y, w * frac, h).fill({ color });
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
    const bodyColor = isMerchant
      ? 0x2d7d5a
      : isNpc
        ? 0x8c3b2e
        : isSelf
          ? 0xa8862c
          : 0x4a6d8f;
    const bodyStroke = isMerchant
      ? 0x4cb87e
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
    hp: number,
    maxHp: number,
    kind: EntityKind,
    facing: Direction,
  ): { container: Container; body: Graphics; hpBar: Graphics } {
    const c = new Container();
    const body = new Graphics();
    drawEntityBody(body, isSelf, kind, facing);
    c.addChild(body);

    const labelFill =
      kind === "merchant" ? "#a7e0c4"
      : kind === "npc" ? "#e8b3a3"
      : isSelf ? "#f5e6c8"
      : "#e8dfc8";
    const label = new Text({
      text: name,
      style: new TextStyle({
        fill: labelFill,
        fontFamily: "Georgia, serif",
        fontSize: 12,
        fontWeight: "bold",
        align: "center",
        stroke: { color: "#0a0805", width: 3 },
      }),
    });
    label.anchor.set(0.5, 1);
    label.y = -16;
    c.addChild(label);

    const hpBar = new Graphics();
    drawHpBar(hpBar, hp, maxHp);
    c.addChild(hpBar);

    return { container: c, body, hpBar };
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
  ): EntityVisual {
    const { container, body, hpBar } = buildEntityVisual(name, isSelf, hp, maxHp, kind, facing);
    const c = entityCenterPx(pos);
    container.x = c.x;
    container.y = c.y;
    const dead = hp <= 0;
    if (dead) body.alpha = 0.35;
    // Los demas personajes son clickeables para atacarlos (ademas de Ctrl).
    if (!isSelf) {
      container.eventMode = "static";
      container.cursor = "crosshair";
      container.on("pointertap", () => {
        clickAttack(id);
      });
    }
    entitiesLayer.addChild(container);
    const visual: EntityVisual = {
      container,
      body,
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
      hp,
      maxHp,
      dead,
      facing,
      swingStart: 0,
      swingDx: 0,
      swingDy: 0,
    };
    entityVisuals.set(id, visual);
    return visual;
  }

  // Cambia la direccion en la que mira la entidad y redibuja el body.
  // No-op si el facing no cambio, para evitar el redraw en cada tick.
  function setEntityFacing(v: EntityVisual, facing: Direction): void {
    if (v.facing === facing) return;
    v.facing = facing;
    drawEntityBody(v.body, v.isSelf, v.kind, facing);
    if (v.dead) v.body.alpha = 0.35;
  }

  function moveEntityTo(id: number, pos: Vector2): void {
    const v = entityVisuals.get(id);
    if (!v) return;
    v.position = { x: pos.x, y: pos.y };
    v.tweenFromX = v.renderX;
    v.tweenFromY = v.renderY;
    v.tweenStart = performance.now();
    v.tweenDuration = TWEEN_DURATION_MS;
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

  function addGroundItemVisual(id: number, pos: Vector2, item: number): void {
    if (groundItemVisuals.has(id)) return;
    const def = getItem(item);
    const c = new Container();
    const g = new Graphics();
    g.rect(-6, -6, 12, 12)
      .fill({ color: 0xd4af37 })
      .stroke({ width: 1, color: 0xf4d56a });
    c.addChild(g);
    const label = new Text({
      text: def ? def.name : `#${item.toString()}`,
      style: new TextStyle({
        fill: "#f4d56a",
        fontFamily: "Consolas, monospace",
        fontSize: 10,
        stroke: { color: "#0a0805", width: 2 },
      }),
    });
    label.anchor.set(0.5, 1);
    label.y = -8;
    c.addChild(label);
    const px = entityCenterPx(pos);
    c.x = px.x;
    c.y = px.y;
    groundLayer.addChild(c);
    groundItemVisuals.set(id, c);
  }

  function removeGroundItemVisual(id: number): void {
    const c = groundItemVisuals.get(id);
    if (!c) return;
    groundLayer.removeChild(c);
    c.destroy({ children: true });
    groundItemVisuals.delete(id);
  }

  function clearGroundItems(): void {
    for (const c of groundItemVisuals.values()) c.destroy({ children: true });
    groundItemVisuals.clear();
    groundLayer.removeChildren();
  }

  // Recolecta los nombres de las entidades conocidas y refresca el panel
  // de jugadores online. El nombre se lee del label del container.
  function refreshPlayerList(): void {
    if (!playerList) return;
    const names: string[] = [];
    for (const [id, v] of entityVisuals) {
      if (v.kind !== "player") continue; // los NPCs no van en la lista de online
      const label = v.container.children.find((c) => c instanceof Text) as Text | undefined;
      names.push(label ? label.text : `#${id.toString()}`);
    }
    playerList.setPlayers(names);
  }

  function centerCameraOnSelf(): void {
    const own = entityVisuals.get(character.id);
    if (!own) return;
    world.x = app.screen.width / 2 - own.renderX;
    world.y = app.screen.height / 2 - own.renderY;
  }

  async function renderTiles(data: MapData): Promise<void> {
    tilesLayer.removeChildren();
    mapWidth = data.width;
    mapHeight = data.height;
    mapBlocked = data.blocked;

    // Esperamos el índice del tileset y precargamos los PNGs que usa este
    // mapa. Si el índice falló (offline / 404), tileset.ready es false y
    // caemos al fallback de color para todo el mapa.
    await tilesetIndexReady;
    if (tileset.ready) {
      const ids = new Set<number>();
      for (const g of data.graphic) {
        if (g) ids.add(g);
      }
      await tileset.preload(ids);
    }

    // Fallback de color: un solo Graphics con las celdas que no tienen
    // textura (grh 0 = vacío, o gráfico sin PNG). PixiJS lo bachea como un
    // mesh, así que aunque sean miles de celdas se dibuja de una.
    const fallback = new Graphics();
    tilesLayer.addChild(fallback);

    for (let y = 0; y < data.height; y += 1) {
      for (let x = 0; x < data.width; x += 1) {
        const idx = y * data.width + x;
        const graphic = data.graphic[idx] ?? 0;
        const tex = graphic ? tileset.get(graphic) : null;
        if (tex) {
          const sprite = new Sprite(tex);
          sprite.x = x * TILE_SIZE;
          sprite.y = y * TILE_SIZE;
          tilesLayer.addChild(sprite);
        } else {
          const blocked = (data.blocked[idx] ?? 0) === 1;
          const { base } = tileColors(graphic, blocked);
          fallback.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill({ color: base });
        }
      }
    }
  }

  function renderEntities(data: MapData): void {
    entitiesLayer.removeChildren();
    for (const v of entityVisuals.values()) {
      v.container.destroy({ children: true });
    }
    entityVisuals.clear();

    for (const ent of data.entities) {
      const entId = ent.id as unknown as number;
      const isSelf = entId === character.id;
      addEntity(entId, ent.position, ent.name, isSelf, ent.hp, ent.maxHp, ent.kind, ent.direction);
    }
    updateSelfHud();
  }

  async function applyMapData(data: MapData): Promise<void> {
    await renderTiles(data);
    renderEntities(data);
    clearGroundItems();
    for (const gi of data.groundItems) {
      addGroundItemVisual(gi.id as unknown as number, gi.position, gi.item);
    }
    refreshPlayerList();
    statusText.visible = false;
    centerCameraOnSelf();
  }

  // Lookup local de walkability — para la prediccion optimista.
  // Coincide con la verdad del server (blocked[] viene en MAP_DATA).
  function isWalkableLocal(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return false;
    return mapBlocked[y * mapWidth + x] === 0;
  }

  // -- Movimiento y combate --
  let client: ReconnectingClient | null = null;
  let chat: ChatHandle | null = null;
  let playerList: PlayerListHandle | null = null;
  let touchControls: TouchControlsHandle | null = null;
  let inventory: InventoryHandle | null = null;
  let shop: ShopHandle | null = null;
  let lastLocalMoveAt = 0;
  let moveSequence = 0;
  const keysHeld = new Set<string>();
  // Direccion a la que mira el personaje (define a quien golpea el ataque).
  let selfFacing: Direction = "south";
  let lastLocalAttackAt = 0;
  const floaters: Floater[] = [];

  function tryStep(direction: Direction): void {
    if (!client) return;
    // El facing se actualiza siempre que se intenta mover, aunque haya
    // cooldown o pared en frente — asi el ataque apunta a donde miramos.
    selfFacing = direction;
    const ownForFacing = entityVisuals.get(character.id);
    if (ownForFacing) setEntityFacing(ownForFacing, direction);
    const now = performance.now();
    if (now - lastLocalMoveAt < MOVE_COOLDOWN_MS) return;
    const own = entityVisuals.get(character.id);
    if (!own || own.dead) return;

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
    const delta = DELTAS[dir];
    v.swingStart = performance.now();
    v.swingDx = delta.x;
    v.swingDy = delta.y;
  }

  function tryAttack(): void {
    if (!client) return;
    const now = performance.now();
    if (now - lastLocalAttackAt < ATTACK_COOLDOWN_MS) return;
    const own = entityVisuals.get(character.id);
    if (!own || own.dead) return;

    lastLocalAttackAt = now;
    // Feedback inmediato: el swing siempre se anima, haya o no objetivo.
    playSwing(own, selfFacing);

    // Buscamos un objetivo vivo en el tile que tenemos en frente.
    const delta = DELTAS[selfFacing];
    const tx = own.position.x + delta.x;
    const ty = own.position.y + delta.y;
    let targetId: number | null = null;
    for (const [id, v] of entityVisuals) {
      if (id === character.id || v.dead) continue;
      if (v.position.x === tx && v.position.y === ty) {
        targetId = id;
        break;
      }
    }
    if (targetId === null) return;

    const packet: AttackRequest = {
      op: ClientToServerOp.Attack,
      targetId: targetId as unknown as EntityId,
    };
    client.send(packet);
  }

  // Clic sobre una entidad: si es comerciante, abrimos la tienda; si no,
  // atacamos (solo si es adyacente). Giramos hacia el objetivo.
  function clickAttack(targetId: number): void {
    if (!client) return;
    const target = entityVisuals.get(targetId);
    if (!target) return;

    if (target.kind === "merchant") {
      const interact: InteractRequest = {
        op: ClientToServerOp.Interact,
        targetId: targetId as unknown as EntityId,
      };
      client.send(interact);
      return;
    }

    const now = performance.now();
    if (now - lastLocalAttackAt < ATTACK_COOLDOWN_MS) return;
    const own = entityVisuals.get(character.id);
    if (!own || own.dead || target.dead) return;
    const dx = target.position.x - own.position.x;
    const dy = target.position.y - own.position.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return; // no adyacente

    selfFacing = dx === 1 ? "east" : dx === -1 ? "west" : dy === 1 ? "south" : "north";
    lastLocalAttackAt = now;
    playSwing(own, selfFacing);

    const packet: AttackRequest = {
      op: ClientToServerOp.Attack,
      targetId: targetId as unknown as EntityId,
    };
    client.send(packet);
  }

  function spawnFloater(x: number, y: number, label: string, color: string): void {
    const text = new Text({
      text: label,
      style: new TextStyle({
        fill: color,
        fontFamily: "Consolas, monospace",
        fontSize: 16,
        fontWeight: "bold",
        stroke: { color: "#0a0805", width: 3 },
      }),
    });
    text.anchor.set(0.5, 1);
    text.x = x;
    text.y = y - 18;
    entitiesLayer.addChild(text);
    floaters.push({ text, startY: text.y, start: performance.now() });
  }

  function pumpHeldKeys(): void {
    // Prioridad: vertical antes que horizontal (consistente con AO original).
    if (keysHeld.has("KeyW") || keysHeld.has("ArrowUp")) { tryStep("north"); return; }
    if (keysHeld.has("KeyS") || keysHeld.has("ArrowDown")) { tryStep("south"); return; }
    if (keysHeld.has("KeyA") || keysHeld.has("ArrowLeft")) { tryStep("west"); return; }
    if (keysHeld.has("KeyD") || keysHeld.has("ArrowRight")) { tryStep("east"); return; }
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    // Si el chat tiene foco, dejamos que el input se quede con todas
    // las teclas — no movemos al personaje ni capturamos WASD.
    if (chat?.isInputFocused()) return;
    // Ataque: Ctrl golpea al personaje que tenemos en frente.
    if (e.code === "ControlLeft" || e.code === "ControlRight") {
      e.preventDefault();
      tryAttack();
      return;
    }
    // G: agarrar item del suelo. I: abrir/cerrar inventario.
    if (e.code === "KeyG") {
      e.preventDefault();
      const pickup: PickupRequest = { op: ClientToServerOp.Pickup };
      client?.send(pickup);
      return;
    }
    if (e.code === "KeyI") {
      e.preventDefault();
      inventory?.toggle();
      return;
    }
    const dir = KEY_TO_DIRECTION[e.code];
    if (!dir) return;
    e.preventDefault();
    keysHeld.add(e.code);
    tryStep(dir);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (KEY_TO_DIRECTION[e.code]) {
      keysHeld.delete(e.code);
    }
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // -- Ticker: interpolacion + pump de teclas mantenidas --
  const tick = (): void => {
    const now = performance.now();
    for (const v of entityVisuals.values()) {
      if (v.tweenDuration > 0) {
        const t = Math.min(1, (now - v.tweenStart) / v.tweenDuration);
        const targetPx = entityCenterPx(v.position);
        v.renderX = v.tweenFromX + (targetPx.x - v.tweenFromX) * t;
        v.renderY = v.tweenFromY + (targetPx.y - v.tweenFromY) * t;
        if (t >= 1) v.tweenDuration = 0;
      }
      // Swing de ataque: lunge breve en la direccion del golpe, sumado
      // al render interpolado. Se aplica cada frame.
      let ox = 0;
      let oy = 0;
      if (v.swingStart > 0) {
        const st = (now - v.swingStart) / SWING_DURATION_MS;
        if (st >= 1) {
          v.swingStart = 0;
        } else {
          const k = Math.sin(st * Math.PI) * 8;
          ox = v.swingDx * k;
          oy = v.swingDy * k;
        }
      }
      v.container.x = v.renderX + ox;
      v.container.y = v.renderY + oy;
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
    pumpHeldKeys();
    if (mapWidth > 0) centerCameraOnSelf();
  };
  app.ticker.add(tick);

  // -- Handlers de paquetes del server --
  function handlePacket(packet: AnyPacket): void {
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
      case ServerToClientOp.GroundItemSpawn:
        addGroundItemVisual(packet.id as unknown as number, packet.position, packet.item);
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
      default:
        // LoginResponse ya lo consumio el handshake; nada mas que hacer.
        break;
    }
  }

  function handleChatBroadcast(p: ChatBroadcast): void {
    chat?.appendMessage({
      fromName: p.fromName,
      text: p.text,
      timestamp: p.timestamp,
      isSelf: (p.fromId as unknown as number) === character.id,
    });
  }

  function handleChatError(p: ChatError): void {
    chat?.showError(p.reason);
  }

  function handleDamage(p: Damage): void {
    const targetId = p.targetId as unknown as number;
    const attackerId = p.attackerId as unknown as number;
    const target = entityVisuals.get(targetId);
    const targetIsSelf = targetId === character.id;
    const attackerIsSelf = attackerId === character.id;

    if (target) {
      target.hp = p.hp;
      target.maxHp = p.maxHp;
      drawHpBar(target.hpBar, target.hp, target.maxHp);
      // Numero de daño sobre el objetivo: rojo si lo recibo yo, verde si
      // lo inflijo yo, neutro si es entre terceros.
      const color = targetIsSelf ? "#ff5555" : attackerIsSelf ? "#7cfc8a" : "#e8dfc8";
      spawnFloater(target.renderX, target.renderY, `-${p.amount.toString()}`, color);
    }

    // Swing del atacante (el propio ya lo animo localmente al enviar).
    if (!attackerIsSelf && target) {
      const attacker = entityVisuals.get(attackerId);
      if (attacker) {
        const dx = Math.sign(target.position.x - attacker.position.x);
        const dy = Math.sign(target.position.y - attacker.position.y);
        const dir: Direction =
          dx === 1 ? "east" : dx === -1 ? "west" : dy === -1 ? "north" : "south";
        playSwing(attacker, dir);
      }
    }

    if (targetIsSelf) updateSelfHud();
  }

  function handleDeath(p: Death): void {
    const id = p.id as unknown as number;
    const v = entityVisuals.get(id);
    if (v) {
      v.dead = true;
      v.hp = 0;
      v.body.alpha = 0.35;
      drawHpBar(v.hpBar, 0, v.maxHp);
    }
    if (id === character.id) {
      showDeathOverlay();
      updateSelfHud();
    }
  }

  function handleInventoryUpdate(p: InventoryUpdate): void {
    inventory?.setData({
      gold: p.gold,
      slots: p.slots,
      equippedWeapon: p.equippedWeapon,
      equippedArmor: p.equippedArmor,
    });
  }

  function handleShopOpen(p: ShopOpen): void {
    shop?.open(p.offers);
  }

  function handleStatsUpdate(p: StatsUpdate): void {
    // Sincroniza HP propio (p. ej. curación al subir de nivel) y la barra de XP.
    const own = entityVisuals.get(character.id);
    if (own) {
      own.hp = p.hp;
      own.maxHp = p.maxHp;
      drawHpBar(own.hpBar, own.hp, own.maxHp);
      updateSelfHud();
    }
    updateXpHud(p.level, p.xp, p.xpForNextLevel);
  }

  function handleRespawn(p: Respawn): void {
    const id = p.id as unknown as number;
    const v = entityVisuals.get(id);
    if (v) {
      v.dead = false;
      v.hp = p.hp;
      v.maxHp = p.maxHp;
      v.body.alpha = 1;
      drawHpBar(v.hpBar, v.hp, v.maxHp);
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
      addEntity(id, p.position, `?${id.toString()}`, id === character.id, 1, 1, "player", p.direction);
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
    if (entityVisuals.has(id)) return; // ya lo teniamos (MAP_DATA inicial)
    addEntity(id, p.position, p.name, id === character.id, p.hp, p.maxHp, p.kind, p.direction);
    refreshPlayerList();
  }

  function handleEntityDespawn(p: EntityDespawn): void {
    removeEntity(p.id as unknown as number);
    refreshPlayerList();
  }

  const onResize = (): void => {
    centerStatus();
    layoutCombatHud();
    if (mapWidth > 0) centerCameraOnSelf();
  };
  app.renderer.on("resize", onResize);

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

    playerList = mountPlayerList(root);

    inventory = mountInventory(root, {
      onUse: (item) => {
        const pkt: UseItemRequest = { op: ClientToServerOp.UseItem, item };
        client?.send(pkt);
      },
      onSell: (item) => {
        const pkt: ShopSellRequest = { op: ClientToServerOp.ShopSell, item };
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
    });

    shop = mountShop(root, {
      onBuy: (item) => {
        const pkt: ShopBuyRequest = { op: ClientToServerOp.ShopBuy, item };
        client?.send(pkt);
      },
    });

    touchControls = mountTouchControls(root, {
      onDirDown: (dir) => {
        keysHeld.add(DIR_TO_CODE[dir]);
        tryStep(dir);
      },
      onDirUp: (dir) => {
        keysHeld.delete(DIR_TO_CODE[dir]);
      },
      onAttack: () => {
        tryAttack();
      },
    });

    chat = mountChat({
      parent: root,
      selfCharacterName: character.name,
      onSend: (text) => {
        if (!client) return;
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
      touchControls?.destroy();
      client?.destroy();
      app.destroy(true, { children: true });
      return Promise.resolve();
    },
  };
}
