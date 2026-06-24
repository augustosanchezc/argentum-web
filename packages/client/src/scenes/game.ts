import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { PROTOCOL_VERSION, type AnyPacket } from "@ao/shared";
import type { CharacterSummary } from "../api";
import { getToken } from "../auth";
import { ReconnectingClient, type ClientStatus } from "../net/ws";

export interface GameSceneResult {
  destroy: () => Promise<void>;
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

  const cellSize = 40;
  const grid = new Graphics();

  function drawGrid(): void {
    grid.clear();
    grid.setStrokeStyle({ width: 1, color: 0x2a2218, alpha: 0.6 });
    for (let x = 0; x < app.screen.width; x += cellSize) {
      grid.moveTo(x, 0).lineTo(x, app.screen.height);
    }
    for (let y = 0; y < app.screen.height; y += cellSize) {
      grid.moveTo(0, y).lineTo(app.screen.width, y);
    }
    grid.stroke();
  }
  drawGrid();
  app.stage.addChild(grid);

  const center = new Container();
  center.x = app.screen.width / 2;
  center.y = app.screen.height / 2;
  app.stage.addChild(center);

  const avatar = new Graphics();
  avatar.circle(0, 0, 18).fill({ color: 0xd4af37 });
  avatar.circle(0, 0, 18).stroke({ width: 2, color: 0xf4d56a });
  center.addChild(avatar);

  const nameStyle = new TextStyle({
    fill: "#f5e6c8",
    fontFamily: "Georgia, serif",
    fontSize: 18,
    fontWeight: "bold",
    align: "center",
  });
  const nameLabel = new Text({ text: character.name, style: nameStyle });
  nameLabel.anchor.set(0.5);
  nameLabel.y = -36;
  center.addChild(nameLabel);

  const statusStyle = new TextStyle({
    fill: "#a89c80",
    fontFamily: "Segoe UI, sans-serif",
    fontSize: 14,
    align: "center",
  });
  const statusText = new Text({ text: "Conectando al servidor...", style: statusStyle });
  statusText.anchor.set(0.5);
  statusText.y = 50;
  center.addChild(statusText);

  const onResize = (): void => {
    drawGrid();
    center.x = app.screen.width / 2;
    center.y = app.screen.height / 2;
  };
  app.renderer.on("resize", onResize);

  // Conexion WebSocket via ReconnectingClient
  const token = getToken();
  let client: ReconnectingClient | null = null;
  let authExpiredHandled = false;

  if (!token) {
    statusText.text = "Sin token. Volvé a iniciar sesión.";
    statusText.style.fill = "#c93838";
    onAuthExpired();
  } else {
    client = new ReconnectingClient({
      token,
      characterId: character.id,
      onPacket: (packet: AnyPacket) => {
        // Por ahora solo logueamos los paquetes recibidos post-handshake.
        // En T-026+ entran MAP_DATA, ENTITY_UPDATE, etc.
        console.log("[ws] packet recibido:", packet);
      },
      onStatus: (status: ClientStatus) => {
        switch (status.kind) {
          case "connecting":
            statusText.text = "Conectando al servidor...";
            statusText.style.fill = "#a89c80";
            break;
          case "connected":
            statusText.text = `Sesión activa · protocolo v${PROTOCOL_VERSION}\nMapa y movimiento llegan en T-025+`;
            statusText.style.fill = "#4cb87e";
            break;
          case "reconnecting":
            statusText.text = `Conexión perdida — reintentando ${status.attempt}/3 en ${Math.round(status.nextDelayMs / 1000)}s...`;
            statusText.style.fill = "#c97b1f";
            break;
          case "failed":
            statusText.text = `Sesión terminada: ${status.reason}`;
            statusText.style.fill = "#c93838";
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

  return {
    destroy: () => {
      client?.destroy();
      app.destroy(true, { children: true });
      return Promise.resolve();
    },
  };
}
