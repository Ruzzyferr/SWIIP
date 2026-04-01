---
name: Mobile App Progress
description: Swiip mobil uygulama geliştirme durumu — tamamlanan fazlar, kalan işler, dosya listesi
type: project
---

# Swiip Mobil Uygulama İlerleme Durumu

**Son güncelleme:** 2026-04-01
**Proje dizini:** `C:\dev\swiip\apps\mobile\`
**Plan dosyası:** `C:\Users\ruzzy\.claude\plans\wise-hopping-puddle.md`

---

## Tamamlanan Fazlar

### Faz 0: Proje Kurulumu ✅
- Expo SDK 52 + React Native 0.76 + React 18.3.1
- `apps/mobile/package.json`, `app.json`, `metro.config.js`, `babel.config.js`, `tsconfig.json`
- `App.tsx` — Inter font loading, SplashScreen, GestureHandlerRootView
- Proje `C:\dev\swiip\` dizinine taşındı (OneDrive path sorunları için)

### Faz 1: Shared Package Çıkarımı ✅
- `packages/shared/` oluşturuldu — tsup ile CJS+ESM+DTS build
- **10 Zustand store** taşındı (auth, gateway, guilds, messages, presence, dms, friends, ui, appearance, voice)
- **8 API modülü** factory pattern ile yazıldı (auth, guilds, channels, messages, friends, dms, roles, moderation, users)
- `createApiClient(config)` — platform-agnostic HTTP client factory
- `createAuthStore(storage?)` — injectable persist storage adapter
- `createVoiceStore(platform, storage?)` — injectable audio platform
- Web importları henüz güncellenmedi (kırılma riski yok, duplice çalışıyor)

### Faz 2: UI Primitives ✅
- `src/components/ui/` — 8 bileşen:
  - `Text.tsx` — 6 variant (body, heading, subheading, caption, label, code)
  - `Button.tsx` — 4 variant (primary, secondary, ghost, danger), 3 size, loading state
  - `Input.tsx` — label, error, focus border states
  - `Avatar.tsx` — image/initial fallback, 4 size (sm/md/lg/xl), status dot overlay
  - `Badge.tsx` — notification count badge with max
  - `Surface.tsx` — 5 elevation level (base/elevated/raised/overlay/floating)
  - `Divider.tsx` — horizontal divider
  - `StatusDot.tsx` — online/idle/dnd/offline dot
  - `index.ts` — barrel export
- `src/lib/theme.ts` — design token'lardan RN-compatible numeric değerler

### Faz 3: Auth + Gateway Bağlantısı ✅
- `src/lib/gateway.ts` — Mobile GatewayClient (AppState-based reconnect, heartbeat, session resume)
- `src/lib/stores.ts` — SecureStore-backed auth store + shared store re-exports
- `src/hooks/useGatewayBridge.ts` — 20+ event type store wiring (messages, guilds, voice, presence, DMs, friends, reactions, read states, notifications)
- `src/context/AuthContext.tsx` — Zustand store-backed, login/register/logout + gateway auto-connect
- `src/lib/api.ts` — Axios client with SecureStore token management + 401 refresh
- Navigation: `RootNavigator` → conditional Auth/Main stack based on isAuthenticated
- `AuthStack` — Login ↔ Register

### Faz 4: Mesajlaşma MVP ✅
- `ChannelChatScreen.tsx` — FlashList inverted mesaj listesi, message grouping (5dk kuralı), pull-to-load-more cursor pagination, mesaj composer + gönderme
- `DMChatScreen.tsx` — Aynı pattern, DM konuşmaları için
- `ChannelListScreen.tsx` — Kategori bazlı SectionList, gerçek store verileri, TEXT/VOICE/ANNOUNCEMENT channel types
- `DMListScreen.tsx` — DM konuşma listesi, Avatar ile recipient gösterimi
- `GuildListScreen.tsx` — Sunucu listesi, gerçek guild store verileri, guild ikonları
- `FriendsScreen.tsx` — Çevrimiçi/Tümü/Bekleyen tabs, arkadaş listesi, presence durumu
- `ProfileScreen.tsx` — User avatar/displayName, ayar menüsü, logout

### CI Fix ✅
- `packages/shared/tsconfig.json` — paths override ile rootDir typecheck hatası düzeltildi
- CI `quality` job `@constchat/shared#typecheck` artık geçiyor
- `@constchat/web#typecheck` hatası pre-existing (React 18/19 @types/react conflict — bizim değişikliklerimizle ilgisiz)

---

## Kalan Fazlar

### Faz 5: DM + Arkadaşlar (Detay İyileştirmeleri) 🔜
**Durum:** Temel ekranlar Faz 4'te oluşturuldu. Eksik kalan detaylar:
- [ ] DM oluşturma (kullanıcı arama + yeni DM başlatma)
- [ ] Arkadaş ekleme (kullanıcı adı ile arama + istek gönderme)
- [ ] Arkadaşlık isteği kabul/reddet butonları
- [ ] Engelleme işlemi
- [ ] Okunmamış mesaj sayacı (Badge bileşeni ile)
- [ ] DM listesinde son mesaj preview
- [ ] Online presence dot (DM listesinde)
- [ ] Pull-to-refresh tüm listelerde

### Faz 6: Sesli/Görüntülü Arama 🔮
- [ ] `@livekit/react-native` + `react-native-webrtc` entegrasyonu
- [ ] Voice channel'a katılma/ayrılma
- [ ] Katılımcı grid (konuşma göstergeleri)
- [ ] Mute/deafen/kamera kontrolleri
- [ ] Background audio: `expo-av`
- [ ] **NOT:** Expo Go ile çalışmaz, EAS Development Build gerekli

### Faz 7: Push Notifications 🔮
- [ ] `expo-notifications` (APNs + FCM) kurulumu
- [ ] **Backend değişikliği gerekli:** `POST /users/@me/devices` endpoint (push token kayıt)
- [ ] `services/workers/` servisine push delivery ekle
- [ ] Notification tap → deep link ile ilgili ekrana git
- [ ] Badge count güncelleme

### Faz 8: i18n (Çoklu Dil) 🔮
- [ ] `i18next` + `react-i18next` + `expo-localization`
- [ ] Mevcut web çeviri dosyalarını (`en.json`, `tr.json`) paylaş
- [ ] Otomatik dil algılama
- [ ] Tüm hardcoded Türkçe stringleri çeviri anahtarlarına çevir

### Faz 9: Polish 🔮
- [ ] Haptic feedback (`expo-haptics`)
- [ ] Image picker (`expo-image-picker`) — mesajlara resim ekleme
- [ ] Biyometrik auth (`expo-local-authentication`)
- [ ] Splash screen tasarımı, app icon
- [ ] Safe area handling tüm ekranlarda
- [ ] Keyboard handling iyileştirmeleri (KeyboardAvoidingView tuning)
- [ ] Offline indicator
- [ ] Error boundary + error state ekranları
- [ ] Skeleton loading states

---

## Backend Değişiklik İhtiyaçları

1. **✅ X-Refresh-Token header desteği** — Mobil cookie kullanamaz, auth refresh endpoint header'dan da token kabul etmeli (shared API client'ta implement edildi, backend tarafı kontrol edilmeli)
2. **🔮 Push token endpoint** — `POST /users/@me/devices` (Faz 7 için)
3. **🔮 Push delivery worker** — `services/workers/` (Faz 7 için)

---

## Önemli Dosya Haritası

```
apps/mobile/
├── App.tsx                          # Root (font loading, splash, auth provider)
├── app.json                         # Expo config (branding, permissions)
├── metro.config.js                  # Monorepo workspace resolution
├── babel.config.js                  # @/ alias + reanimated
├── tsconfig.json                    # Expo base + path aliases
├── src/
│   ├── lib/
│   │   ├── api.ts                   # Axios + SecureStore token management
│   │   ├── gateway.ts               # Mobile GatewayClient (WebSocket)
│   │   ├── stores.ts                # Mobile auth store + shared re-exports
│   │   └── theme.ts                 # Design tokens → RN numeric values
│   ├── context/
│   │   └── AuthContext.tsx           # Zustand-backed auth context + gateway bridge
│   ├── hooks/
│   │   └── useGatewayBridge.ts      # Gateway event → store wiring
│   ├── navigation/
│   │   ├── RootNavigator.tsx        # Auth/Main conditional
│   │   ├── AuthStack.tsx            # Login ↔ Register
│   │   └── MainTabs.tsx             # Bottom tabs + nested stacks
│   ├── components/ui/
│   │   ├── Text.tsx, Button.tsx, Input.tsx, Avatar.tsx
│   │   ├── Badge.tsx, Surface.tsx, Divider.tsx, StatusDot.tsx
│   │   └── index.ts
│   └── screens/
│       ├── auth/
│       │   ├── LoginScreen.tsx
│       │   └── RegisterScreen.tsx
│       └── main/
│           ├── GuildListScreen.tsx   # Sunucu listesi (store'dan)
│           ├── ChannelListScreen.tsx # Kanal listesi (kategorili)
│           ├── ChannelChatScreen.tsx # FlashList mesajlaşma + composer
│           ├── DMListScreen.tsx      # DM listesi
│           ├── DMChatScreen.tsx      # DM mesajlaşma + composer
│           ├── FriendsScreen.tsx     # Arkadaşlar (tabs: çevrimiçi/tümü/bekleyen)
│           └── ProfileScreen.tsx    # Profil + ayarlar + çıkış

packages/shared/
├── src/
│   ├── stores/   # 10 Zustand store (auth, gateway, guilds, messages, presence, dms, friends, ui, appearance, voice)
│   ├── api/      # 9 API factory module (auth, guilds, channels, messages, friends, dms, roles, moderation, users)
│   ├── types/    # Shared types (RelationshipPayload, AudioPlatform, etc.)
│   └── index.ts  # Barrel export
├── tsup.config.ts
└── tsconfig.json  # paths override for rootDir fix
```

---

## Bir Sonraki Adım

**Faz 5: DM + Arkadaşlar detay iyileştirmeleri** ile devam edilecek. Temel ekranlar hazır, eksik olan kullanıcı etkileşim özellikleri (arkadaş ekleme, DM oluşturma, okunmamış sayaçlar, pull-to-refresh vb.).

**Why:** MVP tanımı Faz 0-5 = beta test edilebilir uygulama. Faz 4 sonrası mesajlaşma çalışıyor ama DM/arkadaş etkileşim detayları eksik.

**How to apply:** Bu dosyayı göster, kaldığım yerden devam et.
