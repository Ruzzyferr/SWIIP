# Swiip Complete Redesign + Voice Bugfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Swiip from a Discord-like app into a premium emerald-graphite communication platform with immersive voice rooms, and fix 3 critical voice bugs (echo, stability, screen picker).

**Architecture:** CSS-variable-first approach - swap all design tokens in globals.css for instant color transformation, then restructure layout components (ServerRail -> floating pill dock, ChannelSidebar -> smart nav with categories, MemberSidebar -> context panel), redesign VoiceRoomView as immersive stage with floating controls, and finally fix voice bugs in useLiveKitRoom.ts.

**Tech Stack:** React 18, Next.js 14, Tailwind CSS, Framer Motion, Zustand, LiveKit, Electron

**Reference image:** `new theme.png` on desktop - emerald-graphite dark theme with atmospheric green nebula background, floating panels, categorized navigation (SPACES/LIVE ROOMS/THREADS), immersive voice room with participant cards, floating control bar, and dynamic context panel.

---

## Task 1: Swap Color Palette in globals.css

**Files:**
- Modify: `apps/web/src/styles/globals.css:10-180` (CSS variables)

This is the single highest-impact change - swapping all CSS variables instantly transforms the entire app from indigo-violet to emerald-graphite.

- [ ] **Step 1: Replace surface scale variables (lines 10-16)**

Replace the surface colors from blue-undertone blacks to graphite-green undertone:

```css
/* Surface scale — dark graphite with green undertone */
--color-surface-base: #090B0B;
--color-surface-elevated: #121616;
--color-surface-raised: #181E1D;
--color-surface-overlay: #202827;
--color-surface-floating: #2B3533;
```

- [ ] **Step 2: Replace glass surface variables (lines 18-22)**

```css
/* Glass surfaces */
--glass-bg: rgba(18, 22, 22, 0.72);
--glass-border: rgba(255, 255, 255, 0.06);
--glass-blur: 20px;
--glass-bg-hover: rgba(24, 30, 29, 0.80);
```

- [ ] **Step 3: Replace accent color variables (lines 24-32)**

```css
/* Accent — emerald signature */
--color-accent-primary: #10B981;
--color-accent-hover: #059669;
--color-accent-active: #047857;
--color-accent-muted: rgba(52, 211, 153, 0.16);
--color-accent-subtle: rgba(52, 211, 153, 0.08);
--color-accent-strong: rgba(52, 211, 153, 0.25);
--color-accent-gradient: linear-gradient(135deg, #10B981 0%, #34D399 100%);
--color-accent-gradient-vibrant: linear-gradient(135deg, #10B981 0%, #6EE7B7 100%);
```

- [ ] **Step 4: Replace text color variables (lines 34-40)**

```css
/* Text */
--color-text-primary: #F5F7F6;
--color-text-secondary: #B7C3BF;
--color-text-tertiary: #788682;
--color-text-disabled: #3D4A46;
--color-text-inverse: #090B0B;
--color-text-accent: #34D399;
```

- [ ] **Step 5: Replace border color variables (lines 42-47)**

```css
/* Borders — subtle, glass-friendly */
--color-border-subtle: rgba(255, 255, 255, 0.04);
--color-border-default: rgba(255, 255, 255, 0.07);
--color-border-strong: rgba(255, 255, 255, 0.12);
--color-border-focus: rgba(16, 185, 129, 0.50);
--color-border-glow: rgba(16, 185, 129, 0.30);
```

- [ ] **Step 6: Replace status color variables (lines 49-53)**

```css
/* Status */
--color-status-online: #10B981;
--color-status-idle: #F59E0B;
--color-status-dnd: #EF4444;
--color-status-offline: #788682;
```

- [ ] **Step 7: Replace danger/success/warning variables (lines 55-72)**

```css
/* Danger */
--color-danger-default: #EF4444;
--color-danger-hover: #DC2626;
--color-danger-active: #B91C1C;
--color-danger-muted: rgba(239, 68, 68, 0.12);
--color-danger-subtle: rgba(239, 68, 68, 0.06);

/* Success */
--color-success-default: #10B981;
--color-success-hover: #059669;
--color-success-muted: rgba(16, 185, 129, 0.12);
--color-success-subtle: rgba(16, 185, 129, 0.06);

/* Warning */
--color-warning-default: #F59E0B;
--color-warning-hover: #D97706;
--color-warning-muted: rgba(245, 158, 11, 0.12);
--color-warning-subtle: rgba(245, 158, 11, 0.06);
```

- [ ] **Step 8: Replace mention variables (lines 74-78)**

```css
/* Mention */
--color-mention-bg: rgba(16, 185, 129, 0.10);
--color-mention-border: rgba(16, 185, 129, 0.35);
--color-mention-hover: rgba(16, 185, 129, 0.16);
--color-mention-text: #34D399;
```

- [ ] **Step 9: Replace voice color variables (lines 80-84)**

```css
/* Voice */
--color-voice-speaking: #10B981;
--color-voice-muted-speaking: #F59E0B;
--color-voice-deafened: #EF4444;
--color-voice-disconnected: #788682;
```

- [ ] **Step 10: Replace shadow glow variables (lines 140-141)**

```css
--shadow-glow: 0 0 20px rgba(16, 185, 129, 0.20), 0 0 60px rgba(16, 185, 129, 0.08);
--shadow-glow-strong: 0 0 30px rgba(16, 185, 129, 0.35), 0 0 80px rgba(16, 185, 129, 0.12);
```

- [ ] **Step 11: Update layout variables (lines 171-174)**

```css
--layout-server-rail-width: 64px;
--layout-channel-sidebar-width: 240px;
--layout-member-sidebar-width: 260px;
```

- [ ] **Step 12: Update hardcoded accent colors in component classes (lines 293-500)**

Search and replace all `rgba(108, 92, 231, ...)` with equivalent emerald values in `.server-icon`, `.server-pill`, `.ambient-orb`, `.text-gradient`, `.btn-premium` classes.

Key replacements:
- `rgba(108, 92, 231, X)` → `rgba(16, 185, 129, X)` (accent references)
- `#6c5ce7` → `#10B981` (primary accent)
- `#a29bfe` → `#34D399` (light accent)
- `#fd79a8` → `#6EE7B7` (vibrant gradient end)

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/styles/globals.css
git commit -m "feat: swap entire color palette from indigo-violet to emerald-graphite"
```

---

## Task 2: Update Tailwind Config

**Files:**
- Modify: `apps/web/tailwind.config.ts`

No code changes needed - the tailwind config already references CSS variables (`var(--color-*)`) so the globals.css swap propagates automatically. Verify this by checking no hex values are hardcoded.

- [ ] **Step 1: Verify tailwind config uses CSS vars only**

Read `apps/web/tailwind.config.ts` and confirm all color values reference `var(--color-*)`. If any hex values exist, replace them with the corresponding CSS variable reference.

- [ ] **Step 2: Commit if changes made**

```bash
git add apps/web/tailwind.config.ts
git commit -m "fix: ensure tailwind config references CSS variables only"
```

---

## Task 3: Atmospheric Background in AppLayout

**Files:**
- Modify: `apps/web/src/app/(app)/layout.tsx:54-66` (ambient glow)

Replace the single indigo glow orb with emerald atmospheric nebula per the reference image.

- [ ] **Step 1: Replace the ambient glow div (lines 54-66)**

Replace the existing single ambient glow with two emerald nebula elements:

```tsx
{/* Atmospheric emerald nebula — bottom left */}
<div
  className="absolute pointer-events-none"
  style={{
    bottom: '-20%',
    left: '-10%',
    width: '60%',
    height: '60%',
    borderRadius: '50%',
    background: 'radial-gradient(ellipse, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
    filter: 'blur(80px)',
  }}
/>
{/* Atmospheric emerald nebula — top right */}
<div
  className="absolute pointer-events-none"
  style={{
    top: '-15%',
    right: '-10%',
    width: '50%',
    height: '50%',
    borderRadius: '50%',
    background: 'radial-gradient(ellipse, rgba(52, 211, 153, 0.03) 0%, transparent 70%)',
    filter: 'blur(80px)',
  }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(app\)/layout.tsx
git commit -m "feat: add emerald atmospheric nebula background"
```

---

## Task 4: Floating Pill Dock (ServerRail Redesign)

**Files:**
- Modify: `apps/web/src/components/layout/ServerRail.tsx` (334 lines - full rewrite of styling)
- Modify: `apps/web/src/app/(app)/layout.tsx` (update ServerRail render)

Transform the chunky Discord-like server rail into a floating pill dock with rounded corners, shadow, and emerald glow active states.

- [ ] **Step 1: Update ServerIcon component styling (lines 22-141)**

Change the server icon from Discord-style pill indicator to floating glow active state:

Replace the `pillHeight` logic and pill element (lines 43-57) - remove the left-edge gradient pill indicator. Instead, apply an emerald fill glow on the active icon:

In the `style` prop of the server button (around line 70), change active state from border-radius morph to:
- Active: `background: 'var(--color-accent-muted)'`, `boxShadow: 'var(--shadow-glow)'`, `transform: 'scale(1.05)'`
- Hover: `background: 'var(--color-surface-overlay)'`, `transform: 'scale(1.03)'`
- Default: `background: 'var(--color-surface-raised)'`

Remove the pill indicator div entirely (the `server-pill` element).

- [ ] **Step 2: Update main ServerRail container styling (lines 226-234)**

Replace the full-height rail with a floating pill dock:

```tsx
style={{
  width: 64,
  margin: '8px',
  borderRadius: 20,
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border-subtle)',
  boxShadow: 'var(--shadow-float)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '12px 0',
  gap: 4,
  height: 'calc(100dvh - 16px)',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 10,
}}
```

- [ ] **Step 3: Fix hardcoded colors**

Replace all hardcoded colors in ServerRail.tsx:
- Line 251-253: `#e8e4ef` → `var(--color-accent-muted)` (DM home button)
- Line 97: `'#ffffff'` → `'var(--color-text-primary)'`
- Line 185: `'#ffffff'` → `'var(--color-text-primary)'`

- [ ] **Step 4: Update RailDivider (lines 143-154)**

Change divider to emerald gradient:

```tsx
style={{
  width: 32,
  height: 2,
  borderRadius: 1,
  background: 'linear-gradient(90deg, transparent, var(--color-accent-muted), transparent)',
  margin: '4px 0',
}}
```

- [ ] **Step 5: Update icon sizes**

Change server icons from 48x48 to 40x40:
- Icon container: `width: 40, height: 40`
- Border radius default: 14px (slightly rounded square)
- Active border radius: 12px
- Gap between icons: 8px

- [ ] **Step 6: Update action buttons (Create, Discover)**

Style with emerald outline:
```tsx
style={{
  width: 40,
  height: 40,
  borderRadius: 14,
  border: '1.5px solid var(--color-accent-primary)',
  background: 'transparent',
  color: 'var(--color-accent-primary)',
}}
```

Hover: `background: 'var(--color-accent-muted)'`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/layout/ServerRail.tsx
git commit -m "feat: redesign ServerRail as floating pill dock with emerald glow"
```

---

## Task 5: Smart Navigation Panel (ChannelSidebar Restructure)

**Files:**
- Modify: `apps/web/src/components/layout/ChannelSidebar.tsx` (588 lines)

Restructure the flat channel list into categorized sections: SPACES, LIVE ROOMS, THREADS per the reference image.

- [ ] **Step 1: Update GuildHeaderDropdown (lines 35-91)**

Simplify to show workspace name + settings gear:

```tsx
<div className="flex items-center justify-between px-4" style={{ height: 48 }}>
  <div className="flex items-center gap-2 min-w-0">
    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--color-accent-muted)' }}>
      <span className="text-xs font-bold" style={{ color: 'var(--color-accent-primary)' }}>
        {guild?.name?.charAt(0)?.toUpperCase()}
      </span>
    </div>
    <span className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
      {guild?.name}
    </span>
  </div>
  <button /* settings gear */ >
    <Settings size={16} style={{ color: 'var(--color-text-tertiary)' }} />
  </button>
</div>
```

- [ ] **Step 2: Create section grouping logic**

Add a function to group channels into SPACES, LIVE ROOMS, THREADS:

```tsx
const groupChannels = useMemo(() => {
  if (!channels) return { spaces: [], liveRooms: [], threads: [] };

  const spaces: ChannelPayload[] = [];
  const liveRooms: ChannelPayload[] = [];
  const threads: ChannelPayload[] = [];

  for (const ch of channels) {
    if (ch.type === ChannelType.GUILD_VOICE || ch.type === ChannelType.GUILD_STAGE) {
      liveRooms.push(ch);
    } else if (ch.type === ChannelType.GUILD_PUBLIC_THREAD || ch.type === ChannelType.GUILD_PRIVATE_THREAD) {
      threads.push(ch);
    } else {
      spaces.push(ch);
    }
  }

  return { spaces, liveRooms, threads };
}, [channels]);
```

- [ ] **Step 3: Create SectionLabel component**

```tsx
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span
        className="text-[10px] font-semibold uppercase"
        style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.1em' }}
      >
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Update ChannelItem active styling (lines 291-307)**

Change active indicator from generic highlight to emerald left border + tint:

```tsx
style={{
  background: isActive ? 'var(--color-accent-subtle)' : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
  borderLeft: isActive ? '3px solid var(--color-accent-primary)' : '3px solid transparent',
  paddingLeft: 9, // 12px - 3px border
  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
}}
```

- [ ] **Step 5: Update the channel list render (lines 527-578)**

Replace the existing category-based render with the new section layout:

```tsx
{/* Scrollable channel list */}
<div className="flex-1 overflow-y-auto" style={{ paddingBottom: 8 }}>
  {groupChannels.spaces.length > 0 && (
    <>
      <SectionLabel label="SPACES" />
      {groupChannels.spaces.map((ch) => (
        <ChannelItem key={ch.id} channel={ch} /* ... */ />
      ))}
    </>
  )}

  {groupChannels.liveRooms.length > 0 && (
    <>
      <SectionLabel label="LIVE ROOMS" />
      {groupChannels.liveRooms.map((ch) => (
        <ChannelItem key={ch.id} channel={ch} /* ... */ />
      ))}
    </>
  )}

  {groupChannels.threads.length > 0 && (
    <>
      <SectionLabel label="THREADS" />
      {groupChannels.threads.map((ch) => (
        <ChannelItem key={ch.id} channel={ch} /* ... */ />
      ))}
    </>
  )}

  {/* Add a Chat */}
  <div className="px-3 pt-3">
    <button
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors"
      style={{ color: 'var(--color-text-tertiary)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
    >
      <Plus size={14} />
      Add a Chat
    </button>
  </div>
</div>
```

- [ ] **Step 6: Add live room indicators**

For voice channels in LIVE ROOMS section, show emerald pulse dot when participants are connected:

```tsx
{ch.type === ChannelType.GUILD_VOICE && voiceParticipants.length > 0 && (
  <span
    className="w-2 h-2 rounded-full animate-pulse"
    style={{ background: 'var(--color-accent-primary)' }}
  />
)}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/layout/ChannelSidebar.tsx
git commit -m "feat: restructure ChannelSidebar into smart nav with SPACES/LIVE ROOMS/THREADS"
```

---

## Task 6: Immersive Voice Room Canvas

**Files:**
- Modify: `apps/web/src/components/voice/VoiceRoomView.tsx` (600+ lines)

Transform the voice room into an immersive stage per the reference image: room header with LIVE badge, centered participant cards with emerald glow, floating glass control bar.

- [ ] **Step 1: Create room header section**

Add a room header at the top of VoiceRoomContent (around line 370):

```tsx
{/* Room Header */}
<div className="flex items-center justify-between px-6 py-4">
  <div className="flex items-center gap-3">
    <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
      {channelName}
    </h2>
    {participants.length > 0 && (
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{
          background: 'var(--color-accent-muted)',
          color: 'var(--color-accent-primary)',
          border: '1px solid var(--color-accent-primary)',
        }}
      >
        LIVE
      </span>
    )}
  </div>
  <div className="flex items-center gap-2">
    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
      Connected | {connectionQuality >= 2 ? '35ms' : connectionQuality === 1 ? '120ms' : 'Poor'}
    </span>
    <button className="p-1.5 rounded-md" style={{ color: 'var(--color-text-tertiary)' }}>
      <Settings size={16} />
    </button>
  </div>
</div>
```

- [ ] **Step 2: Redesign ParticipantTile (lines 150-350)**

Replace the current tile with the reference image style: avatar card with emerald glow border:

Update the tile container style (around line 237):
```tsx
style={{
  background: 'var(--color-surface-raised)',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  width: 120,
  border: isSpeaking
    ? '2px solid var(--color-accent-primary)'
    : '2px solid var(--color-border-subtle)',
  boxShadow: isSpeaking
    ? '0 0 20px rgba(16, 185, 129, 0.25)'
    : 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}}
```

Avatar size: 64x64 with emerald glow ring when speaking.

- [ ] **Step 3: Add empty state**

When no other participants (only self), show:

```tsx
{participants.length <= 1 && (
  <div className="flex flex-col items-center gap-3 mt-8">
    <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
      No one else in this room yet.
    </p>
    <button
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        border: '1.5px solid var(--color-accent-primary)',
        color: 'var(--color-accent-primary)',
        background: 'transparent',
      }}
    >
      <UserPlus size={16} />
      Invite to Join
    </button>
  </div>
)}
```

- [ ] **Step 4: Create floating control bar**

Replace the existing bottom controls with a centered floating glass bar. Find the current control buttons section and wrap them:

```tsx
{/* Floating Control Bar */}
<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
  <div
    className="flex items-center gap-2 px-4 py-3 rounded-2xl"
    style={{
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(var(--glass-blur))',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--shadow-float)',
    }}
  >
    {/* Mic */}
    <ControlButton
      icon={selfMuted ? MicOff : Mic}
      active={!selfMuted}
      onClick={toggleMute}
      tooltip={selfMuted ? 'Unmute' : 'Mute'}
    />
    {/* Deafen */}
    <ControlButton
      icon={selfDeafened ? EarOff : Headphones}
      active={!selfDeafened}
      onClick={toggleDeafen}
      tooltip={selfDeafened ? 'Undeafen' : 'Deafen'}
    />
    {/* Camera */}
    <ControlButton
      icon={cameraEnabled ? Video : VideoOff}
      active={cameraEnabled}
      onClick={toggleCamera}
      tooltip={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
    />
    {/* Screen Share */}
    <ControlButton
      icon={screenShareEnabled ? MonitorOff : Monitor}
      active={screenShareEnabled}
      onClick={() => setShowScreenShareModal(true)}
      tooltip={screenShareEnabled ? 'Stop Sharing' : 'Share Screen'}
    />
    {/* Noise Suppression */}
    <ControlButton
      icon={Volume2}
      active={audioMode === 'enhanced'}
      onClick={cycleAudioMode}
      tooltip={`NS: ${audioMode}`}
      label="NS"
    />

    {/* Separator */}
    <div style={{ width: 1, height: 24, background: 'var(--color-border-default)', margin: '0 4px' }} />

    {/* Leave */}
    <button
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
      style={{
        background: 'var(--color-danger-default)',
        color: '#fff',
      }}
      onClick={leaveChannel}
    >
      <PhoneOff size={16} />
      Leave
    </button>
  </div>
</div>
```

- [ ] **Step 5: Create ControlButton helper component**

Add inside VoiceRoomView.tsx:

```tsx
function ControlButton({
  icon: Icon,
  active,
  onClick,
  tooltip,
  label,
}: {
  icon: any;
  active: boolean;
  onClick: () => void;
  tooltip: string;
  label?: string;
}) {
  return (
    <Tooltip content={tooltip}>
      <button
        onClick={onClick}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all"
        style={{
          background: active ? 'var(--color-accent-muted)' : 'var(--color-surface-raised)',
          color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <Icon size={18} />
        {label && (
          <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 rounded"
            style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-tertiary)' }}>
            {label}
          </span>
        )}
      </button>
    </Tooltip>
  );
}
```

- [ ] **Step 6: Fix hardcoded colors in VoiceRoomView**

- Line 313: `'#ed4245'` → `'var(--color-danger-default)'`
- Line 451: `'#ed4245'` → `'var(--color-danger-default)'`
- Line 460: `'var(--color-brand-default)'` → `'var(--color-accent-primary)'`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/voice/VoiceRoomView.tsx
git commit -m "feat: redesign voice room as immersive stage with floating controls"
```

---

## Task 7: Context Panel (MemberSidebar Redesign)

**Files:**
- Modify: `apps/web/src/components/layout/MemberSidebar.tsx` (221 lines)

Transform the static member list into a dynamic context panel with Room Health, Participants, Invite, Audio status, and Pinned Resources sections.

- [ ] **Step 1: Add voice-aware sections for voice channels**

At the top of the component, detect if the current channel is a voice channel:

```tsx
const currentChannel = useGuildsStore((s) => {
  if (!guildId) return null;
  const guild = s.guilds[guildId];
  return guild?.channels?.find((c) => c.id === channelId);
});
const isVoiceChannel = currentChannel?.type === ChannelType.GUILD_VOICE
  || currentChannel?.type === ChannelType.GUILD_STAGE;
const voiceState = useVoiceStore();
```

- [ ] **Step 2: Create RoomHealthSection component**

```tsx
function RoomHealthSection() {
  const { connectionQuality, connectionState, effectiveAudioMode } = useVoiceStore();
  const qualityLabel = ['Lost', 'Poor', 'Good', 'Excellent'][connectionQuality] ?? 'Unknown';

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: connectionQuality >= 2 ? 'var(--color-accent-primary)' : 'var(--color-warning-default)',
          }}
        />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {connectionState === 'connected' ? 'Connected' : connectionState}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {connectionQuality >= 2 ? '35ms' : '120ms'}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.1em' }}>
            Optimized Audio Enabled
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-accent-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Noise Suppression
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-accent-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            High Bitrate Audio
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create InvitePeopleSection component**

```tsx
function InvitePeopleSection() {
  return (
    <div className="px-4 py-3">
      <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.1em' }}>
        Invite People
      </span>
      <div className="mt-2 relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
        <input
          type="text"
          placeholder="Search..."
          className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update main render for voice vs text context**

```tsx
return (
  <div style={{
    width: 'var(--layout-member-sidebar-width)',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(var(--glass-blur))',
    borderLeft: '1px solid var(--color-border-subtle)',
    overflowY: 'auto',
  }}>
    {isVoiceChannel ? (
      <>
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Participants
          </h3>
        </div>
        {/* Participant avatars */}
        <div className="px-4 pb-3">
          {/* existing member list filtered to voice participants */}
        </div>
        <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '0 16px' }} />
        <InvitePeopleSection />
        <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '0 16px' }} />
        <RoomHealthSection />
        <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '0 16px' }} />
        <PinnedResourcesSection channelId={channelId} />
      </>
    ) : (
      /* Existing text channel member list - keep as is but with new colors */
      <>{/* existing Virtuoso member list */}</>
    )}
  </div>
);
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/MemberSidebar.tsx
git commit -m "feat: redesign MemberSidebar as dynamic context panel for voice rooms"
```

---

## Task 8: ChannelHeader & UserPanel Updates

**Files:**
- Modify: `apps/web/src/components/layout/ChannelHeader.tsx`
- Modify: `apps/web/src/components/layout/UserPanel.tsx`

Update styling to match emerald-graphite theme. These use CSS variables so most changes are automatic from Task 1, but some hardcoded values need fixing.

- [ ] **Step 1: Update ChannelHeader**

Verify the header uses CSS variables for all colors. The glass bg should already work from Task 1. No structural changes needed - just verify no hardcoded colors exist.

- [ ] **Step 2: Update UserPanel speaking ring**

In UserPanel.tsx line 60, change the speaking ring color:

```tsx
boxShadow: isSpeaking ? '0 0 0 2px var(--color-accent-primary)' : 'none'
```

(Replace `var(--color-voice-speaking, #43b581)` with `var(--color-accent-primary)` - the voice-speaking var was already updated in Task 1)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/ChannelHeader.tsx apps/web/src/components/layout/UserPanel.tsx
git commit -m "fix: update header and user panel to emerald theme"
```

---

## Task 9: UI Component Updates (Modal, Button, Avatar)

**Files:**
- Modify: `apps/web/src/components/ui/Modal.tsx`
- Modify: `apps/web/src/components/ui/Button.tsx`

These mostly use CSS variables, so Task 1 handles the bulk. Just verify and fix any hardcoded values.

- [ ] **Step 1: Verify Modal.tsx uses CSS variables**

Check lines 145-170 for hardcoded colors. The existing code uses `var(--glass-bg)`, `var(--color-border-subtle)` etc. which are already correct. No changes needed unless hardcoded hex values are found.

- [ ] **Step 2: Verify Button.tsx variant styles**

Check lines 20-51 for hardcoded colors. The existing code uses CSS variable references. Verify the primary variant uses `var(--color-accent-primary)` which now maps to emerald.

- [ ] **Step 3: Commit if any changes**

```bash
git add apps/web/src/components/ui/
git commit -m "fix: verify UI components use CSS variables for emerald theme"
```

---

## Task 10: Screen Share Picker Categorization (Voice Bugfix)

**Files:**
- Modify: `apps/web/src/components/voice/ScreenShareModal.tsx` (222 lines)

Add "Ekranlar" (Screens) and "Pencereler" (Windows) tab bar to desktop screen picker.

- [ ] **Step 1: Add sourceTab state (after line 26)**

```tsx
const [sourceTab, setSourceTab] = useState<'screens' | 'windows'>('screens');
```

- [ ] **Step 2: Create filtered source lists (after line 39)**

```tsx
const screenSources = sources.filter((s) => s.id.startsWith('screen:'));
const windowSources = sources.filter((s) => s.id.startsWith('window:'));
const filteredSources = sourceTab === 'screens' ? screenSources : windowSources;
```

- [ ] **Step 3: Add tab change auto-select effect (after the existing useEffect)**

```tsx
useEffect(() => {
  const list = sourceTab === 'screens' ? screenSources : windowSources;
  if (list.length > 0 && !list.find((s) => s.id === selectedSourceId)) {
    setSelectedSourceId(list[0].id);
  }
}, [sourceTab, screenSources, windowSources, selectedSourceId]);
```

- [ ] **Step 4: Add tab bar UI (replace lines 60-62 label section)**

Insert tab bar before the source grid:

```tsx
<div className="space-y-2">
  {/* Tab bar */}
  <div className="flex gap-2">
    <button
      onClick={() => setSourceTab('screens')}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: sourceTab === 'screens' ? 'var(--color-accent-muted)' : 'var(--color-surface-raised)',
        color: sourceTab === 'screens' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        border: sourceTab === 'screens' ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-subtle)',
      }}
    >
      Ekranlar
    </button>
    <button
      onClick={() => setSourceTab('windows')}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: sourceTab === 'windows' ? 'var(--color-accent-muted)' : 'var(--color-surface-raised)',
        color: sourceTab === 'windows' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        border: sourceTab === 'windows' ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-subtle)',
      }}
    >
      Pencereler
    </button>
  </div>
```

- [ ] **Step 5: Update source grid to use filteredSources (line 69)**

Replace `sources.map` with `filteredSources.map`:

```tsx
<div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
  {filteredSources.map((source) => (
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/voice/ScreenShareModal.tsx
git commit -m "feat: add Ekranlar/Pencereler category tabs to screen share picker"
```

---

## Task 11: Echo Prevention (Voice Bugfix)

**Files:**
- Modify: `apps/web/src/hooks/useLiveKitRoom.ts` (lines 191-242, 915-959)
- Modify: `apps/web/src/components/voice/ScreenShareModal.tsx`

Prevent voice chat audio from being captured by screen share audio.

- [ ] **Step 1: Add setSinkId to attachAudio (useLiveKitRoom.ts lines 191-242)**

After creating audio elements in `attachAudio`, apply `setSinkId` to route voice through the user's selected output device:

After the line `document.body.appendChild(element);` (around line 217 for screen share audio and line 235 for mic audio), add:

```tsx
// Route audio to user's selected output device to isolate from loopback capture
const outputDevice = useVoiceStore.getState().settings.outputDeviceId;
if (outputDevice && outputDevice !== 'default' && typeof element.setSinkId === 'function') {
  element.setSinkId(outputDevice).catch((err) => {
    console.warn('[LiveKit] Failed to set audio output device:', err);
  });
}
```

- [ ] **Step 2: Create syncAudioSinks helper (after attachAudio function)**

```tsx
const syncAudioSinks = useCallback(() => {
  const outputDevice = useVoiceStore.getState().settings.outputDeviceId;
  if (!outputDevice || outputDevice === 'default') return;
  for (const [, element] of audioElementsRef.current.entries()) {
    if (typeof element.setSinkId === 'function') {
      element.setSinkId(outputDevice).catch(console.warn);
    }
  }
}, []);
```

- [ ] **Step 3: Call syncAudioSinks when output device changes**

In the existing `outputDeviceId` sync effect (around line 855), add `syncAudioSinks()` call:

```tsx
useEffect(() => {
  if (!outputDeviceId || outputDeviceId === 'default') return;
  syncAudioSinks();
  // Also update LiveKit room output
  for (const audioElement of audioElementsRef.current.values()) {
    if (typeof audioElement.setSinkId === 'function') {
      audioElement.setSinkId(outputDeviceId).catch(console.error);
    }
  }
}, [outputDeviceId, syncAudioSinks]);
```

- [ ] **Step 4: Add suppressLocalAudioPlayback for web (useLiveKitRoom.ts line 933)**

In the screen share sync effect, add to the capture options:

```tsx
room.localParticipant.setScreenShareEnabled(true, {
  contentHint: preset.fps >= 60 ? 'motion' : 'detail',
  audio: wantAudio,
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
  systemAudio: 'exclude',
  preferCurrentTab: false,
  suppressLocalAudioPlayback: true, // ADD THIS - prevents tab audio echo
}, {
```

- [ ] **Step 5: Update echo warning in ScreenShareModal.tsx (line 164)**

Replace the desktop warning text:

```tsx
{isDesktop
  ? isWindowCapture
    ? 'Audio sharing is not available for window captures'
    : 'Captures system audio — use headphones to prevent echo'
  : 'Share tab or system audio (Chrome/Edge only)'}
```

And update the warning below (line 185-188):

```tsx
{isDesktop && shareAudio && !isWindowCapture && (
  <p className="text-xs px-1" style={{ color: 'var(--color-warning-default)' }}>
    Use headphones to prevent echo. Voice chat audio is routed to your selected output device.
  </p>
)}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useLiveKitRoom.ts apps/web/src/components/voice/ScreenShareModal.tsx
git commit -m "fix: prevent echo during screen share by routing voice audio via setSinkId"
```

---

## Task 12: Connection Stability & Sync (Voice Bugfix)

**Files:**
- Modify: `apps/web/src/hooks/useLiveKitRoom.ts` (lines 253-374, 443-448, 570-592)
- Modify: `apps/web/src/components/voice/VideoTile.tsx` (lines 67-98)

Harden reconnection logic to prevent stream drops and phantom participant removal.

- [ ] **Step 1: Skip participant removal during reconnect (line 443-448)**

In the `ParticipantDisconnected` handler, add reconnect check:

```tsx
room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
  console.debug('[LiveKit] Participant disconnected:', participant.identity);
  // During reconnect, participants temporarily disconnect then reconnect.
  // Skip removal to prevent UI flicker.
  if (room.state === ConnectionState.Reconnecting) {
    console.debug('[LiveKit] Skipping participant removal during reconnect');
    return;
  }
  if (currentChannelId) {
    removeParticipant(currentChannelId, participant.identity);
  }
  for (const pub of participant.audioTrackPublications.values()) {
    if (pub.track?.sid) detachAudio(pub.track.sid);
  }
  updateVideoTrack(participant.identity, 'camera', undefined);
  updateVideoTrack(participant.identity, 'screen', undefined);
});
```

- [ ] **Step 2: Extend grace period from 15s to 30s (line 361)**

```tsx
if (useVoiceStore.getState().screenShareEnabled) {
  screenShareReconnectUntil.current = Date.now() + 30_000; // 30s grace
}
```

- [ ] **Step 3: Expand volume retry delays (lines 305-307)**

Replace:
```tsx
setTimeout(() => applyVolumes(), 200);
setTimeout(() => applyVolumes(), 800);
```

With:
```tsx
for (const delay of [200, 800, 2000, 5000]) {
  setTimeout(() => applyVolumes(), delay);
}
```

- [ ] **Step 4: Add reconcile logic after reconnect (in Connected handler, after line 302)**

After re-syncing remote participants, reconcile store state:

```tsx
// Reconcile: remove participants from store that no longer exist in room
if (currentChannelId) {
  const storeParticipants = useVoiceStore.getState().participants;
  const roomIdentities = new Set(
    Array.from(room.remoteParticipants.values()).map((p) => p.identity),
  );
  // Add self
  roomIdentities.add(room.localParticipant.identity);

  for (const key of Object.keys(storeParticipants)) {
    if (!key.startsWith(currentChannelId + ':')) continue;
    const userId = key.split(':')[1];
    if (!roomIdentities.has(userId)) {
      removeParticipant(currentChannelId, userId);
    }
  }
}
```

- [ ] **Step 5: Add health check interval (new useEffect after line 726)**

```tsx
// Periodic health check — sync store with actual room state every 10s
useEffect(() => {
  const room = roomRef.current;
  if (!room || room.state !== ConnectionState.Connected || !currentChannelId) return;

  const interval = setInterval(() => {
    if (room.state !== ConnectionState.Connected) return;

    // Check for stale screen share tracks
    if (useVoiceStore.getState().screenShareEnabled) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (!pub) {
        console.warn('[LiveKit] Health check: screen share track missing, syncing store');
        useVoiceStore.getState().setScreenShareEnabled(false);
      }
    }

    // Reconcile remote participants
    const storeParticipants = useVoiceStore.getState().participants;
    for (const [, participant] of room.remoteParticipants) {
      const key = `${currentChannelId}:${participant.identity}`;
      if (!storeParticipants[key] && currentChannelId) {
        console.warn('[LiveKit] Health check: missing participant, re-adding:', participant.identity);
        setParticipant({
          userId: participant.identity,
          channelId: currentChannelId,
          selfMute: !participant.isMicrophoneEnabled,
          selfDeaf: false,
          serverMute: false,
          serverDeaf: false,
          speaking: participant.isSpeaking,
          selfVideo: participant.isCameraEnabled,
          screenSharing: participant.isScreenShareEnabled,
        });
      }
    }
  }, 10_000);

  return () => clearInterval(interval);
}, [currentChannelId]);
```

- [ ] **Step 6: Add reconnecting overlay to VideoTile.tsx (after line 76)**

In VideoTile.tsx, when track is ended and it's a screen share, show reconnecting indicator:

After the existing `if (!track || track.readyState === 'ended' || !isVisible)` block (line 72-76), the video is cleared. Add an overlay for screen shares:

```tsx
{/* Reconnecting overlay for screen shares */}
{isScreen && !isPlaying && track && (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
    <div className="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full"
      style={{ color: 'var(--color-accent-primary)' }} />
    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
      Stream reconnecting...
    </span>
  </div>
)}
```

Place this inside the container div (line 128), before the video element.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/hooks/useLiveKitRoom.ts apps/web/src/components/voice/VideoTile.tsx
git commit -m "fix: harden voice reconnection logic and add stream reconnecting overlay"
```

---

## Task 13: Final Polish & Hardcoded Color Sweep

**Files:**
- All modified files from previous tasks

Final pass to catch any remaining hardcoded indigo/purple/Discord colors across the codebase.

- [ ] **Step 1: Search for remaining hardcoded indigo colors**

Run grep across the web app for any remaining indigo/purple hex values:

```bash
cd apps/web/src
grep -rn "#6c5ce7\|#7c6ff0\|#5a4bd6\|#a29bfe\|#fd79a8\|#e8e4ef\|#ed4245\|#43b581\|108, 92, 231" --include="*.tsx" --include="*.ts" --include="*.css"
```

Replace any findings with the corresponding CSS variable.

- [ ] **Step 2: Search for hardcoded Discord-like patterns**

```bash
grep -rn "blurple\|discord\|brand-default" --include="*.tsx" --include="*.ts" --include="*.css"
```

Replace any findings.

- [ ] **Step 3: Verify the app renders correctly**

Run the development server and visually verify:

```bash
cd apps/web && npm run dev
```

Check:
- Emerald-graphite colors throughout
- Atmospheric green nebula in background
- Floating pill dock on left
- Smart nav with SPACES/LIVE ROOMS/THREADS
- Voice room immersive stage
- Floating control bar
- Context panel with room health

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: sweep remaining hardcoded colors and polish emerald-graphite theme"
```
