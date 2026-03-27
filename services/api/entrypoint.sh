#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy --schema ./prisma/schema.prisma
echo "[entrypoint] Migrations applied successfully"

echo "[entrypoint] Starting API server..."
exec node dist/src/main.js
