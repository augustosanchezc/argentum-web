import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { PROTOCOL_VERSION } from "@ao/shared";
import type { CharacterSummary } from "../api";

export interface GameSceneResult {
  destroy: () => Promise<void>;
}

export async function startGameScene(
  root: HTMLElement,
  character: CharacterSummary,
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

  // Fondo: grilla sutil tipo placeholder de mapa
  const grid = new Graphics();
  const cellSize = 40;
  grid.setStrokeStyle({ width: 1, color: 0x2a2218, alpha: 0.6 });
  const w = app.screen.width;
  const h = app.screen.height;
  for (let x = 0; x < w; x += cellSize) {
    grid.moveTo(x, 0).lineTo(x, h);
  }
  for (let y = 0; y < h; y += cellSize) {
    grid.moveTo(0, y).lineTo(w, y);
  }
  grid.stroke();
  app.stage.addChild(grid);

  // Avatar placeholder en el centro
  const center = new Container();
  center.x = w / 2;
  center.y = h / 2;
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

  // Stub message
  const stubStyle = new TextStyle({
    fill: "#a89c80",
    fontFamily: "Segoe UI, sans-serif",
    fontSize: 14,
    align: "center",
  });
  const stubText = new Text({
    text: `Stub de mundo · protocolo v${PROTOCOL_VERSION}\nMovimiento y WebSocket llegan en T-021+`,
    style: stubStyle,
  });
  stubText.anchor.set(0.5);
  stubText.y = 50;
  center.addChild(stubText);

  // Reubicación en resize
  const onResize = (): void => {
    center.x = app.screen.width / 2;
    center.y = app.screen.height / 2;
    grid.clear();
    grid.setStrokeStyle({ width: 1, color: 0x2a2218, alpha: 0.6 });
    for (let x = 0; x < app.screen.width; x += cellSize) {
      grid.moveTo(x, 0).lineTo(x, app.screen.height);
    }
    for (let y = 0; y < app.screen.height; y += cellSize) {
      grid.moveTo(0, y).lineTo(app.screen.width, y);
    }
    grid.stroke();
  };
  app.renderer.on("resize", onResize);

  console.log(`[ao-client] sesión iniciada para ${character.name} (id=${character.id})`);

  return {
    destroy: () => {
      app.destroy(true, { children: true });
      return Promise.resolve();
    },
  };
}
