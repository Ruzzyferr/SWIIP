# ConstChat Deployment Guide

## Environments

| Env | Purpose |
|---|---|
| `development` | Local dev, Docker infra, hot reload |
| `staging` | Pre-prod, mirrors production setup |
| `production` | Live, hardened config, monitoring |

---

## Local Development

See [README.md](./README.md) Quick Start section.

---

## Production Deployment

### Prerequisites

- Docker + Docker Compose OR Kubernetes cluster
- PostgreSQL 16 (managed: RDS, Supabase, Neon)
- Redis 7 (managed: Upstash, Redis Cloud, ElastiCache)
- NATS JetStream (self-hosted or Synadia Cloud)
- S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2)
- LiveKit Cloud or self-hosted LiveKit server
- Domain + TLS certificate (Let's Encrypt)
- SMTP server for emails (SendGrid, Resend, SES)

### Step 1: Build Images

```bash
# From repo root
docker build -f services/api/Dockerfile -t constchat/api:latest .
docker build -f services/gateway/Dockerfile -t constchat/gateway:latest .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.constchat.example.com \
  --build-arg NEXT_PUBLIC_GATEWAY_URL=wss://gateway.constchat.example.com \
  --build-arg NEXT_PUBLIC_CDN_URL=https://cdn.constchat.example.com \
  -t constchat/web:latest .
```

### Step 2: Configure Environment

Create production env files from examples:

```bash
cp services/api/.env.example .env.api.production
cp services/gateway/.env.example .env.gateway.production
```

Critical values to change:
- `JWT_SECRET` — minimum 64 random bytes
- `JWT_REFRESH_SECRET` — different from JWT_SECRET
- `DATABASE_URL` — production connection string with SSL
- `REDIS_URL` — with password
- All S3 credentials

### Step 3: Database Migration

```bash
# Run against production database
DATABASE_URL=... pnpm --filter @constchat/api db:migrate:deploy
```

### Step 4: Deploy

**Docker Compose:**

```bash
docker compose -f infra/docker/docker-compose.prod.yml \
  --env-file .env.production \
  up -d
```

**Kubernetes:**

```bash
# Apply manifests (customize with kustomize or helm)
kubectl apply -f infra/k8s/
```

---

## Nginx Configuration

Reverse proxy routing:

```nginx
# /etc/nginx/sites-available/constchat

upstream api {
    server api:4000;
    keepalive 32;
}

upstream gateway {
    server gateway:4001;
    keepalive 64;
}

upstream web {
    server web:3000;
}

server {
    listen 443 ssl http2;
    server_name constchat.example.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Web App
    location / {
        proxy_pass http://web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api/ {
        proxy_pass http://api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket Gateway
    location /gateway {
        proxy_pass http://gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Static files / uploads via CDN
    location /cdn/ {
        proxy_pass http://minio:9000/constchat/;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
```

---

## Health Checks

All services expose health endpoints:

| Service | Endpoint | Expected |
|---|---|---|
| API | `GET /health` | `{ status: 'ok', db: 'ok', redis: 'ok' }` |
| Gateway | `GET /health` | `{ status: 'ok', connections: N }` |
| Web | `GET /api/health` | Next.js route |

---

## Database Backup

```bash
# Daily backup script
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz
# Upload to S3
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://constchat-backups/
```

Set up automated daily backups with retention policy.

---

## Scaling Guidelines

### API Service

```
CPU-bound: scale horizontally (Docker replicas or Kubernetes HPA)
DB connections: use connection pooler (PgBouncer) when >20 API instances
Stateless: no local state, safe to add/remove instances freely
```

### Gateway Service

```
Connection-stateful: use sticky sessions at load balancer (IP hash)
Redis pub/sub: single Redis node handles ~50K concurrent WebSocket connections
For >100K: Redis Cluster, shard by guildId % N
Vertical scaling preferred initially (uWS is single-threaded per port — use cluster module)
```

### Media / LiveKit

```
LiveKit scales horizontally via their built-in clustering
Use LiveKit Cloud for initial deployment (no infra ops)
Self-hosted: minimum 2 nodes for HA, sized to expected peak concurrent participants
```

---

## Monitoring Setup

### Required Alerts

| Alert | Condition | Severity |
|---|---|---|
| API p95 latency | > 1000ms for 5min | Warning |
| API error rate | > 5% for 2min | Critical |
| Gateway connections | > 80% max_connections | Warning |
| DB connections | > 80% max_connections | Warning |
| Redis memory | > 80% maxmemory | Warning |
| Failed login rate | > 50 per minute per IP | Critical |
| Message queue depth | > 10,000 for 5min | Warning |

### Key Metrics to Track

- `constchat_gateway_connections_total` — active WebSocket connections
- `constchat_api_request_duration_p95` — API response times
- `constchat_messages_sent_total` — messages per second
- `constchat_voice_participants_active` — concurrent voice users
- `constchat_uploads_bytes_total` — storage usage rate
- `constchat_moderation_actions_total` — moderation volume

---

## Rollback Procedure

```bash
# Identify last known good version
docker images constchat/api | head -5

# Rollback API
docker service update --image constchat/api:previous_tag constchat_api

# Rollback database (if schema migration ran)
cd services/api && DATABASE_URL=... npx prisma migrate resolve --rolled-back <migration_name>
```

---

## Disaster Recovery

- **RPO** (Recovery Point Objective): 24 hours (daily backup)
- **RTO** (Recovery Time Objective): 4 hours (with documented runbooks)

For production:
- PostgreSQL: continuous WAL archiving to S3 → point-in-time recovery
- Redis: append-only file persistence, backup every 6 hours
- S3 objects: versioning enabled, cross-region replication

---

## Security Hardening Checklist

- [ ] All secrets rotated from default values
- [ ] JWT secrets are 64+ random bytes
- [ ] CORS origin list is explicit (no wildcard)
- [ ] Rate limiting configured and tested
- [ ] TLS 1.2+ enforced, TLS 1.0/1.1 disabled
- [ ] Database not accessible from internet
- [ ] Redis password set
- [ ] Container images scanned (Trivy or Snyk)
- [ ] `NODE_ENV=production` set
- [ ] Debug endpoints disabled
- [ ] Swagger docs disabled in production
- [ ] Error messages sanitized (no stack traces to clients)
- [ ] Audit log retention set
- [ ] Backup procedure tested
