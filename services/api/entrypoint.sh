#!/bin/sh
set -e

# If "migrate" is passed as CMD, run migrations only and exit
if [ "$1" = "migrate" ]; then
  echo "[entrypoint] Running Prisma migrations (migrate-only mode)..."
  node ./node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma
  echo "[entrypoint] Migrations complete — exiting."
  exit 0
fi

# Default: run migrations, then start the API server
echo "[entrypoint] Running Prisma migrations..."
node ./node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma
echo "[entrypoint] Migrations applied successfully"

echo "[entrypoint] Starting API server..."
exec node dist/services/api/src/main.js
