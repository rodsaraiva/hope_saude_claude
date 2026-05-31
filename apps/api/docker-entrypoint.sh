#!/bin/sh
set -e

# Aplica migrations pendentes antes de subir a API (idempotente).
echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] iniciando API..."
exec node dist/main.js
