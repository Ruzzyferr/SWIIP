# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY services/api/package.json ./services/api/

RUN pnpm install --frozen-lockfile --filter @constchat/api...

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY --from=deps /app ./

COPY tsconfig.base.json ./
COPY packages/design-tokens ./packages/design-tokens
COPY packages/protocol ./packages/protocol
COPY packages/config ./packages/config
COPY services/api ./services/api

RUN pnpm --filter @constchat/protocol build
RUN pnpm --filter @constchat/config build
RUN pnpm --filter @constchat/api build

# Create flat deployment with resolved node_modules (no pnpm symlinks)
RUN pnpm --filter @constchat/api deploy --prod /app/deploy
# Copy built artifacts and prisma schema into deploy dir
RUN cp -r /app/services/api/dist /app/deploy/dist
RUN cp -r /app/services/api/prisma /app/deploy/prisma
# Copy generated Prisma client into ALL locations in deploy dir
RUN PRISMA_SRC=$(find /app -path "*/node_modules/.prisma/client" -not -path "/app/deploy/*" -type d | head -1) && \
    echo "Generated Prisma at: $PRISMA_SRC" && \
    test -n "$PRISMA_SRC" && \
    mkdir -p /app/deploy/node_modules/.prisma && \
    cp -r "$PRISMA_SRC" /app/deploy/node_modules/.prisma/client && \
    for target in $(find /app/deploy/node_modules -path "*/.prisma/client" -type d 2>/dev/null); do \
      echo "Overwriting: $target"; \
      rm -rf "$target"/*; \
      cp -r "$PRISMA_SRC"/* "$target"/; \
    done && \
    echo "Prisma client copied to all locations"
# Copy prisma CLI so entrypoint can run migrations without npx downloading latest
RUN PRISMA_CLI=$(find /app -path "*/node_modules/prisma" -not -path "/app/deploy/*" -type d | head -1) && \
    PRISMA_ENGINES=$(find /app -path "*/node_modules/@prisma/engines" -not -path "/app/deploy/*" -type d | head -1) && \
    test -n "$PRISMA_CLI" && \
    cp -r "$PRISMA_CLI" /app/deploy/node_modules/prisma && \
    test -n "$PRISMA_ENGINES" && cp -r "$PRISMA_ENGINES" /app/deploy/node_modules/@prisma/engines || true

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 swiip
RUN useradd --system --uid 1001 --gid swiip swiip

COPY --from=builder --chown=swiip:swiip /app/deploy ./
COPY --chown=swiip:swiip services/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER swiip
EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
