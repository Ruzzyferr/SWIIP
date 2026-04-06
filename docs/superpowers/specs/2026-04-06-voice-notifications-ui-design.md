# Voice, Notifications & UI Improvements Design Spec

**Date:** 2026-04-06
**Scope:** 6 features — Web Push, Incoming Call Modal, Outgoing Call Screen, Return-to-Call Bar, Voice Room UI, Desktop App Icon

---

## 1. Web Push Notifications

### Goal
Send push notifications to users even when the app/tab is closed — for mentions, DMs, friend requests, system notifications, and incoming voice calls.

### Backend Changes

**New dependencies:** `web-push` npm package in `services/workers`

**Database — new table `PushSubscription`:**
```
id          String   @id @default(cuid())
userId      String
endpoint    String
p256dh      String   // public key
auth        String   // auth secret
createdAt   DateTime @default(now())
@@unique([userId, endpoint])
```

**New API endpoints in `services/api`:**
- `POST /notifications/push/subscribe` — save push subscription
- `DELETE /notifications/push/unsubscribe` — remove subscription
- VAPID keys stored as env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

**Worker changes (`notification.worker.ts`):**
- After creating in-app notification record, query `PushSubscription` for recipient
- Send web push via `web-push.sendNotification()` with payload `{ title, body, icon, url, tag }`
- Handle expired/invalid subscriptions (HTTP 410 → delete subscription)

### Frontend Changes

**Service Worker (`sw.js`):**
```js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon: data.icon, tag: data.tag,
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

**Subscription flow (`useGatewayBridge.ts` or new hook):**
- After `Notification.requestPermission()` granted, call `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY, userVisibleOnly: true })`
- POST subscription to `/notifications/push/subscribe`
- Re-subscribe on token refresh

### Notification Types & Payloads
| Type | Title | Body | URL |
|------|-------|------|-----|
| mention | "Mentioned by {user}" | message preview | channel URL |
| dm | "{user}" | message preview | DM URL |
| friend_request | "Friend Request" | "{user} sent you a friend request" | /friends |
| system | dynamic | dynamic | dynamic |
| incoming_call | "{user} is calling" | "Incoming voice call" | channel/DM URL |

---

## 2. Incoming Call Modal

### Goal
When someone initiates a DM voice call, show an incoming call popup to the recipient — both as an in-app modal and as a native Electron window on desktop.

### Backend — New Gateway Opcodes

**Protocol events (add to `packages/protocol/src/events.ts`):**
- `VOICE_CALL_RING` — server → recipient: `{ callerId, callerName, callerAvatar, channelId, callType: 'dm' | 'group_dm' }`
- `VOICE_CALL_ACCEPT` — recipient → server: `{ channelId }`
- `VOICE_CALL_DECLINE` — recipient → server: `{ channelId }`
- `VOICE_CALL_CANCEL` — caller → server (caller cancels before answer): `{ channelId }`
- `VOICE_CALL_TIMEOUT` — server → both (30s no answer): `{ channelId }`

**Gateway handling:**
- When caller sends `VOICE_JOIN` for a DM channel, gateway sends `VOICE_CALL_RING` to all other DM participants
- Server tracks pending calls with 30s TTL
- On accept: proceed with normal `VOICE_SERVER_UPDATE` flow
- On decline/timeout/cancel: notify both sides, clean up

### Frontend — Web Modal

**New component: `IncomingCallModal.tsx`**
- Full-screen semi-transparent overlay (z-50)
- Centered card with:
  - Caller's avatar (large, pulsing green ring animation)
  - Caller's display name
  - "Incoming voice call" text
  - Accept button (green, phone icon) / Decline button (red, phone-off icon)
- Plays ringtone sound (new audio file in `/public/sounds/`)
- Auto-dismiss after 30s (timeout)
- Listens to `VOICE_CALL_RING` event from gateway

### Frontend — Electron Native Window

**New Electron window (`main.js`):**
- IPC event `show-incoming-call` from renderer → main process
- Creates small `BrowserWindow` (400x200, always-on-top, frameless, centered)
- Loads a simple HTML page with caller info + accept/decline buttons
- Flashes taskbar icon
- On accept: IPC back to renderer, close popup window
- On decline: IPC back to renderer, close popup window
- Preload script exposes `ipcRenderer.invoke('accept-call')` / `ipcRenderer.invoke('decline-call')`

---

## 3. Outgoing Call Screen ("Araniyor")

### Goal
When initiating a DM voice call, show a "calling" screen while waiting for the recipient to answer. When joining a voice channel, show a brief "connecting" screen.

### DM Call — Outgoing Call View

**New component: `OutgoingCallScreen.tsx`**
- Replaces chat view when initiating a DM call
- UI:
  - Callee's avatar (large, centered, pulsing ring animation)
  - Callee's display name
  - "Araniyor..." / "Calling..." text with animated dots
  - Elapsed time counter
  - Cancel button (red, ends the call attempt)
- Plays outgoing ring sound (looping)
- Transitions:
  - Accept → normal VoiceRoomView
  - Decline → toast "Call declined", return to chat
  - Timeout (30s) → toast "No answer", return to chat
  - Cancel → return to chat

### Voice Channel — Connecting Screen

**Modify existing `VoiceRoomView.tsx`:**
- When `connectionState === 'connecting'`, show a connecting overlay:
  - Channel name
  - Animated connecting indicator (pulsing dots or spinner)
  - "Connecting to voice..." text
- Once `connectionState === 'connected'`, fade into normal participant grid

---

## 4. Return-to-Call Bar

### Goal
When user navigates away from the active voice channel, show a prominent green bar at the top of the content area to quickly return.

### Implementation

**New component: `ReturnToCallBar.tsx`**
- Renders when: `voiceStore.currentChannelId !== null && currentViewedChannelId !== voiceStore.currentChannelId`
- Position: top of content area, below SwiipTopBar, full width
- Style: solid green background (#43b581 or accent-green), white text, h-8
- Content: "Aramaya Don — {channel name}" + click handler navigates to voice channel
- Click: `router.push(/channels/{guildId}/{channelId})`
- Elapsed call time on the right side

### Mount Point
- Add to `ChannelPage` layout, conditionally rendered above the main content area

---

## 5. Voice Room UI Improvements

### Goal
When viewing the active voice channel, provide a dedicated call-focused layout: no server navigation in top bar, member sidebar always visible.

### Top Bar Changes (`SwiipTopBar.tsx` or new `VoiceTopBar.tsx`)

When viewing active voice channel:
- Hide: ServerSwitcher dropdown, ChannelTabs
- Show instead:
  - Channel name (left)
  - Call duration timer
  - Participant count
  - Minimize/PiP button (optional, future)
- Keep: right-side actions (members toggle, etc.)

### Member Sidebar
- When in active voice channel, `MemberSidebar` defaults to open (not toggleable-off)
- `VoiceChannelUsers` component shown at top of sidebar with speaking indicators

### Content Area
- `VoiceRoomView` fills remaining space between voice top bar and bottom dock
- Participant grid/spotlight unchanged

---

## 6. Desktop App Icon Fix

### Problem
Windows shortcut shows Electron default atom icon instead of Swiip owl icon.

### Root Cause
`icon.ico` exists and is configured in `electron-builder`, but:
1. `BrowserWindow` uses `icon.png` — should use `icon.ico` on Windows
2. Possible: `.ico` was generated after initial install, shortcut cached old icon

### Fix
- In `main.js`, use platform-aware icon path:
  ```js
  icon: path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
  ```
- Ensure `generate:ico` script runs in build pipeline (already does)
- After rebuild + reinstall, Windows should pick up correct icon
- Verify tray icon visibility (already uses `tray-icon.png`, may need lighter version)

---

## File Impact Summary

### New Files
| File | Purpose |
|------|---------|
| `apps/web/src/components/voice/IncomingCallModal.tsx` | Incoming call overlay |
| `apps/web/src/components/voice/OutgoingCallScreen.tsx` | Outgoing call "ringing" view |
| `apps/web/src/components/voice/ReturnToCallBar.tsx` | Green return-to-call bar |
| `apps/web/src/components/voice/VoiceTopBar.tsx` | Simplified top bar for active call |
| `apps/web/src/hooks/usePushSubscription.ts` | Web push subscription management |
| `apps/web/public/sounds/ringtone.mp3` | Incoming call ringtone |
| `apps/web/public/sounds/outgoing-ring.mp3` | Outgoing call ring |

### Modified Files
| File | Changes |
|------|---------|
| `services/workers/prisma/schema.prisma` | Add PushSubscription model |
| `services/workers/src/workers/notification.worker.ts` | Add web-push sending |
| `services/api/src/notifications/notifications.controller.ts` | Push subscribe/unsubscribe endpoints |
| `services/api/src/notifications/notifications.service.ts` | Push subscription CRUD |
| `packages/protocol/src/events.ts` | Add VOICE_CALL_* opcodes |
| `services/gateway/src/subscriptions/subscription.manager.ts` | Handle call ring/accept/decline |
| `apps/web/public/sw.js` | Add push event listener |
| `apps/web/src/hooks/useGatewayBridge.ts` | Handle VOICE_CALL_RING, push subscription |
| `apps/web/src/components/voice/VoiceRoomView.tsx` | Add connecting overlay |
| `apps/web/src/components/voice/VoiceConnectionPanel.tsx` | Minor adjustments |
| `apps/web/src/components/layout/SwiipTopBar.tsx` | Conditional voice mode |
| `apps/web/src/components/layout/MemberSidebar.tsx` | Always-open in voice mode |
| `apps/web/src/stores/voice.store.ts` | Add call state (ringing, callerId, etc.) |
| `apps/web/src/app/(app)/channels/[guildId]/[channelId]/page.tsx` | Add ReturnToCallBar |
| `apps/desktop/src/main.js` | Fix icon path, add incoming call window |
