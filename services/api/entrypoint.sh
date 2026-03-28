#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
node ./node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma
echo "[entrypoint] Migrations applied successfully"

echo "[entrypoint] Starting API server..."
exec node dist/services/api/src/main.js
