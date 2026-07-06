# ADR-008 — Infraestructura de producción: VPS + Docker + Caddy

**Fecha:** 2026-07-06  
**Estado:** Aceptado  
**Relacionado con:** ADR-002 (stack)

---

## Contexto

El proyecto necesita una forma de desplegar el servidor + cliente de manera reproducible, segura y económica. Los requisitos son:

- TLS automático (Let's Encrypt).
- WebSockets en el mismo dominio que el cliente (sin CORS extra).
- PostgreSQL y Redis persistentes (no serverless).
- Costo mensual razonable para un proyecto hobby (< 15 USD/mes).
- Deploy repetible con un solo comando.

---

## Decisión

**Stack de producción:**

| Componente | Tecnología | Justificación |
|---|---|---|
| VPS | Hetzner CX22 (2 vCPU, 4 GB RAM) | €4/mes, datacenter EU, SSD NVMe |
| Reverse proxy | Caddy 2 | TLS automático con ACME, config mínima, soporte nativo WebSocket |
| Orquestación | Docker Compose v2 | Sin Kubernetes overhead; suficiente para single-node |
| Servidor | `ghcr.io/usuario/ao-server` | Build multi-stage (Node 22 Alpine) |
| Cliente | Archivos estáticos servidos por Caddy | Sin servidor de frontend separado |
| Base de datos | `postgres:16-alpine` | Volumen Docker persistente |
| Cache | `redis:7-alpine` | Volumen Docker persistente |
| Observabilidad | `prom/prometheus` + `grafana/grafana` | Stack estándar OSS, en el mismo compose |

---

## Arquitectura de red

```
Internet
   │  443 (HTTPS/WSS)
   ▼
[Caddy]  ←→  /api/*  →  [ao-server:3000]
             /ws       →  [ao-server:3000]
             /*        →  /srv/client (estáticos)
   │
   ├── [postgres:5432]  (red interna Docker)
   └── [redis:6379]     (red interna Docker)
```

Caddy termina TLS y hace proxy hacia el contenedor del servidor. Los archivos del cliente se sirven directamente desde Caddy (sin un contenedor de nginx adicional). PostgreSQL y Redis **no** exponen puertos al host.

---

## Deploy

```bash
# Primera vez
ssh usuario@vps
git clone https://github.com/usuario/ao-server /srv/ao
cd /srv/ao
cp .env.prod.example .env.prod
# editar .env.prod con los valores reales
docker compose -f docker-compose.prod.yml up -d

# Actualizar
git pull
docker compose -f docker-compose.prod.yml build ao-server
docker compose -f docker-compose.prod.yml up -d --no-deps ao-server
```

---

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Railway / Render | Sin control sobre red interna; WebSockets requieren plan pago; más caro a largo plazo |
| AWS ECS / GCP Cloud Run | Overkill para un hobby; costo impredecible; no justifica la complejidad |
| nginx en lugar de Caddy | Config manual de TLS; Caddy hace lo mismo con cero config extra |
| kubernetes (k3s) | Sin justificación de escala; añade complejidad operacional innecesaria |

---

## Consecuencias

**Buenas:**
- Un solo archivo `docker-compose.prod.yml` describe todo el stack.
- TLS gestionado automáticamente por Caddy.
- Caddy y el servidor comparten red interna: WebSocket no necesita autenticación extra de origen.

**Malas:**
- Single point of failure: si el VPS cae, el juego cae. Aceptable en MVP.
- Backups de PostgreSQL son responsabilidad manual del operador (fuera del scope del MVP).
