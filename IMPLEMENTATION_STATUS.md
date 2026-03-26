# ConstChat — Implementation Status

Last updated: 2026-03-26

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Complete and functional |
| ⚠️ | Implemented with documented limitations |
| 🔨 | In progress / partially complete |
| 📋 | Planned, not started |

---

## Phase 0: Foundation ✅

| Item | Status | Notes |
|---|---|---|
| Monorepo structure (pnpm + Turborepo) | ✅ | `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| Base TypeScript config | ✅ | `tsconfig.base.json` with strict mode |
| Design token system | ✅ | `packages/design-tokens` — colors, spacing, motion, layout |
| WebSocket protocol types | ✅ | `packages/protocol` — all events, payloads typed |
| Config schemas (Zod) | ✅ | `packages/config` — API, gateway, media, workers configs |
| Docker Compose (dev infra) | ✅ | PostgreSQL, Redis, NATS, MinIO, Meilisearch |
| Docker Compose (production) | ✅ | All services + nginx |
| Dockerfiles | ✅ | API, Gateway, Web multi-stage builds |
| Documentation | ✅ | README, ARCHITECTURE, DESIGN_SYSTEM, SECURITY, DEPLOYMENT |

---

## Phase 1: Core Services

### services/api (NestJS + Prisma) ✅

All 13 modules fully implemented with controllers, services, DTOs, Swagger docs, and permission guards.

| Item | Status | Notes |
|---|---|---|
| NestJS + Fastify bootstrap | ✅ | Validation pipes, CORS, Swagger, throttling |
| Prisma schema | ✅ | 18+ models, all relations, indexes, cascading deletes |
| Auth module | ✅ | Register, login, JWT (access+refresh), sessions, password reset |
| MFA (TOTP) | ✅ | Setup, enable, disable, backup codes |
| User profiles | ✅ | Global name, bio, accent color, locale, relationships |
| Friend/relationship system | ✅ | FRIEND, BLOCKED, PENDING_OUTGOING, PENDING_INCOMING |
| Guild CRUD | ✅ | Create, settings, members, role assignment, audit logging |
| Channel CRUD | ✅ | TEXT, VOICE, CATEGORY; permissions, slowmode, pins |
| Messages CRUD | ✅ | Create, edit (with revisions), delete, reactions, pagination |
| Roles module | ✅ | Create, update, position hierarchy, permission assignment |
| Permission evaluator | ✅ | 40+ flags, BigInt bitmask, channel overwrites, admin detection |
| Invites | ✅ | Create with max-age/max-uses, temporary membership, join via code |
| DM / Group DM | ✅ | 1-to-1 and group (max 10), member management |
| File uploads (S3/MinIO) | ✅ | Avatars (auto-resize), banners, attachments, type validation |
| Rate limiting | ✅ | Global throttle (100/60s); per-endpoint not yet granular |
| Search (Meilisearch) | ✅ | Message + user full-text search, filters, pagination |
| Moderation module | ✅ | TIMEOUT, KICK, BAN, SOFTBAN, WARN, MUTE with audit log |
| Webhooks | ✅ | Create, execute, update, delete; INCOMING + CHANNEL_FOLLOWER types |
| Notifications | ✅ | Create, read/unread, bulk mark, Redis pub/sub integration |
| Event publisher (Redis) | ✅ | Bridges @OnEvent to gateway pub/sub + Redis Streams for replay |
| Health check endpoint | ⚠️ | Via Fastify `/health` — not yet wired to readiness probes |
| Swagger docs | ✅ | Auto-generated from decorators on all controllers |
| Database seed | ✅ | 3 users, guild, channels, messages, DMs, invites |
| Automod rules | ⚠️ | Schema exists; no management service/controller yet |
| Reports system | ⚠️ | Schema exists; no management service/controller yet |
| Audit log retrieval | ⚠️ | Logs written by services but no query/list endpoint |

### services/gateway (uWebSockets.js) ✅

| Item | Status | Notes |
|---|---|---|
| WebSocket server (uWS) | ✅ | Connection limits, backpressure handling, compression disabled |
| HELLO / IDENTIFY flow | ✅ | JWT verification, READY payload with guilds/DMs/user, Redis cache |
| HEARTBEAT / ACK | ✅ | Bidirectional watchdog with configurable timeout |
| READY payload assembly | ✅ | Fetches from internal API or Redis cache (30s) |
| RESUME / replay | ✅ | Reads from Redis Streams per-guild + per-user since disconnectedAt |
| Session state persistence | ✅ | Session hash in Redis with 5-min resume window on disconnect |
| Guild subscription persistence | ✅ | Stored in Redis sets, restored on RESUME |
| Presence tracking | ✅ | Redis hashes with 90s TTL, multi-session support, heartbeat refresh |
| Event fan-out (Redis pub/sub) | ✅ | Pattern subscribe `constchat:events:*`, per-session sequence numbers |
| Rate limiting | ✅ | Token bucket: 120 msg/min, burst 30, per-connection |
| SUBSCRIBE/UNSUBSCRIBE_GUILD | ✅ | With presence snapshot on subscribe |
| TYPING_START relay | ✅ | Pub/sub to channel topic (ephemeral, no stream) |
| REQUEST_GUILD_MEMBERS | ✅ | Delegates to API, streams GUILD_MEMBERS_CHUNK |
| VOICE_JOIN / VOICE_LEAVE | ✅ | Forwards to media-signalling, returns VOICE_SERVER_UPDATE |
| VOICE_STATE_UPDATE relay | ✅ | Pub/sub to media-signalling service |
| READ_STATE_UPDATE forward | ✅ | Forwards to API for persistence |
| Health + Metrics endpoints | ✅ | `/health` (JSON), `/metrics` (Prometheus text format) |
| Graceful shutdown | ✅ | SIGTERM/SIGINT, close listen socket, disconnect Redis |

**Delivery guarantees (documented):**
- Pub/sub: at-most-once (if no subscriber listening, event is lost)
- Streams: at-least-once within replay window (MAXLEN ~1000 per topic)
- Combined: live via pub/sub + missed events replayed from streams on RESUME
- No exactly-once: clients must be idempotent
- Typing/presence events are ephemeral (not written to streams)

**Limitations:**
- RESUME requires same gateway instance (session keys in Redis, not instance-routed)
- Multi-instance would need sticky sessions or shared session routing
- Presence TTL expiry (crash scenario) does not broadcast offline — clients get stale presence until reconnect
- Stream MAXLEN ~1000 per topic; if more events missed, session is non-resumable

---

## Phase 2: Web Application ✅

### apps/web (Next.js 14)

| Item | Status | Notes |
|---|---|---|
| Next.js project setup | ✅ | Complete |
| Tailwind + design tokens CSS | ✅ | Full token system as CSS variables |
| Root layout | ✅ | Inter font, metadata, theme |
| Auth — Login page | ✅ | Animated, Zod validation, OAuth placeholders |
| Auth — Register page | ✅ | Password strength, username validation |
| App shell layout | ✅ | ServerRail + ChannelSidebar + content + modals |
| Server Rail component | ✅ | Squircle icons, active indicator, tooltips |
| Channel Sidebar component | ✅ | Categories, channels, user panel |
| User Panel component | ✅ | Presence, mic/deafen controls |
| Channel header bar | ✅ | Icon, name, topic, member toggle, search |
| Message list (virtualized) | ✅ | react-virtuoso, date separators, pagination |
| Message item (grouped, full) | ✅ | Markdown, reactions, edit/delete, attachments |
| Message composer | ✅ | Rich textarea, drag-drop, drafts, reply/edit |
| Typing indicator | ✅ | Animated dots, multi-user text, 8s auto-prune |
| Emoji picker | ✅ | 8 categories, search, skin tones, recently used, reaction picker |
| Zustand stores (6 modules) | ✅ | auth, ui, gateway, guilds, messages, presence |
| Gateway client (WebSocket) | ✅ | Reconnect, heartbeat, resume |
| Gateway → store bridge | ✅ | All events wired to Zustand stores |
| API client (Axios) | ✅ | Token refresh interceptor, error normalization |
| Auth provider/guard | ✅ | Hydration, redirect, gateway bootstrap |
| Settings overlay | ✅ | Account page, nav, appearance, logout |
| Member sidebar | ✅ | Role groups, presence indicators |
| UI component library | ✅ | Button, Input, Avatar, Modal, Tooltip, Badge, Spinner, ContextMenu, Toast |
| Channel pages (routes) | ✅ | /channels/@me, /[guildId], /[guildId]/[channelId] |
| Guild creation flow | ✅ | CreateGuildModal with name + icon placeholder |
| Modal system | ✅ | Global ModalRoot with type dispatch |
| Friend/DM list | ✅ | Online/all/pending/blocked/add, DM sidebar, DM chat view |
| Server settings | ✅ | Overview, members, roles/channels/moderation placeholders, delete |
| Invite modal | ✅ | Create with expire/max-uses, copy link, join by code/URL |
| Voice room UI | ✅ | Join/leave, mute/deafen, participant list, speaking indicator, connection states |
| Screen share UI | 📋 | Quality profiles defined; frontend not started |
| User/role search autocomplete | 📋 | |
| Channel search | 📋 | |
| Notification center | 📋 | API exists; frontend not wired |
| Thread viewer | 📋 | |
| Forum channel view | 📋 | |

---

## Phase 3: Realtime Media ⚠️

| Item | Status | Notes |
|---|---|---|
| services/media-signalling setup | ✅ | NestJS + Fastify, LiveKit SDK, Swagger docs |
| Room lifecycle (LiveKit) | ✅ | Create, join, leave, delete, ensureExists |
| Token issuance | ✅ | Per-user LiveKit access tokens with VideoGrant |
| Screen share tokens | ✅ | Separate grant with quality profiles (720p30/1080p30/1080p60/auto) |
| Participant listing | ✅ | Via LiveKit RoomServiceClient |
| Mod actions (kick, mute) | ✅ | removeParticipant, mutePublishedTrack |
| LiveKit webhook handler | ✅ | participant_joined/left, track_published/unpublished, room_finished |
| Webhook → Redis pub/sub | ✅ | Publishes VOICE_STATE_UPDATE to gateway guild topics |
| Webhook → Redis Streams | ✅ | Writes to guild streams for RESUME replay |
| Voice state in Redis | ✅ | Per-user hash + per-room participant set, 1h TTL |
| Gateway VOICE_JOIN handler | ✅ | Resolves channel→guild, calls media-signalling, returns VOICE_SERVER_UPDATE |
| Gateway VOICE_LEAVE handler | ✅ | Optimistic pub/sub broadcast; cleanup via LiveKit webhook |
| Quality constraint API | ✅ | GET /constraints/:quality returns resolution/framerate/bitrate |
| Voice room UI (frontend) | ✅ | LiveKit client integration, full controls |
| Screen share UI (frontend) | 📋 | |
| Codec negotiation | 📋 | Defined as AV1>VP9>H264; not enforced yet |
| Noise suppression | 📋 | |
| Device switching UI | 📋 | |
| Speaking indicators UI | 📋 | |
| TURN server config | 📋 | |
| Desktop app (Tauri) | 📋 | For 60fps screen share |

---

## Phase 4: Platform Maturity 📋

| Item | Status | Notes |
|---|---|---|
| Forum channel (full) | 📋 | |
| Thread lifecycle | 📋 | |
| Automod rules engine | ⚠️ | Schema exists; needs management service |
| Report queue (UI + API) | ⚠️ | Schema exists; needs management service |
| Bot/webhook platform | ⚠️ | Webhook execution works; bot framework not built |
| Mobile app (React Native) | 📋 | |
| Notification push (web push) | 📋 | |
| Email notifications | 📋 | Hook points exist; no transport configured |
| Premium tier skeleton | 📋 | |

---

## Phase 5: Launch Hardening 📋

| Item | Status | Notes |
|---|---|---|
| Load testing | 📋 | |
| Chaos testing | 📋 | |
| Performance profiling | 📋 | |
| Visual regression tests | 📋 | |
| Accessibility audit | 📋 | |
| Security audit | 📋 | |
| Observability dashboards | 📋 | |
| Runbooks | 📋 | |
| Production launch checklist | 📋 | |

---

## Known Gaps / Technical Debt

1. **services/workers** — Not scaffolded. Notification dispatch, search indexing, thumbnail generation, automod jobs are synchronous in API for now.
2. **Email sending** — Auth flows emit events but no email transport configured.
3. **Mobile app** — Directory created, Phase 4+.
4. **Desktop app (Tauri)** — Directory created, critical for 60fps screen share, Phase 3+.
5. **AV scanning** — Upload pipeline has hook point but ClamAV integration not wired.
6. **Search indexing** — Meilisearch client exists; index creation/sync not wired to workers.
7. **Multi-instance gateway** — RESUME requires sticky sessions. No instance-aware routing yet.
8. **Presence crash recovery** — If gateway crashes, presence TTL (90s) expires silently. No broadcast of offline status in crash scenario.
9. **Automod / Reports** — Prisma models exist but no CRUD services or admin UI.

---

## Build Health (2026-03-26)

| Target | Status |
|---|---|
| `pnpm install` | ✅ |
| `@constchat/protocol` build | ✅ |
| `@constchat/design-tokens` build | ✅ |
| `@constchat/config` build | ✅ |
| `@constchat/web` typecheck | ✅ |
| `@constchat/web` build | ✅ |
| `@constchat/api` typecheck | ✅ |
| `@constchat/gateway` typecheck | ✅ |
| `@constchat/media-signalling` typecheck | ✅ |

---

## Next Priorities

1. 📋 Wire notification center in frontend
2. 📋 Screen share UI (frontend)
3. 📋 Automod rules management service + admin UI
4. 📋 Workers service (background jobs: email, search indexing, thumbnails)
5. 📋 Multi-instance gateway support (instance-aware session routing)
6. 📋 Forum/thread channel views
