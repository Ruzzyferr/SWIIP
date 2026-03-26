# ConstChat — Architecture Document

## Overview

ConstChat is a multi-service, event-driven, real-time communication platform. The system is designed around four distinct traffic patterns that must never share infrastructure:

1. **HTTP API traffic** — CRUD operations, authentication, configuration
2. **Gateway/event traffic** — WebSocket events, presence, typing, read states
3. **Media traffic** — WebRTC audio/video/screen-share (handled by SFU)
4. **Background job traffic** — notifications, indexing, thumbnail generation, moderation

---

## Service Topology

```
┌────────────────────────────────────────────────────────────────────┐
│                         Client Layer                               │
│  [Web Browser]  [Desktop (Tauri)]  [Mobile (React Native)]        │
└──────┬────────────────┬──────────────────┬─────────────────────────┘
       │ HTTPS          │ WSS              │ WebRTC
       ▼                ▼                  ▼
┌────────────┐  ┌──────────────┐  ┌─────────────────────┐
│  API       │  │  Gateway     │  │  Media Signalling   │
│  :4000     │  │  :4001       │  │  :4002              │
│  NestJS    │  │  uWS.js      │  │  LiveKit SDK        │
│  Fastify   │  │  Node.js     │  │                     │
└─────┬──────┘  └─────┬────────┘  └──────────┬──────────┘
      │               │                       │
      │          ┌────▼─────┐          ┌──────▼──────┐
      │          │  Redis   │          │  LiveKit    │
      │          │  Pub/Sub │          │  SFU Server │
      │          │  Presence│          └─────────────┘
      │          └─────┬────┘
      │                │
┌─────▼────────────────▼────────────────┐
│              NATS JetStream           │
│    (async events, job dispatch)       │
└────┬───────────────────────┬──────────┘
     │                       │
┌────▼───────┐  ┌────────────▼──────────┐
│ PostgreSQL │  │  Workers Service      │
│            │  │  - Notifications      │
│            │  │  - Search indexing    │
│            │  │  - File processing    │
└────────────┘  │  - Automod scanning   │
                │  - Thumbnail gen      │
                └───────────────────────┘

Supporting:
┌────────────┐  ┌────────────┐  ┌────────────────┐
│   Redis    │  │  MinIO/S3  │  │ Meilisearch    │
│  Cache +   │  │  Objects   │  │  Full-text     │
│  Sessions  │  │  CDN       │  │  Search        │
└────────────┘  └────────────┘  └────────────────┘
```

---

## Data Flow: Message Send

```
Client
  │ POST /channels/{id}/messages (HTTP)
  ▼
API Service
  ├── Auth middleware validates JWT
  ├── Permission check: SEND_MESSAGES in channel
  ├── Rate limit check (per user, per channel)
  ├── Write to PostgreSQL (messages table)
  ├── Publish to NATS: message.created event
  │     └── Workers picks up: search index, mention notifications
  └── Publish to Redis channel: guild:{guildId}
        ▼
Gateway Service (subscribed to Redis)
  └── Fan-out to all connected clients subscribed to guild:{guildId}
        └── emit { op: 0, t: 'MESSAGE_CREATE', d: message_payload }
```

---

## Data Flow: Voice Call

```
Client A                   Media Signalling          LiveKit SFU
  │                              │                        │
  │ POST /voice/join-room        │                        │
  │ ─────────────────────────────►                        │
  │                              │ Create/find room       │
  │                              │ Generate token         │
  │◄─────────────────────────────│ Return { token, url }  │
  │                              │                        │
  │ WebRTC connect ──────────────┼───────────────────────►│
  │ (LiveKit client SDK)         │                        │
  │                              │                        │
  │ Voice State Update           │                        │
  │ WS → Gateway ──────► Redis publish: voice_state_update│
  │                                                       │
Client B receives VOICE_STATE_UPDATE via Gateway WS connection
```

---

## Database Schema Strategy

### Core Entities

- **User** — authentication, profile, settings
- **Guild** — server with metadata, ownership, settings
- **GuildMember** — user↔guild membership with nick, roles, joined_at
- **Channel** — text/voice/forum/stage/announcement/thread/DM types
- **Message** — with soft-delete, edit history, references
- **Role + PermissionOverwrite** — hierarchical permission model
- **ReadState** — per-user per-channel unread tracking
- **AuditLog** — immutable action record

### Permission Model

```
Effective Permission Resolution (Explicit Deny > Explicit Allow > Inherited > Default Deny):

1. If user is guild OWNER → ADMINISTRATOR (all permissions)
2. If user has a role with ADMINISTRATOR → all permissions
3. Compute base permissions: @everyone role permissions + union of all user role permissions
4. If channel has overwrites:
   a. Apply @everyone channel overwrite (allow/deny)
   b. Apply role overwrites (lowest role first, then higher roles)
   c. Apply member-specific overwrite (highest priority)
5. Result: effective BigInt permission bitfield
```

---

## Gateway Architecture

### Connection Lifecycle

```
1. Client connects to ws://gateway:4001/gateway?encoding=json
2. Server sends HELLO { heartbeatInterval: 41250, sessionId }
3. Client sends IDENTIFY { token, properties }
   └── Server validates JWT, fetches user+guilds from Redis cache (or API)
   └── Server sends READY { user, guilds, dms, resumeUrl }
   └── Server subscribes client to: user:{id}, guild:{id} for each guild
4. Client sends HEARTBEAT every ~41s
   └── Server responds HEARTBEAT_ACK
5. On disconnect: session stored in Redis for 5 minutes (resume window)
6. On reconnect: Client sends RESUME { sessionId, seq }
   └── Server replays missed events from Redis Streams
```

### Session Storage (Redis)

```
constchat:sessions:{sessionId} → HASH { userId, seq, guilds, connectedAt }
constchat:user_sessions:{userId} → SET { sessionId, ... }
constchat:presence:{userId} → HASH { status, customStatus, updatedAt }
constchat:typing:{channelId} → HASH { userId: timestamp }
constchat:stream:{topic} → Redis Stream (event replay)
```

---

## Real-time Event System

### Topics

| Topic Pattern | Used For |
|---|---|
| `guild:{guildId}` | All guild events (messages, members, channels, roles) |
| `channel:{channelId}` | Channel-specific events |
| `user:{userId}` | Personal events (DMs, friend requests, notifications) |
| `dm:{dmId}` | DM conversation events |

### Event Replay (Resumption)

Events are written to Redis Streams (`XADD`) with a 5-minute TTL. On resume, the gateway reads from the stream starting at the client's last sequence number (`XRANGE`), replaying missed events before sending RESUMED.

---

## 60 FPS Screen Share Architecture

### Capability Tiers

| Profile | Resolution | FPS | Bitrate | Use Case |
|---|---|---|---|---|
| Auto | Adaptive | Adaptive | Adaptive | Default |
| 720p30 | 1280×720 | 30 | 2.5 Mbps | Weak network |
| 1080p30 | 1920×1080 | 30 | 5 Mbps | Standard |
| 1080p60 | 1920×1080 | 60 | 8 Mbps | Desktop app, capable HW |

### Codec Negotiation Order

1. AV1 (if both endpoints support + HW acceleration)
2. VP9 (profile 2 for HDR, profile 0 standard)
3. H.264 (High profile, B-frames disabled for low latency)
4. VP8 (fallback)

### Adaptive Quality

The SFU monitors per-subscriber packet loss and RTT:
- packet_loss > 5% → reduce bitrate by 20%
- packet_loss > 15% → drop to next lower profile
- rtt > 200ms → reduce FPS first, then resolution

Content type detection: if motion < threshold (static text/code), reduce max FPS to 10 to save bitrate without perceived quality loss.

---

## Security Architecture

See [SECURITY.md](./SECURITY.md) for full security design.

### Key Principles

1. **JWT access tokens** (15min) + **rotating refresh tokens** (30d), stored in HttpOnly cookies or memory
2. **Session binding** — refresh tokens tied to device fingerprint
3. **Permission checks** at API layer on every request, never trust client-side state
4. **Rate limiting** — layered: IP (global), userId (per-endpoint), guildId (messaging)
5. **Upload safety** — MIME validation, size limits, antivirus scan hook (ClamAV), metadata strip
6. **WebSocket auth** — token in query string (TLS encrypted), validated on IDENTIFY, rotated on gateway resume

---

## Scalability Notes

### Horizontal Scaling

- **API** — stateless, scale freely behind load balancer
- **Gateway** — stateful (connections). Use sticky sessions (IP hash) at LB level, or use Redis-backed session routing
- **Workers** — NATS consumer groups allow multiple instances, at-least-once delivery
- **SFU (LiveKit)** — horizontal via LiveKit Cloud or self-hosted cluster

### PostgreSQL

- Read replicas for search/reporting queries
- Message table: partition by `channel_id` hash or time range after 100M rows
- Attachment metadata: separate high-volume partition

### Redis

- Single node sufficient to ~50K concurrent users
- Redis Cluster for >100K concurrent (careful with pub/sub key distribution)

---

## Architecture Decision Records (ADRs)

| # | Decision | Chosen | Rationale |
|---|---|---|---|
| 001 | Monorepo tooling | pnpm + Turborepo | Single dep graph, shared packages, fast caching |
| 002 | Backend framework | NestJS + Fastify | Type-safe DI, module system, Fastify perf over Express |
| 003 | WebSocket server | uWebSockets.js | 10-100x more connections/memory than ws library |
| 004 | SFU | LiveKit | Production-ready, Simulcast/SVC, good SDK, scalable |
| 005 | Message bus | NATS JetStream | Low ops overhead vs Kafka, persistent streams, fast |
| 006 | Search | Meilisearch | Fast setup, good relevance, easy ops, scale to OpenSearch later |
| 007 | Frontend state | Zustand + Immer | Minimal boilerplate, performant, easy slice pattern |
| 008 | CSS approach | Tailwind + CSS vars | Design token bridge, no runtime CSS, utility-first |
| 009 | DB ORM | Prisma | Type-safe queries, migration system, great DX |
| 010 | Auth | JWT + rotating refresh | Stateless access, revocable refresh via Redis |
