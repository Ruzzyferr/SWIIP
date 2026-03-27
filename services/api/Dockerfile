# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY services/api/package.json ./services/api/

RUN pnpm install --frozen-lockfile --filter @constchat/api...

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY --from=deps /app ./

COPY tsconfig.base.json ./
COPY packages/design-tokens ./packages/design-tokens
COPY packages/protocol ./packages/protocol
COPY packages/config ./packages/config
COPY services/api ./services/api

RUN pnpm --filter @constchat/protocol build
RUN pnpm --filter @constchat/config build
RUN pnpm --filter @constchat/api build
RUN cd services/api && npx prisma generate

# Create flat deployment with resolved node_modules (no pnpm symlinks)
RUN pnpm --filter @constchat/api deploy --prod /app/deploy
# Copy built artifacts and prisma schema into deploy dir
RUN cp -r /app/services/api/dist /app/deploy/dist
RUN cp -r /app/services/api/prisma /app/deploy/prisma
# Re-generate Prisma client inside deploy dir so engine binaries match the runner
RUN cd /app/deploy && npx prisma generate --schema=prisma/schema.prisma

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 swiip
RUN useradd --system --uid 1001 --gid swiip swiip

COPY --from=builder --chown=swiip:swiip /app/deploy ./

USER swiip
EXPOSE 4000

CMD ["node", "dist/src/main.js"]
