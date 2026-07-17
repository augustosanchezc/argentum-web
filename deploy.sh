#!/usr/bin/env bash
# Deploy de producción (correr en el VPS, dentro de /srv/ao):
#   bash deploy.sh
# Baja los últimos cambios de GitHub, reconstruye el cliente y el servidor,
# y reinicia el stack. La base se sincroniza sola al arrancar el server
# (drizzle-kit push, ver Dockerfile). NO borra datos.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> git pull"
git pull --ff-only

echo "==> instalar deps y buildear el cliente"
corepack enable
pnpm install
pnpm --filter @ao/client build

echo "==> reconstruir y levantar el stack"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> estado"
docker compose -f docker-compose.prod.yml ps
echo "==> deploy OK. Sitio: https://aotum.online"
