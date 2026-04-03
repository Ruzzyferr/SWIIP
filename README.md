<p align="center">
  <img src=".github/logo.png" alt="Swiip" width="120" />
</p>

<h1 align="center">Swiip</h1>

<p align="center">
  <b>Open-source real-time communication platform</b><br/>
  Text, voice, video, screen share — all in one place.
</p>

<p align="center">
  <a href="https://swiip.app">Website</a> ·
  <a href="https://swiip.app/downloads/Swiip-Setup-latest.exe">Download Desktop</a> ·
  <a href="#quick-start">Quick Start</a>
</p>

---

## Overview

Swiip is a feature-rich communication platform built from scratch with a modern stack. It supports servers, channels, DMs, voice/video calls, screen sharing, roles & permissions, and more.

### Key Features

- **Servers & Channels** — Create communities with text, voice, announcement, and forum channels
- **Voice & Video** — Low-latency WebRTC calls via LiveKit SFU with noise suppression (Krisp)
- **Screen Sharing** — Up to 1080p60, window or screen capture
- **Rich Messaging** — Markdown, code blocks, file uploads, reactions, threads, pins
- **Moderation** — Roles, permissions, audit logs, bans, timeouts
- **Desktop App** — Electron-based native app with custom title bar and system tray
- **i18n** — Turkish and English language support
- **KVKK Compliant** — Turkish data protection law compliance built-in

---

## Architecture

```
Client (Web / Desktop / Mobile)
    │
    ├── HTTPS ──→  API Service        (NestJS + Fastify + Prisma)
    │                                   Auth, CRUD, uploads, search
    │
    ├── WSS ───→  Gateway Service     (Node.js + uWebSockets.js)
    │                                   Real-time events, presence, typing
    │
    └── WebRTC → Media Signalling     (Node.js + LiveKit SDK)
                                        Voice, video, screen share
```

### Infrastructure

| Component | Technology |
|-----------|-----------|
| Database | PostgreSQL 16 |
| Cache & Pub/Sub | Redis 7 |
| Message Queue | NATS JetStream |
| Search Engine | Meilisearch |
| Object Storage | S3-compatible (DigitalOcean Spaces / MinIO) |
| SFU | LiveKit |
| Reverse Proxy | Caddy (auto TLS) |
| Monitoring | Prometheus + Grafana + Loki |

---

## Repository Structure

```
swiip/
├── apps/
│   ├── web/                  # Next.js 15 web client
│   └── desktop/              # Electron desktop app
├── services/
│   ├── api/                  # REST API (NestJS + Fastify)
│   ├── gateway/              # WebSocket gateway
│   ├── media-signalling/     # LiveKit signalling server
│   └── workers/              # Background job processors
├── packages/
│   ├── design-tokens/        # Theme tokens (colors, spacing, motion)
│   ├── protocol/             # Typed WebSocket event contracts
│   └── config/               # Zod-validated service configuration
└── infra/
    └── docker/               # Docker Compose (dev + production)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Zustand, Tailwind CSS, Framer Motion |
| Desktop | Electron 33 |
| API | NestJS 10 + Fastify, Prisma ORM |
| Gateway | Node.js + uWebSockets.js |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Event Bus | NATS JetStream |
| Search | Meilisearch |
| Media | LiveKit (WebRTC SFU) |
| Storage | S3-compatible |
| CI/CD | Docker + Docker Compose |

---

## Quick Start

### Prerequisites

- **Node.js** >= 22
- **pnpm** >= 10
- **Docker** + Docker Compose

### 1. Clone & Install

```bash
git clone https://github.com/Ruzzyferr/ConstChat.git
cd ConstChat
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Starts PostgreSQL, Redis, NATS, MinIO (S3), and Meilisearch.

### 3. Configure Environment

```bash
cp services/api/.env.example services/api/.env
cp services/gateway/.env.example services/gateway/.env
cp services/media-signalling/.env.example services/media-signalling/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Default values work with the local Docker Compose setup.

### 4. Database Setup

```bash
cd services/api
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Start Development

```bash
# From repo root — all services in parallel
pnpm dev
```

Or individually:

```bash
pnpm --filter @constchat/api dev          # API       → :4000
pnpm --filter @constchat/gateway dev      # Gateway   → :4001
pnpm --filter @constchat/web dev          # Web       → :3000
```

### 6. Open

Visit **http://localhost:3000**

Seed accounts:
| Email | Password | Role |
|-------|----------|------|
| `alice@constchat.dev` | `password123` | Admin |
| `bob@constchat.dev` | `password123` | Member |

---

## Development URLs

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API | http://localhost:4000 |
| API Docs (Swagger) | http://localhost:4000/api/docs |
| WebSocket Gateway | ws://localhost:4001 |
| MinIO Console | http://localhost:9001 |
| Meilisearch | http://localhost:7700 |
| NATS Monitor | http://localhost:8222 |

---

## Production Deployment

```bash
# Create .env.production with your credentials, then:
docker compose -f infra/docker/docker-compose.deploy.yml \
  --env-file .env.production up -d --build

# With voice support:
docker compose -f infra/docker/docker-compose.deploy.yml \
  --env-file .env.production --profile voice up -d --build

# With monitoring:
docker compose -f infra/docker/docker-compose.deploy.yml \
  --env-file .env.production --profile observability up -d
```

Production includes: automated daily database backups with S3 offsite storage, Caddy reverse proxy with auto-TLS, health checks on all services.

---

## Desktop App

```bash
cd apps/desktop
npm run build          # Builds web bundle + Electron installer
```

Produces `Swiip-Setup-{version}.exe` (NSIS installer) and `Swiip-Portable-{version}.exe`.

---

## License

MIT
