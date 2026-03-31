# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY services/workers/package.json ./services/workers/

RUN pnpm install --frozen-lockfile --filter @constchat/workers...

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

COPY --from=deps /app ./

COPY tsconfig.base.json ./
COPY packages/design-tokens ./packages/design-tokens
COPY packages/protocol ./packages/protocol
COPY packages/config ./packages/config
COPY services/workers ./services/workers

RUN pnpm --filter @constchat/protocol build
RUN pnpm --filter @constchat/config build
COPY services/api/prisma ./services/workers/prisma
RUN pnpm --filter @constchat/workers build

# Find where Prisma client was actually generated (pnpm hoisting may vary)
RUN PRISMA_DIR=$(find /app -path "*/node_modules/.prisma/client" -type d | head -1) && \
    echo "Found .prisma at: $PRISMA_DIR" && \
    test -n "$PRISMA_DIR"

# Create flat deployment
RUN pnpm --filter @constchat/workers deploy --prod /app/deploy
RUN cp -r /app/services/workers/dist /app/deploy/dist
RUN cp -r /app/services/workers/prisma /app/deploy/prisma
# Copy generated Prisma client into ALL locations in deploy dir
# (pnpm's .pnpm structure may resolve .prisma from different paths)
RUN PRISMA_SRC=$(find /app -path "*/node_modules/.prisma/client" -not -path "/app/deploy/*" -type d | head -1) && \
    echo "Generated Prisma at: $PRISMA_SRC" && \
    test -n "$PRISMA_SRC" && \
    # Copy to top-level node_modules
    mkdir -p /app/deploy/node_modules/.prisma && \
    cp -r "$PRISMA_SRC" /app/deploy/node_modules/.prisma/client && \
    # Copy into every .prisma/client inside deploy's pnpm structure
    for target in $(find /app/deploy/node_modules -path "*/.prisma/client" -type d 2>/dev/null); do \
      echo "Overwriting: $target"; \
      rm -rf "$target"/*; \
      cp -r "$PRISMA_SRC"/* "$target"/; \
    done && \
    echo "Prisma client copied to all locations"

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 swiip
RUN useradd --system --uid 1001 --gid swiip swiip

COPY --from=builder --chown=swiip:swiip /app/deploy ./

USER swiip

CMD ["node", "dist/index.js"]
