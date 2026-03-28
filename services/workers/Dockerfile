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
RUN pnpm --filter @constchat/workers build

# Workers uses Prisma client — generate it while devDependencies are available
# Prisma schema lives in services/api but workers references @prisma/client
COPY services/api/prisma ./services/workers/prisma
RUN cd services/workers && npx prisma generate --schema=prisma/schema.prisma

# Create flat deployment
RUN pnpm --filter @constchat/workers deploy --prod /app/deploy
RUN cp -r /app/services/workers/dist /app/deploy/dist
RUN cp -r /app/services/workers/prisma /app/deploy/prisma
# Copy the already-generated Prisma client into deploy dir
RUN cp -r /app/services/workers/node_modules/.prisma /app/deploy/node_modules/.prisma
RUN cp -r /app/services/workers/node_modules/@prisma/client /app/deploy/node_modules/@prisma/client

# ── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 1001 swiip
RUN useradd --system --uid 1001 --gid swiip swiip

COPY --from=builder --chown=swiip:swiip /app/deploy ./

USER swiip

CMD ["node", "dist/index.js"]
