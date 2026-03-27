# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/protocol/package.json ./packages/protocol/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter @constchat/web...

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY --from=deps /app ./

COPY tsconfig.base.json ./
COPY packages/design-tokens ./packages/design-tokens
COPY packages/protocol ./packages/protocol
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GATEWAY_URL
ARG NEXT_PUBLIC_CDN_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @constchat/design-tokens build
RUN pnpm --filter @constchat/web build
# Ensure public dir exists for COPY
RUN mkdir -p /app/apps/web/public

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 constchat
RUN adduser --system --uid 1001 constchat

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=constchat:constchat /app/apps/web/.next/standalone ./
COPY --from=builder --chown=constchat:constchat /app/apps/web/.next/static ./.next/static

USER constchat
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
