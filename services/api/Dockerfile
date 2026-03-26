# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/protocol/package.json ./packages/protocol/
COPY packages/config/package.json ./packages/config/
COPY services/api/package.json ./services/api/

RUN pnpm install --frozen-lockfile --filter @constchat/api...

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
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
# Copy built artifacts and prisma into deploy dir
RUN cp -r /app/services/api/dist /app/deploy/dist
RUN cp -r /app/services/api/prisma /app/deploy/prisma
# Copy prisma client generated output
RUN cp -r /app/services/api/node_modules/.prisma /app/deploy/node_modules/.prisma 2>/dev/null || true
RUN cp -r /app/node_modules/.prisma /app/deploy/node_modules/.prisma 2>/dev/null || true

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 constchat
RUN adduser --system --uid 1001 constchat

COPY --from=builder --chown=constchat:constchat /app/deploy ./

USER constchat
EXPOSE 4000

CMD ["node", "dist/main.js"]
