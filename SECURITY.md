# ConstChat Security Design

## Authentication

### Token Architecture

- **Access Token**: JWT, signed with RS256 or HS256 (configurable), 15-minute expiry
  - Claims: `sub` (userId), `sid` (sessionId), `iat`, `exp`
  - Transmitted: `Authorization: Bearer <token>` header
  - Never stored in localStorage (XSS risk) — store in memory or httpOnly cookie

- **Refresh Token**: opaque random token (64 bytes, hex), 30-day expiry
  - Stored in Redis: `constchat:refresh:{token}` → `{ userId, sessionId, deviceId, expiresAt }`
  - Rotation on every use (prevents parallel session theft)
  - Invalidated on: logout, password change, suspicious activity

### Multi-Factor Authentication

- TOTP (RFC 6238) using otplib, 30-second window, ±1 step tolerance
- 10 single-use backup codes, bcrypt-hashed in DB
- MFA required before refresh token issuance when enabled
- Recovery: backup code usage audited, new codes require MFA re-verification

### Session Management

Sessions stored in: `sessions` table + Redis for fast revocation checks.
On every API request, middleware checks Redis for session validity before trusting JWT.

Revocation scenarios:
- User logout → mark session invalid in Redis + DB
- Password change → revoke ALL sessions except current
- Suspicious login detected → trigger step-up auth, notify user
- 2FA enabled → revoke all existing sessions (force re-login)

---

## Authorization

### Permission System

Permissions are a 64-bit integer bitmask. Stored as BigInt in PostgreSQL.

Resolution order:
1. Guild owner → ADMINISTRATOR (bypass all)
2. Member has ADMINISTRATOR role → bypass channel overwrites
3. Base permissions = @everyone_role | union(member_role_permissions)
4. Apply channel @everyone overwrite (allow/deny)
5. Apply channel role overwrites (by role position, lower first)
6. Apply channel member-specific overwrite
7. Result: final effective permissions

All API endpoints:
- Extract userId from verified JWT
- Fetch guild member + roles
- Compute effective permissions
- Check required bit
- 403 if insufficient

### Guild Ownership

- Owner has all permissions
- Owner transfer requires MFA confirmation
- Owner cannot be kicked, banned, or have roles removed
- Guild deletion requires owner + password confirmation

---

## Input Validation

All API inputs validated via class-validator (NestJS) + Zod (packages).

- Reject unknown fields (`whitelist: true, forbidNonWhitelisted: true`)
- Length limits on all string fields
- HTML/script injection: message content is stored raw but rendered safely in client via sanitized markdown parser (no dangerouslySetInnerHTML with raw user content)
- File uploads: MIME type validated (not just extension), magic bytes checked

---

## Rate Limiting

Layered rate limiting using NestJS Throttler + Redis sliding window:

| Layer | Limit | Window |
|---|---|---|
| Global IP | 1000 req | 60s |
| Auth endpoints | 10 req | 60s |
| Message send | 5 req | 1s (burst) |
| Message send | 30 req | 30s (sustained) |
| File upload | 10 req | 60s |
| Friend requests | 20 req | 3600s |
| Invite creation | 5 req | 60s |
| DM to new user | 5 req | 86400s |

WebSocket rate limiting:
- 120 messages per 60s per connection
- IDENTIFY attempts: 3 per connection before close
- Typing events: debounced to 1 per 3s server-side

---

## File Upload Security

Upload pipeline:
1. **Content-Type validation** — reject non-allowed MIME types server-side
2. **Magic bytes check** — verify file header matches declared type
3. **Size limits** — 25MB for attachments, 8MB for avatars/banners
4. **File name sanitization** — strip path components, sanitize special chars
5. **Storage isolation** — files stored with random UUID key, not original filename
6. **Metadata strip** — EXIF data removed from images via sharp
7. **CDN delivery** — files served via CDN with `Content-Disposition: attachment` for downloads
8. **Signed URLs** — private files require short-lived signed S3 URLs

Antivirus integration:
- Hook point in upload pipeline for ClamAV or cloud AV scan
- Files quarantined pending scan result
- Async: upload completes, scan runs in workers, file marked available on pass

---

## WebSocket Security

- Auth token passed as query parameter: `?token=<access_token>` (TLS encrypted in transit)
- Token validated on IDENTIFY, not just on connect (prevents connection squatting)
- Session validated every heartbeat cycle
- Max payload size: 8KB per message (configurable)
- Connection limits per IP: 10 (anti-bot)
- Authenticated connection limit per user: 10 sessions max

---

## CSRF and CORS

- CORS: explicit origin allowlist, no wildcard in production
- CSRF: Double Submit Cookie pattern for state-mutating requests if using cookie auth
- Origin header validated on WebSocket upgrade
- SameSite=Strict on session cookies

---

## Secrets Management

Environment variables:
- Never committed to git (`.env*` in `.gitignore`)
- Secrets injected at runtime via environment or secrets manager (Vault, AWS Secrets Manager)
- Separate secrets for dev/staging/production

Key rotation:
- JWT secrets: rotatable with short grace period (previous key still validates for 15min during rotation)
- S3 credentials: IAM roles in production, not static keys
- DB password: rotated on schedule, connection pooling handles transition

---

## Audit Logging

All administrative actions recorded in `audit_logs` table with:
- `actor_id` — who performed the action
- `action` — what action (enum, not free text)
- `target_id` / `target_type` — what was affected
- `before_value` / `after_value` — diff of changed fields (JSON)
- `reason` — optional human reason
- `ip_address` — actor IP
- `created_at` — immutable timestamp

Audit log retention: minimum 90 days, configurable per guild tier.

Audit logs are **append-only** — no UPDATE or DELETE on audit_logs table (enforced via RLS or application layer).

---

## Data Privacy

User data handling:
- Passwords: bcrypt hash (12 rounds), never stored plain
- Email: stored plain for auth/notifications, treated as PII
- IP addresses: stored for security (session tracking), purged after 90 days
- Message content: stored plain (not encrypted at rest by default — at-rest encryption is infrastructure responsibility)
- Deleted messages: soft-deleted, content retained for moderation audit (configurable retention)

GDPR / data subject requests:
- Export endpoint: GET /users/@me/data — exports all user data as JSON
- Delete endpoint: DELETE /users/@me — anonymizes account (username → `deleted_user_<id>`, email removed, messages retained as `[deleted]`)

---

## Automod and Trust & Safety

Default automod rules:
- Excessive mentions (>10 in single message)
- Repetitive messages (same content 3+ times in 30s)
- Suspicious invite links (configurable)
- Known harmful domains (blocklist)

Raid protection:
- Verification level escalation when join rate spikes
- Temporary slowmode on affected channels
- New account restriction (configurable: require phone/email verified account)

User trust tiers:
- New account (<7 days): restricted DM, limited invites
- Standard: normal access
- Trusted: no DM limits within servers
- Staff: elevated moderation permissions

---

## Infrastructure Security

- All services communicate over internal network (not exposed externally except API, Gateway, Web)
- TLS terminated at load balancer / reverse proxy (nginx)
- Database not exposed to internet
- Redis AUTH enabled in production
- NATS TLS + auth in production
- Container images scanned for CVEs in CI
- Principle of least privilege: each service has minimal DB permissions
