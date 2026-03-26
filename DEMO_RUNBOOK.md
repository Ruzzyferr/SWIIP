# ConstChat Demo Runbook

How to run ConstChat locally from scratch.

---

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 (`npm install -g pnpm`)
- **Docker** + Docker Compose (for PostgreSQL, Redis, NATS, MinIO, Meilisearch)
- **Ports available:** 3000, 4000, 4001, 4002, 5432, 6379, 4222, 7700, 9000, 9001, 7880

---

## Step 1: Start infrastructure services

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Wait ~15 seconds for all services to become healthy. Verify:

```bash
docker compose -f infra/docker/docker-compose.yml ps
```

All services should show `healthy` or `running`.

---

## Step 2: (Optional) Start LiveKit for voice rooms

For voice channel functionality, run the LiveKit dev server:

```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev
```

> The `--dev` flag creates a dev server with auto-generated credentials (`devkey` / `secret`).
> Keep this running in a separate terminal.
> Voice rooms will work without this, but you won't be able to actually connect audio.

---

## Step 3: Install dependencies

```bash
pnpm install
```

---

## Step 4: Build shared packages

```bash
pnpm --filter @constchat/protocol build
pnpm --filter @constchat/design-tokens build
pnpm --filter @constchat/config build
```

Or build all packages at once:

```bash
pnpm -r --filter './packages/*' build
```

---

## Step 5: Generate Prisma client and push schema

```bash
cd services/api
pnpm db:generate
npx prisma db push
```

This creates all database tables from the Prisma schema.

---

## Step 6: Seed the database

```bash
cd services/api
pnpm db:seed
```

This creates 3 test users, 1 guild with channels, messages, DMs, and an invite.

---

## Step 7: Start all services

Open **4 separate terminals** and run:

**Terminal 1 — API Server (port 4000):**
```bash
cd services/api
pnpm dev
```

**Terminal 2 — WebSocket Gateway (port 4001):**
```bash
cd services/gateway
pnpm dev
```

**Terminal 3 — Media Signalling (port 4002):**
```bash
cd services/media-signalling
pnpm dev
```

**Terminal 4 — Web App (port 3000):**
```bash
cd apps/web
pnpm dev
```

---

## Step 8: Open the app

Open your browser to:

**http://localhost:3000**

---

## Test Accounts

All accounts use the same password: **`Password123!`**

| Email | Role | Username |
|---|---|---|
| alice@constchat.dev | Admin + Owner | alice |
| bob@constchat.dev | Member | bob |
| charlie@constchat.dev | Moderator | charlie |

---

## What to explore

1. **Log in** as `alice@constchat.dev` / `Password123!`
2. You'll land on the **ConstChat HQ** server
3. Browse the channel sidebar:
   - **#general** — General chat with seed messages
   - **#welcome** — Introductions
   - **#off-topic** — Casual chat
   - **#dev-chat** — Development discussion
   - **#bug-reports** — Bug tracking
   - **General Voice** — Voice channel (click to see voice room UI)
   - **Dev Voice** — Voice channel (max 10 users)
4. Click a **voice channel** to see the voice room view with Join/Mute/Deafen/Disconnect controls
5. Send messages in any text channel
6. Check the **member sidebar** (toggle with the Users icon in the header)
7. Open **Settings** (gear icon in the bottom-left user panel)
8. Try the **invite modal** (click "Invite People" in the server dropdown)

### Multi-user testing

1. Open a **second browser** (or incognito window)
2. Log in as `bob@constchat.dev`
3. Both users will see each other in the member list
4. Send messages in #general and watch real-time delivery
5. Join the same voice channel to see participant lists update

---

## How to join a voice room

1. Click on **"General Voice"** or **"Dev Voice"** in the channel sidebar
2. Click the **"Join Voice"** button in the center of the page
3. Your browser will request microphone permission — allow it
4. Once connected, you'll see:
   - Your avatar with a speaking indicator (green ring when speaking)
   - Mute/Deafen/Disconnect controls
   - The **Voice Connected** panel appears above the user panel in the sidebar
5. Other users who join the same channel will appear as participant tiles
6. To leave, click the **Disconnect** button (red phone icon)

---

## Invite code

A permanent invite code `constchat-demo` is pre-seeded. Use it to test the join-by-invite flow.

---

## Useful URLs

| Service | URL |
|---|---|
| Web App | http://localhost:3000 |
| API Server | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |
| WebSocket Gateway | ws://localhost:4001 |
| Media Signalling | http://localhost:4002 |
| MinIO Console | http://localhost:9001 (minioadmin/minioadmin) |
| Meilisearch | http://localhost:7700 |
| Prisma Studio | `cd services/api && pnpm db:studio` |

---

## Known limitations

- **Voice audio** requires the LiveKit dev server (Step 2). Without it, the voice UI works but audio won't connect.
- **No email sending** — password reset and email verification flows emit events but no email transport is configured.
- **No workers service** — background jobs (search indexing, thumbnails, notifications) run synchronously in the API.
- **Gateway is single-instance** — RESUME requires the same gateway instance. No sticky session routing.
- **No screen share UI** — backend supports it, but the frontend is not implemented yet.
- **No mobile app** — web only.
- **Rate limiting** is global (100 req/60s), not per-endpoint.
- **Presence crash recovery** — if the gateway crashes, presence TTL (90s) expires silently without broadcasting offline.

---

## Resetting the database

To start fresh:

```bash
cd services/api
npx prisma db push --force-reset
pnpm db:seed
```

---

## Quick start (copy-paste)

```bash
# 1. Infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# 2. (Optional) LiveKit for voice — run in separate terminal
docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev

# 3. Install & build
pnpm install
pnpm -r --filter './packages/*' build

# 4. Database
cd services/api && pnpm db:generate && npx prisma db push && pnpm db:seed && cd ../..

# 5. Start services (each in separate terminal)
cd services/api && pnpm dev
cd services/gateway && pnpm dev
cd services/media-signalling && pnpm dev
cd apps/web && pnpm dev

# 6. Open http://localhost:3000
# Login: alice@constchat.dev / Password123!
```
