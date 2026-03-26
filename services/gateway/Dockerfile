# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY services/gateway/package.json ./services/gateway/

RUN pnpm install --frozen-lockfile --filter @constchat/gateway...

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY --from=deps /app ./

COPY tsconfig.base.json ./
COPY packages/protocol ./packages/protocol
COPY packages/config ./packages/config
COPY services/gateway ./services/gateway

RUN pnpm --filter @constchat/protocol build
RUN pnpm --filter @constchat/config build
RUN cd services/gateway && npx tsc

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 constchat
RUN adduser --system --uid 1001 constchat

COPY --from=builder --chown=constchat:constchat /app/services/gateway/dist ./dist
COPY --from=builder --chown=constchat:constchat /app/services/gateway/node_modules ./node_modules
COPY --from=builder --chown=constchat:constchat /app/packages/protocol/dist ./node_modules/@constchat/protocol/dist
COPY --from=builder --chown=constchat:constchat /app/packages/protocol/package.json ./node_modules/@constchat/protocol/package.json
COPY --from=builder --chown=constchat:constchat /app/packages/config/dist ./node_modules/@constchat/config/dist
COPY --from=builder --chown=constchat:constchat /app/packages/config/package.json ./node_modules/@constchat/config/package.json

USER constchat
EXPOSE 4001

CMD ["node", "dist/services/gateway/src/index.js"]
