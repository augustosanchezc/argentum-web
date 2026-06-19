import { Application, Text, TextStyle } from "pixi.js";
import { PROTOCOL_VERSION } from "@ao/shared";

async function bootstrap(): Promise<void> {
  const app = new Application();
  await app.init({
    background: "#0d0a07",
    resizeTo: window,
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  const root = document.getElementById("app");
  if (!root) throw new Error("No se encontro el contenedor #app");
  root.appendChild(app.canvas);

  const style = new TextStyle({
    fill: "#d4af37",
    fontFamily: "Georgia, serif",
    fontSize: 28,
    align: "center",
  });

  const title = new Text({
    text: `Argentum Online — Web\nprotocolo v${PROTOCOL_VERSION}`,
    style,
  });
  title.anchor.set(0.5);
  title.x = app.screen.width / 2;
  title.y = app.screen.height / 2;
  app.stage.addChild(title);

  app.renderer.on("resize", () => {
    title.x = app.screen.width / 2;
    title.y = app.screen.height / 2;
  });

  console.log(`[ao-client] arrancado — protocolo v${PROTOCOL_VERSION}`);
}

bootstrap().catch((err) => {
  console.error("[ao-client] bootstrap fallido:", err);
});
