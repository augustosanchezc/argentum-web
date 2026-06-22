import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/auth": "http://localhost:3000",
      "/characters": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
