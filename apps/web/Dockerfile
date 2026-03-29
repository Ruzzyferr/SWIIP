# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

# Copy all source first, then install — avoids pnpm symlink breakage
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
# Other workspace package.json's needed for lockfile resolution
COPY apps/desktop/package.json ./apps/desktop/package.json
COPY services/api/package.json ./services/api/package.json
COPY services/gateway/package.json ./services/gateway/package.json
COPY services/media-signalling/package.json ./services/media-signalling/package.json
COPY services/workers/package.json ./services/workers/package.json

RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GATEWAY_URL
ARG NEXT_PUBLIC_CDN_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @constchat/design-tokens build
RUN pnpm --filter @constchat/web build
RUN mkdir -p /app/apps/web/public

# ── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 constchat
RUN adduser --system --uid 1001 constchat

COPY --from=builder --chown=constchat:constchat /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=constchat:constchat /app/apps/web/.next/standalone ./
COPY --from=builder --chown=constchat:constchat /app/apps/web/.next/static ./apps/web/.next/static

# pnpm standalone output only copies .pnpm store — recreate top-level symlinks
# Handles both regular packages (next) and scoped packages (@prisma/client)
RUN cd /app/node_modules && \
    for pkg in .pnpm/*/node_modules/[!@]*; do \
      [ -d "$pkg" ] || continue; \
      name="$(basename "$pkg")"; \
      [ -e "$name" ] || ln -s "/app/node_modules/$pkg" "$name"; \
    done && \
    for scope in .pnpm/*/node_modules/@*; do \
      [ -d "$scope" ] || continue; \
      scope_name="$(basename "$scope")"; \
      for pkg in "$scope"/*; do \
        [ -d "$pkg" ] || continue; \
        mkdir -p "$scope_name"; \
        link="$scope_name/$(basename "$pkg")"; \
        [ -e "$link" ] || ln -s "/app/node_modules/$pkg" "$link"; \
      done; \
    done

USER constchat
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
