import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
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

const TILE_SIZE = 32;
const MOVE_COOLDOWN_MS = 200;
// Velocidad de interpolacion visual: en cuanto tiempo el sprite recorre 1 tile.
// Debe ser <= MOVE_COOLDOWN_MS para que el sprite llegue al destino antes
// del siguiente paso y no se vea "atrasado".
const TWEEN_DURATION_MS = 180;

const TILE_COLORS: Record<number, number> = {
  0: 0x1d2a18, // grass — verde apagado
  1: 0x3a342a, // wall — gris piedra
  2: 0x1b3654, // water — azul profundo
};

const TILE_HIGHLIGHT: Record<number, number> = {
  0: 0x2b3f23,
  1: 0x4c453a,
  2: 0x255080,
};

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

  const entityVisuals = new Map<number, EntityVisual>();
  let mapWidth = 0;
  let mapHeight = 0;
  let mapTiles: ReadonlyArray<number> = [];

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

  function renderTiles(data: MapData): void {
    tilesLayer.removeChildren();
    mapWidth = data.width;
    mapHeight = data.height;
    mapTiles = data.tiles;

    // Optimizacion: agrupamos en un solo Graphics (PixiJS lo bachea bien).
    const g = new Graphics();
    for (let y = 0; y < data.height; y += 1) {
      for (let x = 0; x < data.width; x += 1) {
        const tile = data.tiles[y * data.width + x] ?? 0;
        const base = TILE_COLORS[tile] ?? TILE_COLORS[0]!;
        const hi = TILE_HIGHLIGHT[tile] ?? base;
        g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill({ color: base });
        // Borde sutil para que se note la grilla
        g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, 1).fill({ color: hi, alpha: 0.4 });
        g.rect(x * TILE_SIZE, y * TILE_SIZE, 1, TILE_SIZE).fill({ color: hi, alpha: 0.4 });
      }
    }
    tilesLayer.addChild(g);
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

  function applyMapData(data: MapData): void {
    renderTiles(data);
    renderEntities(data);
    statusText.visible = false;
    centerCameraOnSelf();
  }

  // Lookup local de walkability — para la prediccion optimista.
  // Tiene que coincidir con la del server (grass = caminable).
  function isWalkableLocal(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return false;
    const tile = mapTiles[y * mapWidth + x];
    return tile === 0;
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
        applyMapData(packet);
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

  // Variable se usa indirectamente vía mapTiles; mantenida como referencia
  // futura cuando agregemos mini-map (T-034+).
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
