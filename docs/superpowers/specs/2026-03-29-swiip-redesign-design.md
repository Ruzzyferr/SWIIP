# Swiip Complete Redesign + Voice Bugfix Spec

## Context

Swiip currently looks too similar to Discord. This redesign transforms the entire visual identity into a premium, original, emerald-graphite communication platform. Additionally, 3 critical voice/screen share bugs must be fixed: echo during screen share, connection drops/sync issues, and screen picker categorization.

Reference: `new theme.png` on desktop - the definitive visual target.

---

## Part 1: Visual Identity & Color System

### Color Palette

All CSS variables in `globals.css` will be replaced with the emerald-graphite system:

```
Surfaces (layered depth):
  --color-surface-base:      #090B0B
  --color-surface-elevated:  #121616
  --color-surface-raised:    #181E1D
  --color-surface-overlay:   #202827
  --color-surface-floating:  #2B3533

Accent (emerald):
  --color-accent-primary:    #10B981
  --color-accent-hover:      #059669
  --color-accent-active:     #047857
  --color-accent-muted:      rgba(52, 211, 153, 0.16)
  --color-accent-subtle:     rgba(52, 211, 153, 0.08)
  --color-accent-strong:     rgba(52, 211, 153, 0.25)
  --color-accent-gradient:   linear-gradient(135deg, #10B981, #34D399)

Text:
  --color-text-primary:      #F5F7F6
  --color-text-secondary:    #B7C3BF
  --color-text-tertiary:     #788682
  --color-text-disabled:     #3D4A46
  --color-text-accent:       #34D399

Borders:
  --color-border-default:    #2B3533
  --color-border-subtle:     rgba(255, 255, 255, 0.06)
  --color-border-strong:     rgba(255, 255, 255, 0.12)

Status:
  --color-status-online:     #10B981
  --color-status-idle:       #F59E0B
  --color-status-dnd:        #EF4444
  --color-status-offline:    #788682

Semantic:
  --color-danger-default:    #EF4444
  --color-danger-hover:      #DC2626
  --color-warning-default:   #F59E0B
  --color-success-default:   #10B981

Glass:
  --glass-bg:                rgba(18, 22, 22, 0.72)
  --glass-border:            rgba(255, 255, 255, 0.06)
  --glass-blur:              20px
  --glass-bg-hover:          rgba(24, 30, 29, 0.80)

Glow:
  --shadow-glow:             0 0 20px rgba(16, 185, 129, 0.20), 0 0 60px rgba(16, 185, 129, 0.08)
  --shadow-glow-strong:      0 0 30px rgba(16, 185, 129, 0.35), 0 0 80px rgba(16, 185, 129, 0.12)
```

### Atmospheric Background

The app background is NOT flat black. Per the reference image:
- Radial emerald haze at bottom-left and top-right corners
- Low-opacity nebula/cloud effect using CSS gradients
- Subtle animated drift (very slow, 30s+ cycle)
- Implementation: pseudo-elements on the root layout with radial-gradient and filter: blur(80px)

```css
/* Atmospheric depth on root */
body::before {
  content: '';
  position: fixed;
  bottom: -20%;
  left: -10%;
  width: 60%;
  height: 60%;
  background: radial-gradient(ellipse, rgba(16, 185, 129, 0.06) 0%, transparent 70%);
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}
body::after {
  content: '';
  position: fixed;
  top: -15%;
  right: -10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(ellipse, rgba(52, 211, 153, 0.03) 0%, transparent 70%);
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}
```

### Typography

- Font stays Inter (already premium)
- No changes to size scale
- Section labels: uppercase, letter-spacing 0.1em, --text-xs, --color-text-tertiary

### Visual Rules

- 80% dark neutrals, 15% emerald emphasis, 5% status tones
- Emerald for: active states, LIVE badges, avatar borders in voice, CTA buttons, glow effects
- NO emerald flood fill on large surfaces
- All shadows use emerald-tinted rgba instead of indigo
- Borders are very subtle (6% white opacity)

---

## Part 2: Layout Architecture

### Overview

The layout changes from a 5-panel Discord shell to a 4-panel premium structure:

```
Current:  [ServerRail 76px][ChannelSidebar 252px][Content flex][MemberSidebar 244px]
New:      [FloatingDock 64px][NavPanel 240px][RoomCanvas flex][ContextPanel 260px]
```

### 2A: Floating Pill Dock (replaces ServerRail)

**Width**: 64px
**Style**: Floating panel with rounded corners (20px), shadow, subtle glass border
**Margin**: 8px from left edge, 8px top/bottom (not touching edges)

**Structure (top to bottom)**:
1. Swiip logo icon (32x32)
2. Separator (thin emerald gradient line)
3. Workspace/guild icons (40x40 each, 8px gap)
   - Default: rounded-[16px], graphite bg with guild initial/icon
   - Active: emerald fill glow + scale(1.05)
   - Hover: scale(1.03), lighter bg
   - Unread: small emerald dot bottom-right
   - Mentions: red badge with count
4. Separator
5. Action group:
   - Create workspace (+) - emerald outline
   - Discover - emerald outline

**Key difference from Discord**: Floating, rounded, not touching edges. Pill-shaped container with shadow-float. No left-edge indicator pills - uses fill glow instead.

**File**: `apps/web/src/components/layout/ServerRail.tsx` (rename to `WorkspaceDock.tsx`)

### 2B: Smart Navigation Panel (replaces ChannelSidebar)

**Width**: 240px
**Style**: Glass bg, subtle right border

**Structure (top to bottom)**:
1. **Workspace header** (48px)
   - Workspace name (semibold, --text-md)
   - Settings gear icon (right)

2. **Categorized sections** with uppercase labels:
   - **SPACES** - Text channels grouped by category, folder-like items
   - **LIVE ROOMS** - Voice/video channels with live indicator
   - **THREADS** - Thread channels
   - "Add a Chat" at bottom (muted, + icon)

3. **Active item styling**:
   - 3px emerald left border
   - Emerald tint background (--color-accent-subtle)
   - Text becomes --color-text-primary

4. **Live room items** show:
   - Emerald dot/pulse next to name when active
   - Participant count badge
   - Connected users' avatars (small, stacked)

5. **User panel** (52px, fixed bottom):
   - Avatar (24x24) with status dot
   - Username + custom status
   - Mic/Deafen/Settings buttons (right)

**File**: `apps/web/src/components/layout/ChannelSidebar.tsx` (restructure internally)

### 2C: Immersive Room Canvas (center)

**Style**: Flex: 1, atmospheric background visible through

**Voice Room View** (when in voice channel):

1. **Room header**:
   - Room name (--text-xl, semibold)
   - "LIVE" emerald pill badge (when active)
   - "Connected | 35ms latency" subtitle (--color-text-tertiary)
   - Settings gear (right)

2. **Participant stage**:
   - Centered grid of participant cards
   - Each card: 120x140px, rounded-lg
   - Avatar (64x64) with emerald glow border when speaking
   - Name below avatar
   - Mic/mute icon indicator
   - Speaking animation: pulsing emerald ring
   - Cards have subtle dark bg (--color-surface-raised)

3. **Empty state**:
   - "No one else in this room yet."
   - "Invite to Join" CTA (emerald outline button)

4. **Screen share view**:
   - Full-width video player
   - Participant filmstrip at bottom
   - Floating controls overlay

5. **Floating control bar** (bottom center):
   - Centered, floating, glass bg, rounded-2xl
   - 8px padding, gap-2 between buttons
   - Buttons: Mic, Headphones, Camera, Screen share, NS (noise suppression)
   - Each: 40x40, rounded-xl, graphite bg, emerald icon on active
   - Leave button: red bg, separated by gap-4 from others
   - Shadow: --shadow-float

**File**: `apps/web/src/components/voice/VoiceRoomView.tsx`

**Text Channel View** (when in text channel):
- Same as current MessageList but with new color palette
- ChannelHeader with new styling

### 2D: Smart Context Panel (replaces MemberSidebar)

**Width**: 260px
**Style**: Glass bg, subtle left border

**Sections (voice room context)**:

1. **Participants** header + avatars:
   - "PARTICIPANTS" uppercase label
   - Avatar grid (stacked/inline)
   - Name + status indicator
   - Add friend (+) button

2. **Invite People**:
   - Search input (glass bg)

3. **OPTIMIZED AUDIO** section:
   - Badge: "OPTIMIZED AUDIO ENABLED"
   - Noise Suppression status
   - High Bitrate Audio status
   - Audio mode indicator (Standard/Enhanced/Raw)

4. **Pinned Resources**:
   - Pinned messages/links
   - Channel references (#bug-reports etc)

5. **Recent Discussion** (bottom):
   - Latest message preview with avatar
   - Truncated message text

**Text channel context**: Falls back to standard member list (grouped by role, virtualized).

**File**: `apps/web/src/components/layout/MemberSidebar.tsx` (rename to `ContextPanel.tsx`)

---

## Part 3: Component Updates

### 3A: Modal Component
- Glass bg with emerald-tinted shadow
- Border: --glass-border
- Backdrop: rgba(9, 11, 11, 0.80) + blur(4px)

### 3B: Button Variants
- Primary: emerald fill (#10B981), white text
- Secondary: graphite bg, emerald text
- Outline: emerald border, transparent bg
- Danger: red fill (#EF4444), white text
- Ghost: transparent, muted text, emerald on hover

### 3C: Input/Search
- Glass bg (--glass-bg)
- Subtle border (--glass-border)
- Focus: emerald glow ring
- Placeholder: --color-text-tertiary

### 3D: Avatar
- Voice room: emerald glow border when in channel
- Speaking: pulsing emerald ring animation
- Status dot colors: emerald (online), amber (idle), red (dnd)

### 3E: Tooltip
- Dark graphite bg (--color-surface-floating)
- Emerald-tinted shadow
- Small arrow/pointer

---

## Part 4: Voice Bugfixes

### 4A: Echo Prevention

**Problem**: Screen share audio captures voice chat output, creating echo loop.

**Fix - Desktop (Electron)**:
1. In `useLiveKitRoom.ts` `attachAudio`: Apply `setSinkId(outputDeviceId)` to all remote audio elements when outputDeviceId is not 'default'
2. Create `syncAudioSinks()` helper that updates all existing audio elements when output device changes
3. When screen share audio is active + outputDeviceId is 'default': show warning toast "Use headphones to prevent echo during screen share with audio"

**Fix - Web**:
1. In `useLiveKitRoom.ts` screen share sync effect: Add `suppressLocalAudioPlayback: true` to `setScreenShareEnabled` capture options
2. This tells browser to suppress local playback of shared tab audio

**Files**:
- `apps/web/src/hooks/useLiveKitRoom.ts` - attachAudio + screen share sync
- `apps/web/src/components/voice/ScreenShareModal.tsx` - echo warning

### 4B: Connection Stability & Sync

**Problem**: Stream drops while viewer shows frozen screen. Users appear dropped but are still connected.

**Fixes**:

1. **Skip participant removal during reconnect**:
   - In `ParticipantDisconnected` handler: if `room.state === ConnectionState.Reconnecting`, skip `removeParticipant` call
   - On `Connected`: reconcile store with `room.remoteParticipants`

2. **Extend grace period**: 15s -> 30s for screen share reconnect

3. **Expand volume retry**: [200, 800] -> [200, 800, 2000, 5000] ms

4. **Health check interval** (every 10s while connected):
   - Compare `room.remoteParticipants` with voice store participants
   - Fix inconsistencies (remove stale, add missing)
   - Check screen share track `readyState`

5. **VideoTile reconnecting overlay**:
   - When `track?.readyState === 'ended'` and `isScreen`: show "Stream reconnecting..." with spinner

**Files**:
- `apps/web/src/hooks/useLiveKitRoom.ts` - reconnect logic
- `apps/web/src/stores/voice.store.ts` - add `reconnecting` field
- `apps/web/src/components/voice/VideoTile.tsx` - reconnecting overlay

### 4C: Screen Picker Categorization (Desktop Only)

**Problem**: All sources listed in flat grid without categories.

**Fix**:
1. Add `sourceTab` state: `'screens' | 'windows'`
2. Filter sources by tab: `screen:` prefix vs `window:` prefix
3. Tab bar UI with "Ekranlar" and "Pencereler" buttons
4. Auto-select first source on tab change
5. Web users unaffected (browser native picker)

**File**: `apps/web/src/components/voice/ScreenShareModal.tsx`

---

## Part 5: File Change Map

### CSS/Theme (affects everything):
- `apps/web/src/styles/globals.css` - Complete color palette swap, atmospheric bg, glass variables, glow shadows

### Layout Components (major restructure):
- `apps/web/src/components/layout/ServerRail.tsx` -> `WorkspaceDock.tsx` - Floating pill dock
- `apps/web/src/components/layout/ChannelSidebar.tsx` - Smart nav with categories (SPACES, LIVE ROOMS, THREADS)
- `apps/web/src/components/layout/MemberSidebar.tsx` -> `ContextPanel.tsx` - Dynamic context panel
- `apps/web/src/components/layout/ChannelHeader.tsx` - New styling
- `apps/web/src/components/layout/UserPanel.tsx` - New styling
- `apps/web/src/app/(app)/layout.tsx` - Shell layout adjustments, atmospheric bg

### Voice/Room Components:
- `apps/web/src/components/voice/VoiceRoomView.tsx` - Immersive stage, floating controls
- `apps/web/src/components/voice/VideoTile.tsx` - Emerald glow, reconnecting overlay
- `apps/web/src/components/voice/ScreenShareModal.tsx` - Categorized picker + echo warning

### Voice Logic:
- `apps/web/src/hooks/useLiveKitRoom.ts` - Echo prevention, reconnect hardening, health check
- `apps/web/src/stores/voice.store.ts` - reconnecting field

### UI Components:
- `apps/web/src/components/ui/Modal.tsx` - Emerald glass styling
- `apps/web/src/components/ui/Button.tsx` - New variant colors
- `apps/web/src/components/ui/Input.tsx` - Glass input styling
- `apps/web/src/components/ui/Avatar.tsx` - Emerald glow states
- `apps/web/src/components/ui/Tooltip.tsx` - New colors

### Tailwind:
- `apps/web/tailwind.config.ts` - Update color references if any hardcoded

---

## Part 6: Implementation Order

1. **globals.css** - Color palette swap (instant visual transformation)
2. **tailwind.config.ts** - Update any hardcoded color references
3. **AppLayout** - Atmospheric background, shell layout adjustments
4. **WorkspaceDock** (ServerRail redesign) - Floating pill dock
5. **ChannelSidebar** - Smart navigation with categories
6. **VoiceRoomView** - Immersive stage + floating controls
7. **ContextPanel** (MemberSidebar redesign) - Dynamic context panel
8. **ChannelHeader** - New styling
9. **UserPanel** - New styling
10. **UI Components** - Modal, Button, Input, Avatar, Tooltip
11. **Voice bugfix: Screen picker** - Ekranlar/Pencereler tabs
12. **Voice bugfix: Echo** - setSinkId + suppressLocalAudioPlayback
13. **Voice bugfix: Stability** - Reconnect hardening, health check

---

## Part 7: Verification

### Visual:
- App loads with emerald-graphite palette
- Atmospheric green haze visible in background
- Floating pill dock on left with rounded corners
- Navigation panel shows SPACES/LIVE ROOMS/THREADS sections
- Voice room shows immersive stage with participant cards
- Floating glass control bar at bottom of voice room
- Context panel shows room health, participants, pinned resources
- All modals, buttons, inputs use new emerald accent

### Voice bugfixes:
- Screen share with audio: no echo heard by other participants
- Network interruption: stream resumes, participants stay visible
- Desktop screen picker: "Ekranlar" and "Pencereler" tabs work correctly

### No regressions:
- Text channels, messaging, DMs still function
- Mobile responsive layout still works
- Keyboard shortcuts still work
- Settings overlay still functions
