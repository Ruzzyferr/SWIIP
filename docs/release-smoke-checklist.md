# ConstChat Release Smoke Checklist

## Staging/Local (before production)
- `pnpm --filter @constchat/web lint`
- `pnpm --filter @constchat/gateway typecheck`
- `pnpm --filter @constchat/api test`
- `pnpm test:e2e --project=chromium-desktop --grep "public route responds|terms checkbox"`

## Production (after deploy)
- `https://swiip.app/login` returns `200`
- `https://swiip.app/terms` returns `200`
- `https://swiip.app/privacy` returns `200`
- `https://swiip.app/forgot-password` returns `200`
- `https://swiip.app/api/health` returns `200`
- `POST /api/auth/login` invalid credentials returns `401`/`422` (not `500`)

## Voice profile (optional rollout)
- Ensure `.env.production` includes: `LIVEKIT_URL`, `LIVEKIT_WS_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- Deploy media-signalling profile:
  - `docker compose -f infra/docker/docker-compose.deploy.yml --env-file .env.production --profile voice up -d --build media-signalling`
- Validate gateway logs contain successful `VOICE_SERVER_UPDATE` flow for a test user
