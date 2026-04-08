# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Swiip (internal package scope: `@constchat`) is a real-time communication platform. It's a **pnpm monorepo** orchestrated by **Turborepo**.

## Common Commands

```bash
# Development
pnpm dev                              # Start all services
pnpm --filter @constchat/web dev      # Web only (:3000)
pnpm --filter @constchat/api dev      # API only (:4000)
pnpm --filter @constchat/gateway dev  # Gateway only (:4001)

# Quality
pnpm lint                             # ESLint across all packages
pnpm typecheck                        # TypeScript check all packages
pnpm test                             # Run all tests
pnpm test:e2e                         # Playwright E2E tests
pnpm format:check                     # Prettier check

# Database (run from services/api/)
pnpm db:generate                      # Generate Prisma client
pnpm db:migrate                       # Run dev migrations
pnpm db:migrate:deploy                # Production migrations
pnpm db:seed                          # Seed test data
pnpm db:studio                        # Prisma Studio UI

# Infrastructure
docker compose -f infra/docker/docker-compose.yml up -d  # Start Postgres, Redis, NATS, MinIO, Meilisearch, LiveKit
```

## Architecture

### Monorepo Layout

- **`apps/web`** — Next.js 15 (App Router, React 19, Tailwind, next-intl for i18n)
- **`apps/mobile`** — React Native + Expo 52
- **`apps/desktop`** — Electron 33 (embeds web standalone build)
- **`services/api`** — NestJS 10 + Fastify, Prisma ORM → PostgreSQL, S3 uploads, Meilisearch
- **`services/gateway`** — uWebSockets.js WebSocket server, Redis pub/sub for fan-out
- **`services/media-signalling`** — LiveKit SFU integration for voice/video/screen share
- **`services/workers`** — NATS JetStream consumers (notifications, search indexing, thumbnails)
- **`packages/protocol`** — WebSocket opcodes and event type definitions
- **`packages/shared`** — Zustand stores, API client, shared types (used by web + mobile)
- **`packages/design-tokens`** — Theme tokens (colors, typography, spacing)
- **`packages/ui-primitives`** — Shared UI component library
- **`packages/config`** — Zod-validated configuration schemas

### Data Flow

1. Client → **API** (HTTPS REST) → validates, writes to PostgreSQL
2. API publishes events to **NATS** + **Redis**
3. **Workers** consume NATS for async jobs
4. **Gateway** subscribes to Redis, fans out to connected WebSocket clients

### Key Technical Details

- **Permissions**: 64-bit BigInt bitmask. Resolution order: guild owner → ADMINISTRATOR → role union → channel overwrites. Explicit deny beats explicit allow.
- **Auth**: JWT access tokens (15min) + rotating opaque refresh tokens (30d, Redis-backed). TOTP MFA via otplib.
- **Gateway protocol**: Binary WebSocket with heartbeat (41.25s interval), session resume (5min window via Redis Streams).
- **State management**: Zustand + Immer on all frontends. Shared stores in `@constchat/shared/stores`.
- **Design system**: Custom Tailwind + CSS variables (NOT shadcn/Mantine/Chakra). 5-level surface depth, emerald accent. See `DESIGN_SYSTEM.md`.

### Prisma Schema

Located at `services/api/prisma/schema.prisma`. Core entities: User, Guild, GuildMember, Channel (TEXT/VOICE/DM/FORUM/THREAD/ANNOUNCEMENT), Message, Role, PermissionOverwrite, ReadState, AuditLog.

## Code Style

- **TypeScript**: Strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ES2022 target
- **Prettier**: 100 char width, single quotes, trailing commas, 2-space indent, LF line endings
- **Package aliases**: `@constchat/shared`, `@constchat/protocol`, `@constchat/design-tokens`, etc.

## Test Accounts (seeded)

- alice@constchat.dev / password123 (Admin)
- bob@constchat.dev / password123 (Member)

## Additional Documentation

- `ARCHITECTURE.md` — Detailed service topology, database schema, gateway protocol
- `DESIGN_SYSTEM.md` — Color system, typography, component philosophy
- `SECURITY.md` — Auth flows, token architecture, MFA, rate limiting
