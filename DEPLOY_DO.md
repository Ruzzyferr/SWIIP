# ConstChat — DigitalOcean Deployment Guide

## Architecture Overview

```
Browser → Web (Next.js :3000)
       → API (NestJS :4000)
       → Gateway (uWS :4001) [WebSocket]

API → PostgreSQL (managed)
API → Redis (managed)
API → Spaces (S3 object storage)
Gateway → Redis (managed)
Gateway → API (internal)
```

**Deployed now:** Web, API, Gateway, PostgreSQL, Redis, Spaces
**Deferred:** Workers, Media-Signalling (voice), NATS, Meilisearch, LiveKit

---

## Step-by-Step Deployment

### 1. Create Infrastructure on DigitalOcean

#### 1a. Managed PostgreSQL

1. Go to **Databases** → **Create Database Cluster**
2. Engine: **PostgreSQL 16**
3. Region: **Frankfurt (fra1)**
4. Plan: **Basic** ($15/mo, 1 vCPU, 1GB RAM, 10GB disk)
5. Name: `constchat-db`
6. Click **Create**
7. Wait for it to become ready
8. Go to **Connection Details** → copy the **Connection String**
   - Format: `postgresql://doadmin:PASSWORD@constchat-db-do-user-XXXXX-0.c.db.ondigitalocean.com:25060/defaultdb?sslmode=require`
9. Under **Settings** → **Trusted Sources** → add your App Platform app later

#### 1b. Managed Redis

1. Go to **Databases** → **Create Database Cluster**
2. Engine: **Redis 7**
3. Region: **Frankfurt (fra1)**
4. Plan: **Basic** ($15/mo)
5. Name: `constchat-redis`
6. Copy the **Connection String**
   - Format: `rediss://default:PASSWORD@constchat-redis-do-user-XXXXX-0.c.db.ondigitalocean.com:25061`

#### 1c. Spaces (Object Storage)

1. Go to **Spaces Object Storage** → **Create a Space**
2. Region: **Frankfurt (fra1)**
3. CDN: **Enable**
4. Name: `constchat`
5. Permissions: **Restrict File Listing** (default)
6. Go to **API** → **Spaces Keys** → **Generate New Key**
7. Save the **Access Key** and **Secret Key**
8. Your Spaces URL: `https://constchat.fra1.digitaloceanspaces.com`
9. Your CDN URL: `https://constchat.fra1.cdn.digitaloceanspaces.com`

### 2. Generate Secrets

Run this locally to generate JWT secrets:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
```

**Important:** JWT_SECRET must be identical for API and Gateway.

### 3. Push Code to GitHub

App Platform deploys from a GitHub repo. Push the repo:

```bash
cd ConstChat
git init  # if not already
git add -A
git commit -m "Prepare for DigitalOcean deployment"
git remote add origin https://github.com/YOUR_USER/constchat.git
git push -u origin main
```

### 4. Create the App on App Platform

#### Option A: Via Dashboard (Recommended for first time)

1. Go to **App Platform** → **Create App**
2. Source: **GitHub** → select your `constchat` repo → branch `main`
3. App Platform will auto-detect Dockerfiles. You need 3 services:

**Service 1: web**
- Source: Dockerfile at `apps/web/Dockerfile`
- HTTP Port: 3000
- Route: `/`
- Plan: Basic ($5/mo)
- Build Args:
  ```
  NEXT_PUBLIC_API_URL=https://constchat-XXXXX.ondigitalocean.app/api
  NEXT_PUBLIC_GATEWAY_URL=wss://constchat-XXXXX.ondigitalocean.app/ws
  NEXT_PUBLIC_CDN_URL=https://constchat.fra1.cdn.digitaloceanspaces.com
  ```

**Service 2: api**
- Source: Dockerfile at `services/api/Dockerfile`
- HTTP Port: 4000
- Route: `/api` (preserve path prefix)
- Plan: Basic ($10/mo)
- Environment Variables: (see Section 5 below)

**Service 3: gateway**
- Source: Dockerfile at `services/gateway/Dockerfile`
- HTTP Port: 4001
- Route: `/ws`
- Plan: Basic ($10/mo)
- Environment Variables: (see Section 5 below)

**Job: db-migrate**
- Source: Dockerfile at `services/api/Dockerfile`
- Kind: Pre-Deploy
- Run Command: `npx prisma migrate deploy --schema ./prisma/schema.prisma`
- Plan: Basic XXS

#### Option B: Via CLI

```bash
# Install doctl
# https://docs.digitalocean.com/reference/doctl/how-to/install/

doctl auth init
doctl apps create --spec infra/digitalocean/app-spec.yaml
```

### 5. Environment Variables

#### API Service

| Variable | Value | Secret? |
|----------|-------|---------|
| `NODE_ENV` | `production` | No |
| `PORT` | `4000` | No |
| `DATABASE_URL` | `postgresql://doadmin:...?sslmode=require` | Yes |
| `REDIS_URL` | `rediss://default:...` | Yes |
| `JWT_SECRET` | (generated above) | Yes |
| `JWT_REFRESH_SECRET` | (generated above) | Yes |
| `CORS_ORIGIN` | `https://constchat-XXXXX.ondigitalocean.app` | No |
| `S3_ENDPOINT` | `https://fra1.digitaloceanspaces.com` | No |
| `S3_BUCKET` | `constchat` | No |
| `S3_ACCESS_KEY` | (from Spaces) | Yes |
| `S3_SECRET_KEY` | (from Spaces) | Yes |
| `S3_REGION` | `fra1` | No |
| `S3_CDN_URL` | `https://constchat.fra1.cdn.digitaloceanspaces.com` | No |
| `LOG_LEVEL` | `info` | No |

#### Gateway Service

| Variable | Value | Secret? |
|----------|-------|---------|
| `NODE_ENV` | `production` | No |
| `PORT` | `4001` | No |
| `REDIS_URL` | (same as API) | Yes |
| `JWT_SECRET` | (same as API — must match!) | Yes |
| `API_INTERNAL_URL` | `http://api:4000` (internal service URL) | No |
| `GATEWAY_PUBLIC_URL` | `wss://constchat-XXXXX.ondigitalocean.app/ws/gateway` | No |
| `MAX_CONNECTIONS` | `10000` | No |
| `HEARTBEAT_INTERVAL` | `41250` | No |
| `HEARTBEAT_TIMEOUT` | `20000` | No |
| `LOG_LEVEL` | `info` | No |

#### Web Service (Build-time only)

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://constchat-XXXXX.ondigitalocean.app/api` |
| `NEXT_PUBLIC_GATEWAY_URL` | `wss://constchat-XXXXX.ondigitalocean.app/ws` |
| `NEXT_PUBLIC_CDN_URL` | `https://constchat.fra1.cdn.digitaloceanspaces.com` |

#### DB Migrate Job

| Variable | Value | Secret? |
|----------|-------|---------|
| `DATABASE_URL` | (same as API) | Yes |

### 6. Configure CORS on Spaces

1. Go to your Space → **Settings** → **CORS Configuration**
2. Add a rule:
   - Origin: `https://constchat-XXXXX.ondigitalocean.app`
   - Allowed Methods: `GET, PUT, HEAD`
   - Allowed Headers: `*`
   - Max Age: `3600`

### 7. Run Database Migration & Seed

After the first deploy, the `db-migrate` pre-deploy job runs `prisma migrate deploy` automatically.

To seed the database with demo data:

```bash
# Option 1: Via App Platform console
doctl apps console <app-id> api
# Then run:
npx prisma db seed

# Option 2: Run locally against the managed DB
# (Add your IP to the database trusted sources first)
DATABASE_URL="postgresql://doadmin:...?sslmode=require" npx prisma db seed
```

### 8. Verify Deployment

After deploy completes, check:

```bash
# Health checks
curl https://constchat-XXXXX.ondigitalocean.app/api/health
curl https://constchat-XXXXX.ondigitalocean.app/ws/health

# Open the web app
open https://constchat-XXXXX.ondigitalocean.app
```

### 9. WebSocket Routing

DigitalOcean App Platform supports WebSocket upgrades on HTTP routes.
The gateway is exposed at `/ws` which routes to the gateway service on port 4001.
The client connects to `wss://constchat-XXXXX.ondigitalocean.app/ws/gateway`.

---

## Cost Estimate (Monthly)

| Resource | Plan | Cost |
|----------|------|------|
| Web | Basic XS (512MB) | $5 |
| API | Basic S (1GB) | $10 |
| Gateway | Basic S (1GB) | $10 |
| PostgreSQL | Basic (1GB) | $15 |
| Redis | Basic | $15 |
| Spaces | 250GB included | $5 |
| **Total** | | **~$60/mo** |

---

## Deferred Services (Add Later)

### Workers (background jobs)
Requires NATS. Add as a Worker component in App Platform when you need:
- Push notifications
- Search indexing (Meilisearch)
- Image processing pipeline
- Audit logging

### Media Signalling (voice/video)
Requires LiveKit server. Options:
- LiveKit Cloud (managed, easiest)
- Self-hosted LiveKit on a Droplet
- Add media-signalling as another App Platform service

### NATS (event bus)
- Run on a Droplet or use Synadia Cloud
- Required for Workers service

### Meilisearch (full-text search)
- Meilisearch Cloud or Droplet
- Optional — search works without it, just slower

---

## Troubleshooting

### Build fails
- Check that `pnpm-lock.yaml` is committed
- Ensure Dockerfiles reference correct paths

### Database connection fails
- Add App Platform to trusted sources in database settings
- Check `?sslmode=require` in connection string

### WebSocket won't connect
- Verify gateway route is `/ws` with preserve_path_prefix=false
- Check `NEXT_PUBLIC_GATEWAY_URL` uses `wss://` not `ws://`
- Check `GATEWAY_PUBLIC_URL` matches the actual public URL

### CORS errors
- Verify `CORS_ORIGIN` on API matches the web app URL exactly (no trailing slash)
- Check Spaces CORS configuration

### Uploads fail
- Verify S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
- Check Spaces CORS allows PUT from your domain
