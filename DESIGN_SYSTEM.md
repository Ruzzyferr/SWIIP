# ConstChat Design System

## Philosophy

ConstChat's visual identity is built on one principle: **authored, not assembled**.

Every surface, component, and interaction pattern is designed specifically for ConstChat. Utility primitives (spacing scale, color tokens, motion values) are used as building blocks — but the final visual language is original.

### What this means in practice

- **Allowed**: Using Tailwind utility classes, headlessui/radix for accessibility primitives, low-level hooks
- **Not allowed**: Using shadcn, Mantine, Chakra, or any prebuilt component kit as the product's visual language
- **Standard**: Every component ships with its ConstChat-specific hover/active/focus/disabled/loading state

---

## Color System

### Surface Stack

The app uses a 5-level surface depth system. No surface is flat black. Depth is created through lightness steps, not opacity.

| Token | Value | Usage |
|---|---|---|
| `surface.base` | `#0e0f11` | App root, server rail background |
| `surface.elevated` | `#141518` | Channel sidebar, left panel |
| `surface.raised` | `#1a1c20` | Content area cards, user panel |
| `surface.overlay` | `#1f2126` | Modals, drawers |
| `surface.floating` | `#252830` | Tooltips, context menus, dropdowns |

### Accent System

Single primary accent. No rainbow theming in the product chrome.

| Token | Value | Usage |
|---|---|---|
| `accent.primary` | `#6366f1` (Indigo 500) | Active states, buttons, links, focus rings |
| `accent.hover` | `#4f52d9` | Hover on accent elements |
| `accent.muted` | `rgba(99,102,241,0.15)` | Active channel background, reaction selected |
| `accent.subtle` | `rgba(99,102,241,0.08)` | Hover backgrounds in lists |

### Text Hierarchy

| Token | Value | Usage |
|---|---|---|
| `text.primary` | `#f0f1f3` | Main content, headings |
| `text.secondary` | `#9ca3af` | Channel names (default), body copy |
| `text.tertiary` | `#6b7280` | Category labels, timestamps, metadata |
| `text.disabled` | `#4b5563` | Disabled inputs, muted elements |

### Status Colors

| Status | Color | Hex |
|---|---|---|
| Online | Green | `#22c55e` |
| Idle | Amber | `#f59e0b` |
| Do Not Disturb | Red | `#ef4444` |
| Offline | Gray | `#6b7280` |

### Semantic Colors

- **Danger**: `#ef4444` (red) for destructive actions, errors
- **Success**: `#22c55e` (green) for confirmations
- **Warning**: `#f59e0b` (amber) for cautions
- **Mention**: `rgba(99,102,241,0.12)` background, `rgba(99,102,241,0.4)` border

---

## Typography

### Font Stack

```
Display:  Cal Sans, Inter, system-ui
Body:     Inter, system-ui, -apple-system, sans-serif
Mono:     JetBrains Mono, Fira Code, monospace
```

### Type Scale

| Role | Size | Weight | Letter Spacing | Usage |
|---|---|---|---|---|
| `text-xs` | 11px | 500 | +0.04em | Category labels, timestamps, badges |
| `text-sm` | 13px | 400 | 0 | Message metadata, member names in lists |
| `text-base` | 15px | 400 | 0 | Message body, input content |
| `text-md` | 16px | 500 | -0.01em | Channel name in header |
| `text-lg` | 18px | 600 | -0.01em | Server name in sidebar header |
| `text-xl` | 20px | 700 | -0.02em | Section headings in settings |
| `text-2xl` | 24px | 700 | -0.02em | Page titles |
| `text-3xl` | 30px | 800 | -0.03em | Auth screens, empty states |

---

## Spacing

4px base grid. All spacing is multiples of 4.

```
0    = 0px
0.5  = 2px     (micro: badge padding)
1    = 4px     (compact: icon padding, small gaps)
1.5  = 6px     (between related elements)
2    = 8px     (between list items, small padding)
3    = 12px    (medium padding, gap between groups)
4    = 16px    (standard padding, input padding)
5    = 20px    (section padding)
6    = 24px    (between sections)
8    = 32px    (large section gaps)
10   = 40px    (view padding)
12   = 48px    (modal padding)
16   = 64px    (large empty state spacing)
```

---

## Motion

### Principles

1. Motion communicates state, not decoration
2. Micro-transitions: 140-200ms (hover states, list item appearance)
3. Panel transitions: 200-280ms (sidebar open/close, modal)
4. Presence-heavy states (speaking indicator, typing): shorter, 80-120ms
5. Never block user intent with animation

### Duration Tokens

| Token | Value | Usage |
|---|---|---|
| `instant` | 80ms | Speaking indicators, status dots |
| `fast` | 140ms | Hover states, button presses |
| `normal` | 200ms | Component mount, navigation |
| `slow` | 300ms | Modal open, panel slide |
| `slower` | 400ms | Onboarding, significant views |

### Easing Tokens

| Token | Curve | Usage |
|---|---|---|
| `standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default for most transitions |
| `decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering the screen |
| `accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving the screen |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful interactions (reaction pop, icon bounce) |

---

## Layout

### Shell Dimensions

```
Server Rail:         72px  (fixed left, surface.base)
Channel Sidebar:    240px  (fixed, surface.elevated)
Member Sidebar:     240px  (right, surface.elevated, togglable)
Bottom Bar:          52px  (user panel, surface.raised)
Title Bar:           48px  (channel header, surface.elevated/raised)
```

### Server Rail

- **Icons**: 48px circles. On hover → `border-radius` transitions from 50% → 30% (squircle feel)
- **Active indicator**: 4px wide, 32px tall rounded pill on left edge, accent color
- **Tooltip**: server name appears on right side, ~160ms delay
- **Scrollable zone**: servers list overflows-y with hidden scrollbar
- **Fixed elements**: DM/Home at top, Add Server + Discover at bottom

### Channel Sidebar

- Server name: bold, 15px, primary text, 16px padding
- Category rows: 11px, uppercase, letter-spacing wide, tertiary text
- Channel rows: 14px, secondary text normally, primary on hover
- Active channel: accent.muted background, primary text, accent left border (2px)
- Voice channels: show participant count + avatars when occupied

### Message List

- Messages group by author + time window (5 minutes)
- First message in group: full header (avatar + name + timestamp)
- Subsequent messages in group: no avatar/header, left-aligned with 72px indent
- Hover shows timestamp (right-aligned, tertiary text)
- Date separator: full-width divider with centered date pill
- Unread separator: same style but "New Messages" label in accent color

### Message Item Hover State

On hover, a floating action bar appears top-right:
- React (emoji icon)
- Reply (reply icon)
- Edit (pencil, own messages only)
- More (ellipsis → dropdown with: Pin, Mark Unread, Copy Link, Copy ID, Delete)

Background: `surface.floating`, shadow.md, border.subtle

---

## Component Specification

### Button

Variants:
- **Primary**: `bg-accent`, `text-white`, hover `bg-accent-hover`
- **Secondary**: `bg-surface-raised`, `text-text-primary`, hover `bg-surface-overlay`
- **Ghost**: transparent, hover `bg-surface-raised`
- **Danger**: `bg-danger`, `text-white`, hover `bg-danger-hover`
- **Link**: no background, accent text

Sizes:
- sm: 28px height, 8px x-padding, 13px font
- md: 36px height, 16px x-padding, 14px font
- lg: 44px height, 24px x-padding, 15px font

States: default, hover, active (slight scale 0.98), focus (accent ring 2px offset 2px), disabled (opacity 0.4), loading (spinner replaces content)

### Input

- Background: `surface.base`, border: `border.subtle`, 1px
- Focus: border changes to `accent.primary`
- Error: border `danger.default`, error text below in danger color
- Label: 12px, semibold, tertiary text, 6px margin-bottom
- Padding: 10px 12px
- Border radius: `radius.md` (6px)
- Height: 40px for standard, 32px for compact

### Avatar

- Presence indicator: 10px dot, 2px ring (solid, matches surface background)
- Position: bottom-right of avatar
- Sizes: xs(16), sm(24), md(32), lg(40), xl(48), xxl(80)
- Border radius: 50% (round)
- Fallback: initials in 1-2 chars, deterministic background from userId hash

### Context Menu

- Background: `surface.floating`
- Border: `border.subtle` 1px
- Shadow: `shadow.xl`
- Border radius: `radius.lg` (8px)
- Item height: 32px
- Item padding: 8px 12px
- Danger items: `text-danger`
- Separators: `border.subtle` 1px horizontal line
- Keyboard: arrow keys navigate, Enter selects, Escape closes

---

## Anti-Patterns (What NOT to Do)

| Pattern | Problem | ConstChat Approach |
|---|---|---|
| Shadcn dialog/card style | Looks like every SaaS tool | Custom panel geometry |
| Neon + heavy blur | Cyberpunk cliché, ages fast | Controlled subtle blur, no glow spam |
| Large rounded cards | Dashboard feel, low density | Tight panels, precise spacing |
| Default Lucide icons | Too recognizable as template | Custom stroke weight, scoped usage |
| Gradient text | Overused AI aesthetic | Reserved for marketing copy only |
| Full-width dividers everywhere | Noise, no hierarchy | Use space to separate, not lines |
| Light mode only | Alienates core users | Dark first, light mode as future addition |

---

## Empty States

Each empty state should be authored, not generic.

Structure:
- Illustration or icon (not stock)
- Heading: direct, useful ("No messages here yet")
- Subtext: contextual help ("Send a message to start the conversation")
- CTA if applicable

Avoid: "Nothing to see here" · generic icons · Lorem ipsum content

---

## Implementation Notes

Design tokens live in `packages/design-tokens/src/tokens.ts`.
CSS variables are injected in `apps/web/src/styles/globals.css`.
Tailwind config extends the design tokens via CSS variables.
Motion values use Framer Motion's `transition` props with token values.
All new components must have: default, hover, active, focus, disabled, and loading states.
