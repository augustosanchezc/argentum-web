# Programas necesarios para el proyecto

Lista completa de software a instalar para desarrollar el servidor web de Argentum Online.

## 1. Núcleo de desarrollo (obligatorio)

| Programa | Para qué | Link / instalación en Windows |
|---|---|---|
| **Git** | Control de versiones | https://git-scm.com/download/win |
| **Node.js LTS (≥ 20.x)** | Runtime del backend y frontend | https://nodejs.org/ — incluye npm |
| **pnpm** | Gestor de paquetes (más rápido que npm) | `npm install -g pnpm` |
| **Visual Studio Code** | Editor principal | https://code.visualstudio.com/ |
| **Windows Terminal** | Terminal moderna (PowerShell 7) | Microsoft Store |
| **PowerShell 7** | Shell recomendada | https://github.com/PowerShell/PowerShell |

### Extensiones recomendadas para VS Code
- ESLint
- Prettier
- TypeScript Vue Plugin (Volar) o Svelte for VS Code (según framework)
- GitLens
- Error Lens
- Tailwind CSS IntelliSense (si se usa Tailwind)
- Prisma (si se usa Prisma como ORM)

## 2. Bases de datos

| Programa | Para qué |
|---|---|
| **PostgreSQL 16** | Datos persistentes (cuentas, personajes, items). https://www.postgresql.org/download/windows/ |
| **Redis** | Estado en memoria, sesiones, pub/sub. En Windows usar **Memurai** o WSL2 con Redis nativo. |
| **DBeaver** o **pgAdmin** | Cliente gráfico de base de datos |

Alternativa: **Docker Desktop** y levantar PostgreSQL + Redis con `docker compose`. Recomendado fuertemente para no contaminar el sistema.

## 3. Contenedores e infraestructura

| Programa | Para qué |
|---|---|
| **Docker Desktop** | Contenerizar servicios (DB, Redis, server). https://www.docker.com/products/docker-desktop/ |
| **WSL2 (Ubuntu)** | Subsistema Linux para Windows. `wsl --install` desde PowerShell admin. |

## 4. Diseño gráfico y arte

| Programa | Para qué |
|---|---|
| **Aseprite** | Pixel-art y animación de sprites (estética AO). https://www.aseprite.org/ — paga, también compilable libre desde fuente. |
| **Tiled Map Editor** | Edición de mapas en grilla. https://www.mapeditor.org/ |
| **Figma** (web, sin instalar) | Wireframes, mockups, sistema de diseño. Opcional: app de escritorio. |
| **GIMP** o **Photoshop** | Edición de imágenes generales (banners, marketing). https://www.gimp.org/ |
| **TexturePacker** | Generación de spritesheets/atlas. https://www.codeandweb.com/texturepacker |
| **Audacity** | Edición de efectos de sonido y música. https://www.audacityteam.org/ |

## 5. APIs y testing

| Programa | Para qué |
|---|---|
| **Postman** o **Insomnia** | Probar endpoints HTTP/WebSocket. https://www.postman.com/ |
| **Bruno** | Alternativa open-source local-first a Postman. https://www.usebruno.com/ |
| **wscat** (CLI) | Cliente WebSocket por terminal: `npm install -g wscat` |

## 6. Referencia y código original

- **Repositorio AO Libre (servidor original VB6 / forks):** https://github.com/ao-libre
  - Clonar `Servidor-Argentum` y `Cliente-Argentum` aunque solo sea como referencia.
- Forks modernos a estudiar (Java, C#, Kotlin, Rust): buscar "Argentum Online" en GitHub y revisar licencias antes de reutilizar código o assets.

## 7. Comunicación y gestión

| Herramienta | Para qué |
|---|---|
| **GitHub** (o GitLab) | Hosting de repositorio, issues, PRs, Projects para backlog |
| **Discord** | Comunicación con jugadores beta y comunidad |
| **Notion** o **Obsidian** | Documentación interna (alternativa: archivos `.md` en `docs/`) |

## 8. Opcionales según evolución

| Programa | Cuándo |
|---|---|
| **Grafana + Prometheus** | Monitoreo del servidor en producción |
| **Sentry** | Tracking de errores en producción (cliente y servidor) |
| **k6** | Load testing del servidor de juego |
| **Cloudflare Tunnel / ngrok** | Exponer dev server para testing remoto |

## Orden recomendado de instalación

1. Git
2. Node.js LTS + pnpm
3. VS Code + extensiones
4. Docker Desktop (instala WSL2 si hace falta)
5. Postman/Bruno
6. Aseprite y Tiled cuando arranque la fase de arte
7. Cuenta de GitHub y crear el repo del proyecto

## Verificación post-instalación

```powershell
git --version
node --version
pnpm --version
docker --version
code --version
```

Todos deben responder con su versión sin error.
