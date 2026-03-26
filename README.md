# ConstChat

**Next-generation real-time communication platform.** Discord-level scope, original visual identity, production-grade architecture.

---

## What is ConstChat?

ConstChat is a full-featured communication platform providing:

- **Text messaging** — servers, channels, DMs, group DMs, threads, forums
- **Voice & video** — WebRTC-based rooms, screen sharing (target: 1080p60)
- **Rich moderation** — roles, permissions, audit logs, automod, reports
- **Developer platform** — webhooks, bot framework foundation
- **Original design** — premium dark interface, not a Discord skin

---

## Repository Structure

```
constchat/
├── apps/
│   ├── web/                  # Next.js 14 web application
│   ├── desktop/              # Tauri desktop application
│   └── mobile/               # React Native mobile app
├── services/
│   ├── api/                  # NestJS REST API (Fastify)
│   ├── gateway/              # WebSocket real-time gateway
│   ├── media-signalling/     # LiveKit / WebRTC signalling
│   └── workers/              # Background job processors
├── packages/
│   ├── design-tokens/        # Brand color/spacing/motion tokens
│   ├── ui-primitives/        # Shared React primitives
│   ├── protocol/             # Typed WebSocket event contracts
│   └── config/               # Zod-validated service configs
├── infra/
│   ├── docker/               # Docker Compose (dev + prod)
│   └── k8s/                  # Kubernetes manifests
└── docs/
    ├── product/              # Product specs per screen
    ├── architecture/         # Architecture decision records
    └── runbooks/             # Operational runbooks
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | Next.js 14 (App Router), React 18, Zustand, Framer Motion |
| Desktop | Tauri 2 (Rust + WebView) |
| Mobile | React Native / Expo |
| API | NestJS + Fastify, Prisma ORM |
| Real-time Gateway | Node.js + uWebSockets.js |
| Database | PostgreSQL 16 |
| Cache / Presence | Redis 7 |
| Event Bus | NATS JetStream |
| Search | Meilisearch |
| Object Storage | S3-compatible (MinIO in dev) |
| Media / SFU | LiveKit (WebRTC) |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Sentry |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/yourorg/constchat
cd constchat
pnpm install
```

### 2. Start infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts: PostgreSQL, Redis, NATS, MinIO (S3), Meilisearch.

### 3. Set up environment files

```bash
cp services/api/.env.example services/api/.env
cp services/gateway/.env.example services/gateway/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Edit each `.env` file with your local values (defaults work with Docker Compose).

### 4. Run database migrations and seed

```bash
cd services/api
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Start development servers

```bash
# From repo root — starts all services in parallel
pnpm dev
```

Individual services:

```bash
pnpm --filter @constchat/api dev        # API at :4000
pnpm --filter @constchat/gateway dev    # Gateway at :4001
pnpm --filter @constchat/web dev        # Web at :3000
```

### 6. Open the app

Visit [http://localhost:3000](http://localhost:3000)

Seed credentials:
- `alice@constchat.dev` / `password123` (Admin)
- `bob@constchat.dev` / `password123` (Member)

---

## Development URLs

| Service | URL |
|---|---|
| Web App | http://localhost:3000 |
| API | http://localhost:4000 |
| API Docs (Swagger) | http://localhost:4000/api/docs |
| WebSocket Gateway | ws://localhost:4001 |
| MinIO Console | http://localhost:9001 (minioadmin/minioadmin) |
| Meilisearch | http://localhost:7700 |
| NATS Monitor | http://localhost:8222 |

Observability (run with `--profile observability`):
| Service | URL |
|---|---|
| Grafana | http://localhost:3001 (admin/admin) |
| Prometheus | http://localhost:9090 |

---

## Architecture Overview

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

### Service Boundaries

```
Browser/Desktop/Mobile
        │
        ├── HTTPS ──→ [API Service :4000]
        │               ├── Auth, Profiles, Guilds, Channels, Messages
        │               ├── Invites, Roles, Uploads, Moderation, Search
        │               └── Prisma → PostgreSQL
        │
        ├── WSS ───→ [Gateway Service :4001]
        │               ├── Realtime events (message, presence, typing)
        │               ├── Heartbeat / session lifecycle
        │               └── Redis Pub/Sub fan-out
        │
        └── WebRTC → [Media Signalling :4002]
                        ├── LiveKit room management
                        ├── Voice/video/screen-share
                        └── SFU routing
```

---

## Implementation Status

See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for current progress.

---

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT
