# ConstChat - Claude Code Master Input Pack

Bu dosya Claude Code'a doğrudan verilebilir. Amaç prototip değil, deploy-ready bir ürün çıkarmaktır.

## Misyon
ConstChat, Discord parity seviyesinde çalışan; text/voice/video/screen share, role-permission, moderation, DM/group DM, thread/forum, webhook/bot, search ve observability katmanları olan özgün görsel kimlikli bir iletişim platformu olacak.

## Non-negotiables
- Hazır chat/admin template görünümü yasak
- Shadcn benzeri kütüphanelerin final görünümü birebir kullanılamaz
- Mock-only demo kabul edilmez
- 60 FPS screen share, roles/permissions, audit log, DM, thread, forum, voice/video kapsam dışı bırakılamaz
- Kod derlenebilir, testlenebilir ve deploy edilebilir olmalı

## Çıktı Beklentisi
1. Monorepo kur
2. apps/web, apps/desktop, apps/mobile
3. services/api, services/gateway, services/media-signalling, services/workers
4. shared packages: design-tokens, ui-primitives, protocol, config
5. Docker compose + env.example + migrations + seed + README
6. Typed protocol + auth + guild/channel/message akışı
7. Permission evaluator + audit log + automod
8. Voice/video + SFU + desktop screen capture
9. Observability, CI/CD ve production notes

## Ürün Kapsamı
- Auth, 2FA, multi-session, device management
- Global profile + server profile + presence
- Server/guild, invites, onboarding, categories
- Text, voice, stage, forum, announcement channels
- DM, group DM
- Message composer, reply, reaction, mention, pin, edit/delete, attachments, threads
- Role hierarchy + permission overrides
- Audit log, automod, anti-spam, reporting
- Search, unread state, notifications
- Webhook/bot basics
- Desktop'ta yüksek kaliteli screen share

## Görsel Yön
- Premium, sakin, özgün
- Dark theme fakat flat black değil
- Layered surfaces, ince borderlar, kontrollü blur
- Custom sidebar, composer, context menu, profile flyout, call UI
- Motion-first ama rafine

## Repo İskeleti
constchat/
  apps/web
  apps/desktop
  apps/mobile
  services/api
  services/gateway
  services/media-signalling
  services/workers
  packages/design-tokens
  packages/ui-primitives
  packages/protocol
  packages/config
  infra/docker
  infra/k8s
  docs/product
  docs/architecture
  docs/runbooks

## Çalışma Şekli
Her büyük adımdan sonra şunları yaz:
- ne yaptın
- neden bu çözümü seçtin
- hangi dosyaları ekledin/değiştirdin
- nasıl çalıştırılır
- hangi riskler kaldı

## İlk Uygulama Sırası
1. Foundation + brand tokens + shell
2. Auth + sessions
3. Guild/channel/message core
4. Realtime gateway + typed events
5. Permissions + roles + audit log
6. Attachments + reactions + threads
7. DM/group DM
8. Voice/video + LiveKit veya seçilen SFU
9. Screen share quality profiles
10. Search + notifications + moderation polish
