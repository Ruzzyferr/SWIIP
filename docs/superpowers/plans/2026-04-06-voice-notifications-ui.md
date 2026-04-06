# Voice, Notifications & UI Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Web Push notifications, DM voice calling flow (ring/accept/decline), return-to-call bar, voice room UI improvements, and fix desktop app icon.

**Architecture:** 6 independent features built incrementally. Protocol changes first, then backend, then frontend. Each feature is self-contained and can be committed independently.

**Tech Stack:** Next.js (web), Electron (desktop), NestJS (API), uWebSockets (gateway), Prisma (ORM), Redis (pub/sub), LiveKit (voice), web-push (push notifications), Zustand (state), Framer Motion (animations)

---

## Task 1: Desktop App Icon Fix

**Files:**
- Modify: `apps/desktop/src/main.js:113` (BrowserWindow icon path)

- [ ] **Step 1: Fix BrowserWindow icon to use .ico on Windows**

In `apps/desktop/src/main.js`, line 113, change:

```js
// OLD:
icon: path.join(__dirname, '..', 'build', 'icon.png'),

// NEW:
icon: path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
```

Also fix the splash window icon at line ~309 the same way:

```js
// OLD:
const splashIcon = path.join(__dirname, '..', 'build', 'icon.png');

// NEW:
const splashIcon = path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
```

- [ ] **Step 2: Verify tray icon visibility**

Read `apps/desktop/build/tray-icon.png`. If it's too dark (the current one is nearly invisible), we need a lighter version. The tray icon should be a simplified white/light silhouette of the owl. For now, use the main `icon.png` as fallback if `tray-icon.png` is < 1KB:

In `main.js` around line 199, the tray icon setup:

```js
const iconPath = path.join(__dirname, '..', 'build', 'tray-icon.png');
const fs = require('fs');
let trayIcon;
try {
  const stats = fs.statSync(iconPath);
  if (stats.size > 1024) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    trayIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'));
  }
  trayIcon = trayIcon.resize({ width: 16, height: 16 });
} catch {
  trayIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png')).resize({ width: 16, height: 16 });
}
```

- [ ] **Step 3: Rebuild and test**

Run: `cd apps/desktop && npm run build:nobundle`

Verify the output .exe has the owl icon, not the Electron atom.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main.js
git commit -m "fix: use .ico for Windows app icon, fix tray icon fallback"
```

---

## Task 2: Protocol — Add Voice Call Opcodes

**Files:**
- Modify: `packages/protocol/src/events.ts`

- [ ] **Step 1: Add new ClientEventType entries**

In `packages/protocol/src/events.ts`, add to `ClientEventType` enum (after `VOICE_STATE_UPDATE` at line 316):

```typescript
VOICE_CALL_ACCEPT = 'VOICE_CALL_ACCEPT',
VOICE_CALL_DECLINE = 'VOICE_CALL_DECLINE',
VOICE_CALL_CANCEL = 'VOICE_CALL_CANCEL',
```

- [ ] **Step 2: Add new ServerEventType entries**

In the `ServerEventType` enum (after `VOICE_SERVER_UPDATE` at line 429):

```typescript
VOICE_CALL_RING = 'VOICE_CALL_RING',
VOICE_CALL_ACCEPTED = 'VOICE_CALL_ACCEPTED',
VOICE_CALL_DECLINED = 'VOICE_CALL_DECLINED',
VOICE_CALL_CANCELLED = 'VOICE_CALL_CANCELLED',
VOICE_CALL_TIMEOUT = 'VOICE_CALL_TIMEOUT',
```

- [ ] **Step 3: Add ClientEvent union entries**

Add to the `ClientEvent` type union (after the `VOICE_LEAVE` entry at line 375):

```typescript
| { t: ClientEventType.VOICE_CALL_ACCEPT; d: { channelId: string } }
| { t: ClientEventType.VOICE_CALL_DECLINE; d: { channelId: string } }
| { t: ClientEventType.VOICE_CALL_CANCEL; d: { channelId: string } }
```

- [ ] **Step 4: Add ServerEvent union entries**

Add to the `ServerEvent` type union (after the `VOICE_SERVER_UPDATE` entry at line ~561):

```typescript
| {
    t: ServerEventType.VOICE_CALL_RING;
    d: {
      channelId: string;
      callerId: string;
      callerName: string;
      callerAvatar: string | null;
      callType: 'dm' | 'group_dm';
    };
  }
| { t: ServerEventType.VOICE_CALL_ACCEPTED; d: { channelId: string; userId: string } }
| { t: ServerEventType.VOICE_CALL_DECLINED; d: { channelId: string; userId: string } }
| { t: ServerEventType.VOICE_CALL_CANCELLED; d: { channelId: string } }
| { t: ServerEventType.VOICE_CALL_TIMEOUT; d: { channelId: string } }
```

- [ ] **Step 5: Add 'incoming_call' to NotificationType**

At line 62, update:

```typescript
export type NotificationType =
  | 'mention'
  | 'reply'
  | 'dm'
  | 'friend_request'
  | 'system'
  | 'incoming_call';
```

- [ ] **Step 6: Build protocol package to verify types compile**

Run: `cd packages/protocol && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add packages/protocol/src/events.ts
git commit -m "feat: add voice call ring/accept/decline protocol events"
```

---

## Task 3: Gateway — Handle Voice Call Ring/Accept/Decline

**Files:**
- Modify: `services/gateway/src/handlers/message.handler.ts`

- [ ] **Step 1: Read the full message handler**

Read `services/gateway/src/handlers/message.handler.ts` to understand the existing VOICE_JOIN handler structure (around lines 415-540) and the VOICE_LEAVE handler (lines 543-584).

- [ ] **Step 2: Add call ring logic to VOICE_JOIN for DM channels**

After the existing `VOICE_JOIN` handler sends the `VOICE_SERVER_UPDATE` (around line 535), add DM ringing logic:

```typescript
// After VOICE_SERVER_UPDATE is sent, ring other DM participants
if (isDMCall) {
  try {
    // Fetch DM participants from API
    const participantsUrl = `${apiBase}/internal/channels/${d.channelId}/participants`;
    const partRes = await fetch(participantsUrl, {
      headers: { 'X-Internal-Token': context.config.JWT_SECRET },
      signal: AbortSignal.timeout(3_000),
    });
    if (partRes.ok) {
      const participants = (await partRes.json()) as Array<{ userId: string }>;
      const otherParticipants = participants.filter(p => p.userId !== session.userId);
      
      // Get caller info
      const userUrl = `${apiBase}/internal/users/${session.userId}`;
      const userRes = await fetch(userUrl, {
        headers: { 'X-Internal-Token': context.config.JWT_SECRET },
        signal: AbortSignal.timeout(3_000),
      });
      const caller = userRes.ok ? await userRes.json() as { username: string; globalName?: string; avatarId?: string } : null;
      
      // Publish VOICE_CALL_RING to each other participant via Redis
      for (const p of otherParticipants) {
        const ringPayload = JSON.stringify({
          op: OpCode.DISPATCH,
          t: ServerEventType.VOICE_CALL_RING,
          d: {
            channelId: d.channelId,
            callerId: session.userId,
            callerName: caller?.globalName || caller?.username || 'Unknown',
            callerAvatar: caller?.avatarId || null,
            callType: 'dm',
          },
        });
        context.pubsub.getPublisher().publish(`user:${p.userId}`, ringPayload).catch(() => {});
      }
      
      // Set a 30s timeout in Redis for this call
      const callKey = `swiip:call:${d.channelId}`;
      await context.pubsub.getPublisher().set(callKey, session.userId, 'EX', 30);
      
      log.info({ channelId: d.channelId, recipients: otherParticipants.length }, 'VOICE_JOIN: DM call ring sent');
    }
  } catch (err) {
    log.warn({ err }, 'VOICE_JOIN: failed to send DM call ring');
  }
}
```

- [ ] **Step 3: Add VOICE_CALL_ACCEPT handler**

Add a new case in the message handler switch statement:

```typescript
case ClientEventType.VOICE_CALL_ACCEPT: {
  const d = data as { channelId: string };
  if (!d.channelId) return;
  
  // Clear the call timeout
  const callKey = `swiip:call:${d.channelId}`;
  const callerId = await context.pubsub.getPublisher().get(callKey);
  await context.pubsub.getPublisher().del(callKey);
  
  // Notify the caller that the call was accepted
  if (callerId) {
    const acceptPayload = JSON.stringify({
      op: OpCode.DISPATCH,
      t: ServerEventType.VOICE_CALL_ACCEPTED,
      d: { channelId: d.channelId, userId: session.userId },
    });
    context.pubsub.getPublisher().publish(`user:${callerId}`, acceptPayload).catch(() => {});
  }
  
  log.info({ userId: session.userId, channelId: d.channelId }, 'VOICE_CALL_ACCEPT');
  break;
}
```

- [ ] **Step 4: Add VOICE_CALL_DECLINE handler**

```typescript
case ClientEventType.VOICE_CALL_DECLINE: {
  const d = data as { channelId: string };
  if (!d.channelId) return;
  
  const callKey = `swiip:call:${d.channelId}`;
  const callerId = await context.pubsub.getPublisher().get(callKey);
  await context.pubsub.getPublisher().del(callKey);
  
  if (callerId) {
    const declinePayload = JSON.stringify({
      op: OpCode.DISPATCH,
      t: ServerEventType.VOICE_CALL_DECLINED,
      d: { channelId: d.channelId, userId: session.userId },
    });
    context.pubsub.getPublisher().publish(`user:${callerId}`, declinePayload).catch(() => {});
  }
  
  log.info({ userId: session.userId, channelId: d.channelId }, 'VOICE_CALL_DECLINE');
  break;
}
```

- [ ] **Step 5: Add VOICE_CALL_CANCEL handler**

```typescript
case ClientEventType.VOICE_CALL_CANCEL: {
  const d = data as { channelId: string };
  if (!d.channelId) return;
  
  const callKey = `swiip:call:${d.channelId}`;
  await context.pubsub.getPublisher().del(callKey);
  
  // Notify all DM participants that the call was cancelled
  try {
    const participantsUrl = `${context.apiBaseUrl}/internal/channels/${d.channelId}/participants`;
    const partRes = await fetch(participantsUrl, {
      headers: { 'X-Internal-Token': context.config.JWT_SECRET },
      signal: AbortSignal.timeout(3_000),
    });
    if (partRes.ok) {
      const participants = (await partRes.json()) as Array<{ userId: string }>;
      for (const p of participants) {
        if (p.userId === session.userId) continue;
        const cancelPayload = JSON.stringify({
          op: OpCode.DISPATCH,
          t: ServerEventType.VOICE_CALL_CANCELLED,
          d: { channelId: d.channelId },
        });
        context.pubsub.getPublisher().publish(`user:${p.userId}`, cancelPayload).catch(() => {});
      }
    }
  } catch (err) {
    log.warn({ err }, 'VOICE_CALL_CANCEL: failed to notify participants');
  }
  
  log.info({ userId: session.userId, channelId: d.channelId }, 'VOICE_CALL_CANCEL');
  break;
}
```

- [ ] **Step 6: Verify gateway compiles**

Run: `cd services/gateway && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add services/gateway/src/handlers/message.handler.ts
git commit -m "feat: handle voice call ring/accept/decline/cancel in gateway"
```

---

## Task 4: Voice Store — Add Call State

**Files:**
- Modify: `apps/web/src/stores/voice.store.ts`

- [ ] **Step 1: Read the full voice store**

Read `apps/web/src/stores/voice.store.ts` completely to understand the current state shape and all actions.

- [ ] **Step 2: Add call state types and properties**

Add after the `VoiceConnectionState` type (line 18):

```typescript
export type CallState = 'idle' | 'ringing_outgoing' | 'ringing_incoming' | 'accepted' | 'declined' | 'timeout' | 'cancelled';

export interface IncomingCall {
  channelId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  callType: 'dm' | 'group_dm';
  startedAt: number; // Date.now()
}
```

- [ ] **Step 3: Add call state properties to VoiceState interface**

Add these to the `VoiceState` interface (after `error: string | null` at line 89):

```typescript
// DM call state
callState: CallState;
incomingCall: IncomingCall | null;
outgoingCallChannelId: string | null;
callStartedAt: number | null; // timestamp for elapsed timer
```

- [ ] **Step 4: Add call state actions to VoiceState interface**

Add after existing actions (around line 149):

```typescript
// Call actions
setCallState: (state: CallState) => void;
setIncomingCall: (call: IncomingCall | null) => void;
setOutgoingCall: (channelId: string | null) => void;
setCallStartedAt: (timestamp: number | null) => void;
clearCallState: () => void;
```

- [ ] **Step 5: Add default values and action implementations**

In the `create` store initializer, add defaults:

```typescript
callState: 'idle',
incomingCall: null,
outgoingCallChannelId: null,
callStartedAt: null,
```

Add action implementations:

```typescript
setCallState: (callState) => set({ callState }),
setIncomingCall: (incomingCall) => set({ incomingCall }),
setOutgoingCall: (channelId) => set({ outgoingCallChannelId: channelId }),
setCallStartedAt: (timestamp) => set({ callStartedAt: timestamp }),
clearCallState: () => set({
  callState: 'idle',
  incomingCall: null,
  outgoingCallChannelId: null,
}),
```

- [ ] **Step 6: Update disconnect() to also clear call state**

In the existing `disconnect` action, add `clearCallState()` call or inline the reset:

```typescript
disconnect: () =>
  set((state) => {
    // existing resets...
    state.callState = 'idle';
    state.incomingCall = null;
    state.outgoingCallChannelId = null;
    state.callStartedAt = null;
    // rest of existing disconnect logic...
  }),
```

- [ ] **Step 7: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/stores/voice.store.ts
git commit -m "feat: add call state (ring/accept/decline) to voice store"
```

---

## Task 5: Gateway Bridge — Handle Call Events + Ringtone

**Files:**
- Modify: `apps/web/src/hooks/useGatewayBridge.ts`
- Modify: `apps/web/src/lib/sounds.ts`

- [ ] **Step 1: Add ringtone and outgoing ring sounds**

In `apps/web/src/lib/sounds.ts`, add at the bottom:

```typescript
/** Repeating ringtone for incoming call — plays two-tone pattern */
let ringtoneInterval: ReturnType<typeof setInterval> | null = null;

export function playRingtone() {
  stopRingtone();
  const ring = () => {
    try {
      const ctx = getAudioContext();
      // First ring
      const g1 = ctx.createGain();
      g1.connect(ctx.destination);
      g1.gain.setValueAtTime(0.15, ctx.currentTime);
      g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(440, ctx.currentTime);
      o1.frequency.setValueAtTime(520, ctx.currentTime + 0.15);
      o1.connect(g1);
      o1.start(ctx.currentTime);
      o1.stop(ctx.currentTime + 0.3);

      // Second ring (delayed)
      const g2 = ctx.createGain();
      g2.connect(ctx.destination);
      g2.gain.setValueAtTime(0.15, ctx.currentTime + 0.35);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(440, ctx.currentTime + 0.35);
      o2.frequency.setValueAtTime(520, ctx.currentTime + 0.5);
      o2.connect(g2);
      o2.start(ctx.currentTime + 0.35);
      o2.stop(ctx.currentTime + 0.65);
    } catch {}
  };
  ring();
  ringtoneInterval = setInterval(ring, 2000);
}

export function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

/** Outgoing call ring — softer, single tone repeating */
let outgoingRingInterval: ReturnType<typeof setInterval> | null = null;

export function playOutgoingRing() {
  stopOutgoingRing();
  const ring = () => {
    try {
      const ctx = getAudioContext();
      const g = ctx.createGain();
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(400, ctx.currentTime);
      o.connect(g);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.7);
    } catch {}
  };
  ring();
  outgoingRingInterval = setInterval(ring, 3000);
}

export function stopOutgoingRing() {
  if (outgoingRingInterval) {
    clearInterval(outgoingRingInterval);
    outgoingRingInterval = null;
  }
}
```

- [ ] **Step 2: Handle VOICE_CALL_RING in gateway bridge**

In `apps/web/src/hooks/useGatewayBridge.ts`, add a new event handler after the existing voice handlers:

```typescript
gw.on('voice_call_ring', (data: {
  channelId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  callType: 'dm' | 'group_dm';
}) => {
  const voiceStore = useVoiceStore.getState();
  // Don't ring if already in a call
  if (voiceStore.connectionState !== 'disconnected') return;
  
  voiceStore.setIncomingCall({
    channelId: data.channelId,
    callerId: data.callerId,
    callerName: data.callerName,
    callerAvatar: data.callerAvatar,
    callType: data.callType,
    startedAt: Date.now(),
  });
  voiceStore.setCallState('ringing_incoming');
  
  if (shouldPlaySound()) {
    playRingtone();
  }
  
  // Auto-timeout after 30s
  setTimeout(() => {
    const current = useVoiceStore.getState();
    if (current.callState === 'ringing_incoming' && current.incomingCall?.channelId === data.channelId) {
      current.clearCallState();
      stopRingtone();
    }
  }, 30000);
  
  // Desktop notification
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification(`${data.callerName} is calling`, {
        body: 'Incoming voice call',
        tag: `call-${data.channelId}`,
        requireInteraction: true,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {}
  }
  
  // Electron: show incoming call window
  const platform = getPlatformProvider();
  if (platform.showIncomingCall) {
    platform.showIncomingCall(data);
  }
});
```

- [ ] **Step 3: Handle VOICE_CALL_ACCEPTED, DECLINED, CANCELLED, TIMEOUT**

```typescript
gw.on('voice_call_accepted', (data: { channelId: string; userId: string }) => {
  const voiceStore = useVoiceStore.getState();
  if (voiceStore.outgoingCallChannelId === data.channelId) {
    voiceStore.setCallState('accepted');
    stopOutgoingRing();
    voiceStore.setCallStartedAt(Date.now());
  }
});

gw.on('voice_call_declined', (data: { channelId: string; userId: string }) => {
  const voiceStore = useVoiceStore.getState();
  if (voiceStore.outgoingCallChannelId === data.channelId) {
    voiceStore.setCallState('declined');
    stopOutgoingRing();
    toastInfo('Call declined');
    setTimeout(() => voiceStore.clearCallState(), 2000);
  }
});

gw.on('voice_call_cancelled', (data: { channelId: string }) => {
  const voiceStore = useVoiceStore.getState();
  if (voiceStore.incomingCall?.channelId === data.channelId) {
    voiceStore.clearCallState();
    stopRingtone();
  }
});

gw.on('voice_call_timeout', (data: { channelId: string }) => {
  const voiceStore = useVoiceStore.getState();
  if (voiceStore.outgoingCallChannelId === data.channelId || voiceStore.incomingCall?.channelId === data.channelId) {
    voiceStore.clearCallState();
    stopRingtone();
    stopOutgoingRing();
    toastInfo('Call timed out — no answer');
  }
});
```

- [ ] **Step 4: Add imports at top of useGatewayBridge.ts**

```typescript
import { playRingtone, stopRingtone, playOutgoingRing, stopOutgoingRing } from '@/lib/sounds';
```

- [ ] **Step 5: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useGatewayBridge.ts apps/web/src/lib/sounds.ts
git commit -m "feat: handle voice call events in gateway bridge, add ringtone sounds"
```

---

## Task 6: Incoming Call Modal

**Files:**
- Create: `apps/web/src/components/voice/IncomingCallModal.tsx`
- Modify: `apps/web/src/app/(app)/channels/[guildId]/[channelId]/page.tsx` (or app layout)

- [ ] **Step 1: Create IncomingCallModal component**

Create `apps/web/src/components/voice/IncomingCallModal.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';
import { stopRingtone } from '@/lib/sounds';
import { OpCode, ClientEventType } from '@constchat/protocol';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';

function CallerAvatar({ name, avatar }: { name: string; avatar: string | null }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="relative">
      {/* Pulsing ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: '3px solid var(--color-status-online)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold"
        style={{
          background: avatar
            ? `url(/api/avatars/${avatar}) center/cover`
            : 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary, #6366f1))',
          color: 'white',
        }}
      >
        {!avatar && initials}
      </div>
    </div>
  );
}

export function IncomingCallModal() {
  const incomingCall = useVoiceStore((s) => s.incomingCall);
  const callState = useVoiceStore((s) => s.callState);
  const { joinVoiceChannel } = useVoiceActions();
  const [elapsed, setElapsed] = useState(0);

  const isVisible = callState === 'ringing_incoming' && incomingCall !== null;

  // Elapsed timer
  useEffect(() => {
    if (!isVisible || !incomingCall) return;
    const start = incomingCall.startedAt;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isVisible, incomingCall]);

  const handleAccept = useCallback(() => {
    if (!incomingCall) return;
    stopRingtone();
    const gw = getGatewayClient();
    gw.send(OpCode.DISPATCH, { t: ClientEventType.VOICE_CALL_ACCEPT, d: { channelId: incomingCall.channelId } });
    joinVoiceChannel(incomingCall.channelId, true);
    useVoiceStore.getState().clearCallState();
  }, [incomingCall, joinVoiceChannel]);

  const handleDecline = useCallback(() => {
    if (!incomingCall) return;
    stopRingtone();
    const gw = getGatewayClient();
    gw.send(OpCode.DISPATCH, { t: ClientEventType.VOICE_CALL_DECLINE, d: { channelId: incomingCall.channelId } });
    useVoiceStore.getState().clearCallState();
  }, [incomingCall]);

  return (
    <AnimatePresence>
      {isVisible && incomingCall && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="flex flex-col items-center gap-6 p-10 rounded-3xl"
            style={{
              background: 'linear-gradient(180deg, rgba(20, 25, 30, 0.95), rgba(10, 14, 16, 0.98))',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
              minWidth: 320,
            }}
          >
            <CallerAvatar name={incomingCall.callerName} avatar={incomingCall.callerAvatar} />
            
            <div className="text-center">
              <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {incomingCall.callerName}
              </p>
              <motion.p
                className="text-sm mt-1"
                style={{ color: 'var(--color-text-secondary)' }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Incoming voice call...
              </motion.p>
              <p className="text-xs mt-2 tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                {elapsed}s
              </p>
            </div>

            <div className="flex items-center gap-6 mt-2">
              <button
                onClick={handleDecline}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ background: 'var(--color-danger-default)' }}
              >
                <PhoneOff size={22} className="text-white" />
              </button>
              <button
                onClick={handleAccept}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                style={{ background: 'var(--color-status-online)' }}
              >
                <Phone size={22} className="text-white" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Mount IncomingCallModal in app layout**

Read the app layout file (likely `apps/web/src/app/(app)/layout.tsx`) and add the modal. It needs to be mounted globally since calls can come in from any page:

```tsx
import { IncomingCallModal } from '@/components/voice/IncomingCallModal';

// Inside the layout's return, add at the top level (outside main content):
<IncomingCallModal />
```

- [ ] **Step 3: Verify it renders**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/voice/IncomingCallModal.tsx apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat: add incoming call modal with accept/decline UI"
```

---

## Task 7: Outgoing Call Screen

**Files:**
- Create: `apps/web/src/components/voice/OutgoingCallScreen.tsx`
- Modify: `apps/web/src/hooks/useVoiceActions.ts` (set outgoing call state on DM call)
- Modify: `apps/web/src/components/voice/VoiceRoomView.tsx` (show connecting overlay for channels)

- [ ] **Step 1: Set outgoing call state when calling DM**

In `apps/web/src/hooks/useVoiceActions.ts`, modify `joinVoiceChannel` — when `isDM` is true, set outgoing call state:

After `state.setConnectionState('connecting');` (line 40), add:

```typescript
if (isDM) {
  state.setOutgoingCall(channelId);
  state.setCallState('ringing_outgoing');
  playOutgoingRing();
}
```

Add import at top:

```typescript
import { playDisconnectSound, playOutgoingRing, stopOutgoingRing } from '@/lib/sounds';
```

Also add a `cancelOutgoingCall` action:

```typescript
const cancelOutgoingCall = useCallback(() => {
  const state = useVoiceStore.getState();
  if (!state.outgoingCallChannelId) return;
  const gw = getGatewayClient();
  gw.send(OpCode.DISPATCH, { t: 'VOICE_CALL_CANCEL', d: { channelId: state.outgoingCallChannelId } });
  stopOutgoingRing();
  state.clearCallState();
  state.disconnect();
}, []);
```

Return `cancelOutgoingCall` from the hook.

- [ ] **Step 2: Create OutgoingCallScreen component**

Create `apps/web/src/components/voice/OutgoingCallScreen.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PhoneOff } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';
import { useDMsStore } from '@/stores/dms.store';

export function OutgoingCallScreen({ channelId }: { channelId: string }) {
  const callState = useVoiceStore((s) => s.callState);
  const { cancelOutgoingCall } = useVoiceActions();
  const [elapsed, setElapsed] = useState(0);

  // Get callee info from DM store
  const conversation = useDMsStore((s) => s.conversations.find(c => c.id === channelId));
  const callee = conversation?.recipients?.[0];
  const calleeName = callee?.globalName || callee?.username || 'User';
  const calleeAvatar = callee?.avatar || null;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (callState !== 'ringing_outgoing') return null;

  const initials = calleeName.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-8"
      style={{ background: 'linear-gradient(180deg, rgba(10, 14, 16, 0.95), rgba(5, 8, 10, 1))' }}
    >
      {/* Avatar with pulsing ring */}
      <div className="relative">
        <motion.div
          className="absolute inset-[-12px] rounded-full"
          style={{ border: '2px solid var(--color-status-online)' }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-[-24px] rounded-full"
          style={{ border: '1px solid var(--color-status-online)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{
            background: calleeAvatar
              ? `url(/api/avatars/${calleeAvatar}) center/cover`
              : 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-secondary, #6366f1))',
            color: 'white',
          }}
        >
          {!calleeAvatar && initials}
        </div>
      </div>

      <div className="text-center">
        <p className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {calleeName}
        </p>
        <motion.p
          className="text-sm mt-2"
          style={{ color: 'var(--color-text-secondary)' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Calling...
        </motion.p>
        <p className="text-xs mt-3 tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </p>
      </div>

      <button
        onClick={cancelOutgoingCall}
        className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-110 mt-4"
        style={{ background: 'var(--color-danger-default)' }}
      >
        <PhoneOff size={24} className="text-white" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Add connecting overlay to VoiceRoomView**

Read `apps/web/src/components/voice/VoiceRoomView.tsx` and find where the main content renders. When `connectionState === 'connecting'` and the channel is not a DM, show a simple connecting overlay:

Add at the beginning of the VoiceRoomView component's return, before the participant grid:

```tsx
// Connecting overlay for voice channels
if (connectionState === 'connecting' && currentGuildId !== 'dm') {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4"
      style={{ background: 'linear-gradient(180deg, rgba(10, 14, 16, 0.95), rgba(5, 8, 10, 1))' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 size={40} style={{ color: 'var(--color-accent-primary)' }} />
      </motion.div>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Connecting to voice...
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Integrate OutgoingCallScreen into DM view**

When the user is in a DM and has `callState === 'ringing_outgoing'`, show the OutgoingCallScreen instead of the normal chat view. In the DM chat page or the channel page's DM branch, add:

```tsx
import { OutgoingCallScreen } from '@/components/voice/OutgoingCallScreen';
import { useVoiceStore } from '@/stores/voice.store';

// Inside the DM rendering:
const callState = useVoiceStore((s) => s.callState);
const outgoingCallChannelId = useVoiceStore((s) => s.outgoingCallChannelId);

if (callState === 'ringing_outgoing' && outgoingCallChannelId === channelId) {
  return <OutgoingCallScreen channelId={channelId} />;
}
```

- [ ] **Step 5: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/voice/OutgoingCallScreen.tsx apps/web/src/hooks/useVoiceActions.ts apps/web/src/components/voice/VoiceRoomView.tsx
git commit -m "feat: add outgoing call screen and connecting overlay"
```

---

## Task 8: Return-to-Call Bar

**Files:**
- Create: `apps/web/src/components/voice/ReturnToCallBar.tsx`
- Modify: `apps/web/src/app/(app)/channels/[guildId]/[channelId]/page.tsx`

- [ ] **Step 1: Create ReturnToCallBar component**

Create `apps/web/src/components/voice/ReturnToCallBar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';

export function ReturnToCallBar() {
  const router = useRouter();
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const currentGuildId = useVoiceStore((s) => s.currentGuildId);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const callStartedAt = useVoiceStore((s) => s.callStartedAt);
  const channels = useGuildsStore((s) => s.channels);
  const [elapsed, setElapsed] = useState('0:00');

  const channelName = currentChannelId ? channels[currentChannelId]?.name : null;

  // Elapsed timer
  useEffect(() => {
    if (!callStartedAt) return;
    const update = () => {
      const secs = Math.floor((Date.now() - callStartedAt) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setElapsed(`${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [callStartedAt]);

  if (!currentChannelId || connectionState === 'disconnected') return null;

  const handleClick = () => {
    if (currentGuildId && currentGuildId !== 'dm') {
      router.push(`/channels/${currentGuildId}/${currentChannelId}`);
    } else {
      router.push(`/channels/@me/${currentChannelId}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full h-8 flex items-center justify-center gap-2 text-sm font-medium text-white transition-colors hover:brightness-110 cursor-pointer shrink-0"
      style={{ background: 'var(--color-status-online, #43b581)' }}
    >
      <Phone size={14} />
      <span>Return to Call</span>
      {channelName && (
        <span style={{ opacity: 0.8 }}>— {channelName}</span>
      )}
      {callStartedAt && (
        <span className="tabular-nums ml-2" style={{ opacity: 0.7 }}>{elapsed}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Mount ReturnToCallBar in ChannelPage**

In `apps/web/src/app/(app)/channels/[guildId]/[channelId]/page.tsx`, add the bar.

Import at top:

```tsx
import { ReturnToCallBar } from '@/components/voice/ReturnToCallBar';
import { useVoiceStore } from '@/stores/voice.store';
```

Add logic to determine if bar should show (user is in a call but viewing a different channel):

```tsx
const voiceChannelId = useVoiceStore((s) => s.currentChannelId);
const voiceConnectionState = useVoiceStore((s) => s.connectionState);
const showReturnBar = voiceChannelId && voiceChannelId !== channelId && voiceConnectionState === 'connected';
```

In the JSX, add the bar at the top of the content area (inside the outer div, before the main flex content):

```tsx
<div className="flex flex-1 min-w-0 overflow-hidden relative flex-col">
  {showReturnBar && <ReturnToCallBar />}
  <div className="flex flex-1 min-w-0 overflow-hidden relative">
    {/* existing content */}
  </div>
</div>
```

- [ ] **Step 3: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/voice/ReturnToCallBar.tsx apps/web/src/app/\(app\)/channels/\[guildId\]/\[channelId\]/page.tsx
git commit -m "feat: add green return-to-call bar when viewing other channels"
```

---

## Task 9: Voice Room UI — Top Bar & Member Sidebar

**Files:**
- Create: `apps/web/src/components/voice/VoiceTopBar.tsx`
- Modify: `apps/web/src/components/layout/SwiipTopBar.tsx`
- Modify: `apps/web/src/app/(app)/channels/[guildId]/[channelId]/page.tsx`

- [ ] **Step 1: Create VoiceTopBar component**

Create `apps/web/src/components/voice/VoiceTopBar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Volume2, Users, PhoneOff } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';

export function VoiceTopBar({ channelId, guildId }: { channelId: string; guildId: string }) {
  const callStartedAt = useVoiceStore((s) => s.callStartedAt);
  const participants = useVoiceStore((s) => s.getChannelParticipants(channelId));
  const channelName = useGuildsStore((s) => s.channels[channelId]?.name) ?? 'Voice';
  const { leaveVoiceChannel } = useVoiceActions();
  const [elapsed, setElapsed] = useState('0:00');

  useEffect(() => {
    if (!callStartedAt) return;
    const update = () => {
      const secs = Math.floor((Date.now() - callStartedAt) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setElapsed(`${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [callStartedAt]);

  return (
    <div
      className="h-12 flex items-center px-4 gap-4 shrink-0"
      style={{
        background: 'var(--color-surface-base)',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Channel info */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Volume2 size={18} style={{ color: 'var(--color-status-online)' }} />
        <span className="font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
          {channelName}
        </span>
      </div>

      {/* Call info */}
      <div className="flex items-center gap-4">
        {callStartedAt && (
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
            {elapsed}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <Users size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {participants.length}
          </span>
        </div>
        <button
          onClick={leaveVoiceChannel}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/20"
          style={{ color: 'var(--color-danger-default)' }}
        >
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Hide SwiipTopBar when viewing active voice channel**

In `apps/web/src/components/layout/SwiipTopBar.tsx`, the component needs to know if the user is currently viewing their active voice channel. Read the full SwiipTopBar to find where it's exported and the render.

Add a prop or use the voice store directly:

```tsx
// At top of SwiipTopBar component:
const voiceChannelId = useVoiceStore((s) => s.currentChannelId);
const voiceConnectionState = useVoiceStore((s) => s.connectionState);
const activeChannelId = useUIStore((s) => s.activeChannelId);

const isViewingActiveVoice = voiceChannelId === activeChannelId && voiceConnectionState === 'connected';

// Wrap the entire return in:
if (isViewingActiveVoice) return null;
```

- [ ] **Step 3: Show VoiceTopBar in ChannelPage when viewing active voice**

In `apps/web/src/app/(app)/channels/[guildId]/[channelId]/page.tsx`, import and conditionally render:

```tsx
import { VoiceTopBar } from '@/components/voice/VoiceTopBar';

// In the voice channel section, before VoiceRoomView:
const isActiveVoice = voiceChannelId === channelId && voiceConnectionState === 'connected';

// In JSX:
{isVoiceChannel && isActiveVoice && <VoiceTopBar channelId={channelId} guildId={guildId} />}
```

- [ ] **Step 4: Force MemberSidebar open when in active voice channel**

In `ChannelPage`, when viewing the active voice channel, override `isMemberSidebarOpen` to always be true:

```tsx
const effectiveMemberSidebarOpen = (isVoiceChannel && isActiveVoice) || isMemberSidebarOpen;
```

Use `effectiveMemberSidebarOpen` instead of `isMemberSidebarOpen` in the MemberSidebar AnimatePresence condition. Also remove the `!isVoiceChatOpen` condition when in active voice:

```tsx
{effectiveMemberSidebarOpen && !(isVoiceChannel && isVoiceChatOpen && !isActiveVoice) && (
  <motion.div ...>
    <MemberSidebar ... />
  </motion.div>
)}
```

- [ ] **Step 5: Verify types compile**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/voice/VoiceTopBar.tsx apps/web/src/components/layout/SwiipTopBar.tsx apps/web/src/app/\(app\)/channels/\[guildId\]/\[channelId\]/page.tsx
git commit -m "feat: voice-focused top bar and always-visible member sidebar during calls"
```

---

## Task 10: Web Push — Database & API

**Files:**
- Modify: `services/api/prisma/schema.prisma`
- Modify: `services/api/src/notifications/notifications.controller.ts`
- Modify: `services/api/src/notifications/notifications.service.ts`

- [ ] **Step 1: Add PushSubscription model to schema**

In `services/api/prisma/schema.prisma`, add after the `Notification` model (after line 736):

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, endpoint])
  @@index([userId])
}
```

- [ ] **Step 2: Add relation to User model**

In the `User` model (around line 173), add:

```prisma
pushSubscriptions PushSubscription[]
```

- [ ] **Step 3: Generate Prisma client**

Run: `cd services/api && npx prisma generate`

- [ ] **Step 4: Create migration**

Run: `cd services/api && npx prisma migrate dev --name add_push_subscriptions`

- [ ] **Step 5: Add push subscription endpoints to controller**

Read `services/api/src/notifications/notifications.controller.ts`, then add:

```typescript
@Post('push/subscribe')
@UseGuards(AuthGuard)
async subscribePush(
  @Req() req: any,
  @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  return this.notificationsService.savePushSubscription(
    req.user.id,
    body.endpoint,
    body.keys.p256dh,
    body.keys.auth,
  );
}

@Delete('push/unsubscribe')
@UseGuards(AuthGuard)
async unsubscribePush(
  @Req() req: any,
  @Body() body: { endpoint: string },
) {
  return this.notificationsService.removePushSubscription(req.user.id, body.endpoint);
}
```

- [ ] **Step 6: Add push subscription methods to service**

In `services/api/src/notifications/notifications.service.ts`, add:

```typescript
async savePushSubscription(userId: string, endpoint: string, p256dh: string, auth: string) {
  return this.prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint } },
    update: { p256dh, auth },
    create: { userId, endpoint, p256dh, auth },
  });
}

async removePushSubscription(userId: string, endpoint: string) {
  await this.prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
  return { message: 'Unsubscribed' };
}

async getPushSubscriptions(userId: string) {
  return this.prisma.pushSubscription.findMany({ where: { userId } });
}
```

- [ ] **Step 7: Verify API compiles**

Run: `cd services/api && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add services/api/prisma/schema.prisma services/api/src/notifications/notifications.controller.ts services/api/src/notifications/notifications.service.ts
git commit -m "feat: add PushSubscription model and subscribe/unsubscribe API endpoints"
```

---

## Task 11: Web Push — Worker & Service Worker

**Files:**
- Modify: `services/workers/src/workers/notification.worker.ts`
- Modify: `apps/web/public/sw.js`
- Create: `apps/web/src/hooks/usePushSubscription.ts`
- Modify: `apps/web/src/hooks/useGatewayBridge.ts`

- [ ] **Step 1: Install web-push in workers service**

Run: `cd services/workers && npm install web-push && npm install -D @types/web-push`

- [ ] **Step 2: Add web-push sending to notification worker**

In `services/workers/src/workers/notification.worker.ts`, replace the TODO at line 95 with:

```typescript
import webpush from 'web-push';

// In constructor or init:
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@swiip.app',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || '',
);
```

In `processNotification`, after creating the in-app notification record (line 93), add:

```typescript
// 3. Send web push notifications
try {
  const subscriptions = await this.prisma.pushSubscription.findMany({
    where: { userId: payload.recipientId },
  });
  
  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.iconUrl || '/icon-192.png',
    url: payload.targetUrl || '/',
    tag: `${payload.type}-${payload.messageId || payload.recipientId}`,
  });
  
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired — clean up
        await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        this.logger.info(`Removed expired push subscription ${sub.id}`);
      } else {
        this.logger.warn({ err, subId: sub.id }, 'Failed to send push notification');
      }
    }
  }
} catch (err) {
  this.logger.warn({ err }, 'Push notification sending failed');
}
```

- [ ] **Step 3: Add push event handler to service worker**

In `apps/web/public/sw.js`, add at the bottom:

```js
// --- Web Push Notifications ---
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Swiip', {
        body: data.body || '',
        icon: data.icon || '/icon-192.png',
        badge: '/icon-72.png',
        tag: data.tag || 'swiip-notification',
        data: { url: data.url || '/' },
        vibrate: [200, 100, 200],
      })
    );
  } catch {
    // Invalid push payload
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if possible
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});
```

- [ ] **Step 4: Create usePushSubscription hook**

Create `apps/web/src/hooks/usePushSubscription.ts`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const subscribed = useRef(false);

  useEffect(() => {
    if (subscribed.current) return;
    if (!VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    subscribed.current = true;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        const key = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');
        if (!key || !auth) return;

        await apiClient.post('/notifications/push/subscribe', {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
            auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
          },
        });
      } catch (err) {
        console.warn('[Push] Subscription failed:', err);
      }
    })();
  }, []);
}
```

- [ ] **Step 5: Use the hook in gateway bridge**

In `apps/web/src/hooks/useGatewayBridge.ts`, add at the top of the `useGatewayBridge` function (around line 88):

```typescript
import { usePushSubscription } from '@/hooks/usePushSubscription';

// Inside useGatewayBridge, before the bridged ref check:
usePushSubscription();
```

- [ ] **Step 6: Verify everything compiles**

Run: `cd apps/web && npx tsc --noEmit`
Run: `cd services/workers && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add services/workers/src/workers/notification.worker.ts apps/web/public/sw.js apps/web/src/hooks/usePushSubscription.ts apps/web/src/hooks/useGatewayBridge.ts
git commit -m "feat: web push notifications — worker sends, SW receives, frontend subscribes"
```

---

## Task 12: Electron — Incoming Call Window

**Files:**
- Modify: `apps/desktop/src/main.js`
- Modify: `apps/desktop/src/preload.js` (if exists, for IPC)

- [ ] **Step 1: Read preload.js**

Read `apps/desktop/src/preload.js` to understand existing IPC bridge.

- [ ] **Step 2: Add incoming call IPC handlers in main.js**

In `apps/desktop/src/main.js`, add a function to create the incoming call window:

```javascript
let incomingCallWindow = null;

function createIncomingCallWindow(callData) {
  if (incomingCallWindow) {
    incomingCallWindow.focus();
    return;
  }

  const iconPath = path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  incomingCallWindow = new BrowserWindow({
    width: 380,
    height: 220,
    resizable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Center on primary display
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW } = primaryDisplay.workAreaSize;
  incomingCallWindow.setPosition(
    Math.round((screenW - 380) / 2),
    80,
  );

  // Load inline HTML
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: rgba(15, 20, 25, 0.95);
          color: white;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
          -webkit-app-region: drag;
        }
        .container { padding: 24px; display: flex; align-items: center; gap: 16px; }
        .avatar {
          width: 56px; height: 56px; border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 700; flex-shrink: 0;
        }
        .info { flex: 1; min-width: 0; }
        .name { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .status { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .buttons { display: flex; gap: 12px; justify-content: center; padding: 0 24px 20px; -webkit-app-region: no-drag; }
        .btn {
          width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.15s;
        }
        .btn:hover { transform: scale(1.1); }
        .btn-accept { background: #10b981; }
        .btn-decline { background: #ef4444; }
        .btn svg { width: 22px; height: 22px; fill: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="avatar">${(callData.callerName || 'U').slice(0, 2).toUpperCase()}</div>
        <div class="info">
          <div class="name">${callData.callerName || 'Unknown'}</div>
          <div class="status">Incoming voice call...</div>
        </div>
      </div>
      <div class="buttons">
        <button class="btn btn-decline" onclick="window.electronAPI.declineCall()">
          <svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
        </button>
        <button class="btn btn-accept" onclick="window.electronAPI.acceptCall()">
          <svg viewBox="0 0 24 24"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
        </button>
      </div>
    </body>
    </html>
  `;

  incomingCallWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Flash taskbar
  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }

  incomingCallWindow.on('closed', () => {
    incomingCallWindow = null;
  });

  // Auto-close after 30s
  setTimeout(() => {
    if (incomingCallWindow) {
      incomingCallWindow.close();
      incomingCallWindow = null;
    }
  }, 30000);
}
```

- [ ] **Step 3: Add IPC handlers**

```javascript
ipcMain.handle('show-incoming-call', (_event, callData) => {
  createIncomingCallWindow(callData);
});

ipcMain.handle('accept-call', () => {
  if (incomingCallWindow) {
    incomingCallWindow.close();
    incomingCallWindow = null;
  }
  // Focus main window
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
  // Send accept event to renderer
  mainWindow?.webContents.send('call-response', 'accept');
});

ipcMain.handle('decline-call', () => {
  if (incomingCallWindow) {
    incomingCallWindow.close();
    incomingCallWindow = null;
  }
  mainWindow?.webContents.send('call-response', 'decline');
});

ipcMain.handle('dismiss-incoming-call', () => {
  if (incomingCallWindow) {
    incomingCallWindow.close();
    incomingCallWindow = null;
  }
});
```

- [ ] **Step 4: Expose IPC in preload.js**

Add to the existing `contextBridge.exposeInMainWorld` calls in `preload.js`:

```javascript
showIncomingCall: (callData) => ipcRenderer.invoke('show-incoming-call', callData),
acceptCall: () => ipcRenderer.invoke('accept-call'),
declineCall: () => ipcRenderer.invoke('decline-call'),
dismissIncomingCall: () => ipcRenderer.invoke('dismiss-incoming-call'),
onCallResponse: (callback) => ipcRenderer.on('call-response', (_event, response) => callback(response)),
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main.js apps/desktop/src/preload.js
git commit -m "feat: native incoming call popup window for Electron desktop"
```

---

## Task 13: Set callStartedAt on Voice Connect

**Files:**
- Modify: `apps/web/src/hooks/useGatewayBridge.ts`

- [ ] **Step 1: Set callStartedAt when voice connects**

In `useGatewayBridge.ts`, find where `VOICE_SERVER_UPDATE` is handled (the gateway event that confirms voice connection). After the LiveKit credentials are set, add:

```typescript
useVoiceStore.getState().setCallStartedAt(Date.now());
```

This ensures the elapsed timer starts when the user actually connects to voice.

- [ ] **Step 2: Clear callStartedAt on disconnect**

This is already handled in Task 4 where we added `callStartedAt: null` to the `disconnect()` action.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useGatewayBridge.ts
git commit -m "feat: track call start time for elapsed timer"
```

---

## Task 14: Integration Testing & Final Verification

- [ ] **Step 1: Verify all packages compile**

```bash
cd packages/protocol && npx tsc --noEmit
cd ../../apps/web && npx tsc --noEmit
cd ../../services/api && npx tsc --noEmit
cd ../../services/gateway && npx tsc --noEmit
cd ../../services/workers && npx tsc --noEmit
```

- [ ] **Step 2: Run existing tests**

```bash
cd /c/dev/swiip && npm test 2>/dev/null || npx turbo test 2>/dev/null || echo "Check test runner"
```

- [ ] **Step 3: Manual test checklist**

Verify the following work correctly:
- Desktop icon shows owl (not Electron atom) after rebuild
- Joining a voice channel shows connecting overlay, then participant view
- VoiceTopBar replaces SwiipTopBar when in active voice channel
- MemberSidebar stays open during voice calls
- Navigating away shows green ReturnToCallBar at top
- Clicking ReturnToCallBar navigates back to voice channel
- DM call initiation shows OutgoingCallScreen with "Calling..." animation
- Incoming DM call shows IncomingCallModal with accept/decline
- Electron: incoming call shows native popup window
- Push notifications arrive when app is closed (requires VAPID keys configured)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for voice UI and notifications"
```
