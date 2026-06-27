import { Application, Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import {
  ClientToServerOp,
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AnyPacket,
  type ChatBroadcast,
  type ChatError,
  type ChatSend,
  type Direction,
  type EntityDespawn,
  type EntityId,
  type EntitySpawn,
  type EntityUpdate,
  type MapData,
  type MoveRequest,
  type Vector2,
} from "@ao/shared";
import type { CharacterSummary } from "../api";
import { getToken } from "../auth";
import { ReconnectingClient, type ClientStatus } from "../net/ws";
import { mountChat, type ChatHandle } from "../ui/chat";
import { Tileset } from "../world/tileset";

const TILE_SIZE = 32;
const MOVE_COOLDOWN_MS = 200;
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

export interface GameSceneResult {
  destroy: () => Promise<void>;
}

interface EntityVisual {
  container: Container;
  position: Vector2; // tile destino (verdad logica)
  renderX: number;   // px actual (interpolado)
  renderY: number;
  tweenFromX: number;
  tweenFromY: number;
  tweenStart: number;
  tweenDuration: number;
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
  const entitiesLayer = new Container();
  world.addChild(tilesLayer);
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

  function centerStatus(): void {
    statusText.x = app.screen.width / 2;
    statusText.y = app.screen.height / 2;
  }
  centerStatus();

  // Tileset clásico del AO. Arrancamos la carga del índice en paralelo con
  // la conexión; renderTiles espera a que esté listo antes de dibujar.
  const tileset = new Tileset();
  const tilesetIndexReady = tileset.loadIndex().catch((err: unknown) => {
    console.warn("[ao-client] no se pudo cargar el tileset, se usa fallback de color", err);
  });

  const entityVisuals = new Map<number, EntityVisual>();
  let mapWidth = 0;
  let mapHeight = 0;
  let mapBlocked: ReadonlyArray<number> = [];

  function buildEntityVisual(name: string, isSelf: boolean): Container {
    const c = new Container();
    const g = new Graphics();
    const fillColor = isSelf ? 0xd4af37 : 0x6b9cd5;
    const strokeColor = isSelf ? 0xf4d56a : 0x9bc6f1;
    g.circle(0, 0, 12)
      .fill({ color: fillColor })
      .stroke({ width: 2, color: strokeColor });
    c.addChild(g);

    const label = new Text({
      text: name,
      style: new TextStyle({
        fill: isSelf ? "#f5e6c8" : "#e8dfc8",
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

    return c;
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
  ): EntityVisual {
    const container = buildEntityVisual(name, isSelf);
    const c = entityCenterPx(pos);
    container.x = c.x;
    container.y = c.y;
    entitiesLayer.addChild(container);
    const visual: EntityVisual = {
      container,
      position: { x: pos.x, y: pos.y },
      renderX: c.x,
      renderY: c.y,
      tweenFromX: c.x,
      tweenFromY: c.y,
      tweenStart: 0,
      tweenDuration: 0,
    };
    entityVisuals.set(id, visual);
    return visual;
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
      addEntity(entId, ent.position, ent.name, isSelf);
    }
  }

  async function applyMapData(data: MapData): Promise<void> {
    await renderTiles(data);
    renderEntities(data);
    statusText.visible = false;
    centerCameraOnSelf();
  }

  // Lookup local de walkability — para la prediccion optimista.
  // Coincide con la verdad del server (blocked[] viene en MAP_DATA).
  function isWalkableLocal(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return false;
    return mapBlocked[y * mapWidth + x] === 0;
  }

  // -- Movimiento --
  let client: ReconnectingClient | null = null;
  let chat: ChatHandle | null = null;
  let lastLocalMoveAt = 0;
  let moveSequence = 0;
  const keysHeld = new Set<string>();

  function tryStep(direction: Direction): void {
    if (!client) return;
    const now = performance.now();
    if (now - lastLocalMoveAt < MOVE_COOLDOWN_MS) return;
    const own = entityVisuals.get(character.id);
    if (!own) return;

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
        v.container.x = v.renderX;
        v.container.y = v.renderY;
        if (t >= 1) v.tweenDuration = 0;
      }
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

  function handleEntityUpdate(p: EntityUpdate): void {
    const id = p.id as unknown as number;
    const existing = entityVisuals.get(id);
    if (!existing) {
      // Llego un update de algo que no conocemos — lo creamos.
      // Sucede si nos perdimos el spawn (race en reconexion).
      addEntity(id, p.position, `?${id.toString()}`, id === character.id);
      return;
    }
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
    addEntity(id, p.position, p.name, id === character.id);
  }

  function handleEntityDespawn(p: EntityDespawn): void {
    removeEntity(p.id as unknown as number);
  }

  const onResize = (): void => {
    centerStatus();
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
      client?.destroy();
      app.destroy(true, { children: true });
      return Promise.resolve();
    },
  };
}
