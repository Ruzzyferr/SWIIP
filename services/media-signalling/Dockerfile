# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY services/media-signalling/package.json ./services/media-signalling/

RUN pnpm install --frozen-lockfile --filter @constchat/media-signalling...

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY --from=deps /app ./

COPY tsconfig.base.json ./
COPY packages/protocol ./packages/protocol
COPY packages/config ./packages/config
COPY services/media-signalling ./services/media-signalling

RUN pnpm --filter @constchat/protocol build
RUN pnpm --filter @constchat/config build
RUN cd services/media-signalling && npx tsc

# Create flat deployment
RUN pnpm --filter @constchat/media-signalling deploy --prod /app/deploy
RUN cp -r /app/services/media-signalling/dist /app/deploy/dist

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 constchat
RUN adduser --system --uid 1001 constchat

COPY --from=builder --chown=constchat:constchat /app/deploy ./

USER constchat
EXPOSE 4002

CMD ["node", "dist/index.js"]
