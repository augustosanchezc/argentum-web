import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    // Dev: nunca cachear en el navegador (evita que quede pegado un CSS/JS viejo).
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
    proxy: {
      "/auth": "http://localhost:3000",
      "/characters": "http://localhost:3000",
      "/health": "http://localhost:3000",
      "/maps": "http://localhost:3000",
      "/item-overrides": "http://localhost:3000",
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
