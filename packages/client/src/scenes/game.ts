import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  PROTOCOL_VERSION,
  ServerToClientOp,
  type AnyPacket,
  type EntityId,
  type MapData,
  type Vector2,
} from "@ao/shared";
import type { CharacterSummary } from "../api";
import { getToken } from "../auth";
import { ReconnectingClient, type ClientStatus } from "../net/ws";

const TILE_SIZE = 32;

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

export interface GameSceneResult {
  destroy: () => Promise<void>;
}

interface EntityVisual {
  container: Container;
  position: Vector2;
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

  function centerStatus(): void {
    statusText.x = app.screen.width / 2;
    statusText.y = app.screen.height / 2;
  }
  centerStatus();

  const entityVisuals = new Map<number, EntityVisual>();
  let mapWidth = 0;
  let mapHeight = 0;

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

  function centerCameraOnSelf(): void {
    const own = entityVisuals.get(character.id);
    if (!own) return;
    const c = entityCenterPx(own.position);
    world.x = app.screen.width / 2 - c.x;
    world.y = app.screen.height / 2 - c.y;
  }

  function renderTiles(data: MapData): void {
    tilesLayer.removeChildren();
    mapWidth = data.width;
    mapHeight = data.height;

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
    entityVisuals.clear();

    for (const ent of data.entities) {
      const entId = ent.id as unknown as number;
      const isSelf = entId === character.id;
      const visual = buildEntityVisual(ent.name, isSelf);
      const c = entityCenterPx(ent.position);
      visual.x = c.x;
      visual.y = c.y;
      entitiesLayer.addChild(visual);
      entityVisuals.set(entId, { container: visual, position: { x: ent.position.x, y: ent.position.y } });
    }
  }

  function applyMapData(data: MapData): void {
    renderTiles(data);
    renderEntities(data);
    statusText.visible = false;
    centerCameraOnSelf();
  }

  const onResize = (): void => {
    centerStatus();
    if (mapWidth > 0) centerCameraOnSelf();
  };
  app.renderer.on("resize", onResize);

  // Conexion WebSocket
  const token = getToken();
  let client: ReconnectingClient | null = null;
  let authExpiredHandled = false;

  if (!token) {
    statusText.text = "Sin token — volvé a iniciar sesión.";
    statusText.style.fill = "#c93838";
    onAuthExpired();
  } else {
    client = new ReconnectingClient({
      token,
      characterId: character.id,
      onPacket: (packet: AnyPacket) => {
        if (packet.op === ServerToClientOp.MapData) {
          applyMapData(packet);
        } else {
          // Otros opcodes llegan en T-031+
          console.log("[ws] packet recibido:", packet);
        }
      },
      onStatus: (status: ClientStatus) => {
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
  }

  console.log(`[ao-client] sesión iniciada para ${character.name} (id=${character.id})`);

  // Suprimimos warning de variable no usada hasta que el render real de
  // entidades cambie de posicion (T-031+ ENTITY_UPDATE).
  void mapHeight;
  void (null as EntityId | null);

  return {
    destroy: () => {
      client?.destroy();
      app.destroy(true, { children: true });
      return Promise.resolve();
    },
  };
}
