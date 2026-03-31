# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS deps
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY services/gateway/package.json ./services/gateway/

RUN pnpm install --frozen-lockfile --filter @constchat/gateway...

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS builder
WORKDIR /app
RUN corepack enable

COPY --from=deps /app ./

COPY tsconfig.base.json ./
COPY packages/protocol ./packages/protocol
COPY packages/config ./packages/config
COPY services/gateway ./services/gateway

RUN pnpm --filter @constchat/protocol build
RUN pnpm --filter @constchat/config build
RUN cd services/gateway && npx tsc

# Create flat deployment
RUN pnpm --filter @constchat/gateway deploy --prod /app/deploy
RUN cp -r /app/services/gateway/dist /app/deploy/dist

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-trixie-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 swiip
RUN useradd --system --uid 1001 --gid swiip swiip

COPY --from=builder --chown=swiip:swiip /app/deploy ./

USER swiip
EXPOSE 4001

CMD ["node", "dist/index.js"]
