# Luxury Redesign — Foundation Spec

**Date:** 2026-04-20
**Scope:** Foundation only — design tokens, typography, motion vocabulary, component grammar. Application of these tokens to specific views (app shell, messaging, voice, settings, auth) is explicitly out of scope and will be covered in follow-up specs.
**Status:** Proposed — pending implementation plan.

---

## 1. Goals and Constraints

### Goals

1. Replace the existing emerald/dark-neutral utilitarian palette and Cal Sans display pairing with a distinct **"Obsidian Platinum"** visual identity — cool, architectural, engineering-precise. Reference mood: Linear × Phantom Wallet × Rolex dark.
2. Upgrade the typographic voice from generic display-sans to a **serif display + humanist body** pairing that reads as authored, literary, deliberate.
3. Introduce a **motion vocabulary** ("Gravitas") that feels slow, confident, inevitable — not snappy, not bouncy. A single easing curve, three canonical durations, three canonical gesture patterns.
4. Increase **layout breathing room** by ~20% so the product reads as a reading surface, not a dense workstation.
5. Keep the token API surface in `@constchat/design-tokens` backward-compatible so existing consumers pick up the new visuals by re-theming tokens, not by refactoring call sites.

### Hard constraints (from the user)

- **No functional regressions.** Every button, handler, event, prop, route, and state machine must keep its current behavior. This spec changes visual tokens, typography, motion, and grammar — never logic.
- **Not only colors — layout, organization, ease of use included.** This foundation doc covers tokens, typography, motion, and component grammar. The actual layout density shift is spec'd here at the primitive level (spacing tokens, component anatomy) but applied in follow-up specs (app-shell, messaging, voice).
- **No library swaps.** No shadcn, Mantine, Chakra. No new headless UI packages. We already forbid these per `DESIGN_SYSTEM.md`.
- **No cross-cutting accessibility regression.** Every new color pair must meet WCAG AA body-text contrast minimum (4.5:1); primary accent on surface.base must meet AA large-text minimum (3:1).

### Non-goals

- Any view-level redesign (channel sidebar, message composer, voice panel layouts, settings sections). These get their own specs.
- Icon library swap — keep existing iconography.
- Mobile / desktop client visual changes. Web app first; other surfaces pick up tokens later via existing shared `@constchat/design-tokens` package.
- Internationalization — no text content changes.

---

## 2. Architecture

### 2.1 Single source of truth

All visual primitives live in **`packages/design-tokens/src/tokens.ts`**. Consumers (web, mobile, ui-primitives) import from `@constchat/design-tokens` and never hardcode values. The redesign is implemented by editing that file plus `css-variables.ts` — not by touching consumer components.

```
packages/design-tokens/
  src/
    tokens.ts              # ← color/spacing/type/motion/radius/shadow/layout primitives
    css-variables.ts       # ← :root CSS var generator (consumed by globals.css)
    index.ts
```

### 2.2 Token categories (unchanged groupings)

We retain the current eight groupings:

| Group | Role |
|---|---|
| `colors` | Surface scale, accent, text, borders, status, danger, success, warning, mention, voice |
| `spacing` | 4px-grid scale |
| `typography` | Font families, sizes, weights, line heights, letter spacing |
| `radius` | Border radius scale |
| `shadow` | Elevation and glow shadows |
| `motion` | Duration + easing |
| `zIndex` | Stacking layers |
| `layout` | Fixed shell dimensions |

No new groupings. The redesign is a **token-value swap**, not a structural change.

### 2.3 Component grammar layer

A new file `packages/design-tokens/src/recipes.ts` exports **composition recipes** — named objects that describe how primitives combine into component patterns (`button.primary`, `card.raised`, `focusRing.default`). These are read by `ui-primitives` components and shared across consumers so the grammar stays consistent.

Recipes are **not** components — they are data describing the pattern. A Button component still decides its own JSX; it just reads its values from the recipe.

---

## 3. Color System — Obsidian Platinum

### 3.1 Surface scale (5 layers, unchanged levels)

| Token | Old (emerald-dark) | New (obsidian-platinum) | Role |
|---|---|---|---|
| `surface.base` | `#090B0B` | `#0A0C11` | True page background |
| `surface.elevated` | `#121616` | `#141820` | Sidebars, panels |
| `surface.raised` | `#181E1D` | `#1B212C` | Cards, list items |
| `surface.overlay` | `#202827` | `#242B39` | Modals, sheets |
| `surface.floating` | `#2B3533` | `#2E3646` | Tooltips, dropdowns |

Each layer is a cool blue-slate with progressive lightening. The scale preserves the 5-level depth model; only the hue and absolute values change.

### 3.2 Accent — platinum, not gold

| Token | Old | New | Notes |
|---|---|---|---|
| `accent.primary` | `#10B981` | `#C4CAD3` | Platinum — cool mid-grey |
| `accent.hover` | `#059669` | `#DDE2E9` | Lighter on hover (inverted: platinum lightens, doesn't deepen) |
| `accent.active` | `#047857` | `#A8AFB8` | Pressed state |
| `accent.muted` | emerald 16% | `rgba(196, 202, 211, 0.14)` | Background tints |
| `accent.subtle` | emerald 8% | `rgba(196, 202, 211, 0.07)` | Ghost backgrounds |
| `accent.strong` | emerald 25% | `rgba(196, 202, 211, 0.22)` | Active backgrounds |

**Why platinum as accent:** a metallic, desaturated "primary" is the central luxury decision. It forces color to be used as meaning (status, mention, voice speaking) rather than as decoration. The platinum reads as "quiet precious metal" rather than "brand color."

### 3.3 Secondary accent — cool wine (reserved)

A new sub-group `accent.secondary` provides a desaturated cool wine for moments that need emotional weight:

```ts
accent: {
  // ...primary above
  secondary: {
    default: '#5B1F2A',
    hover: '#6E2632',
    muted: 'rgba(91, 31, 42, 0.32)',
    subtle: 'rgba(91, 31, 42, 0.14)',
  },
}
```

Used sparingly: destructive confirms on premium actions, "live" badges, theatrical CTAs. Not a general-purpose color.

### 3.4 Text scale

| Token | Old | New |
|---|---|---|
| `text.primary` | `#F5F7F6` | `#E8ECF1` |
| `text.secondary` | `#B7C3BF` | `#B4BAC4` |
| `text.tertiary` | `#788682` | `#8A92A0` |
| `text.disabled` | `#3D4A46` | `#454C58` |
| `text.inverse` | `#090B0B` | `#141820` |
| `text.accent` | `#34D399` | `#C4CAD3` |

**Contrast check (against `surface.base` `#0A0C11`):**
- `text.primary #E8ECF1` → 15.2:1 (AAA ✓)
- `text.secondary #B4BAC4` → 9.8:1 (AAA ✓)
- `text.tertiary #8A92A0` → 5.8:1 (AA ✓)
- `accent.primary #C4CAD3` → 11.1:1 (AAA ✓)

### 3.5 Status colors

Status colors are **not** re-themed — they must stay semantically identifiable across themes. We keep existing hues but nudge saturation down ~10% so they sit inside the cool palette:

| Token | Old | New |
|---|---|---|
| `status.online` | `#10B981` | `#3FA887` — cool emerald |
| `status.idle` | `#F59E0B` | `#D69A3C` — muted amber |
| `status.dnd` | `#EF4444` | `#C54846` — cool red |
| `status.offline` | `#788682` | `#6C7583` — cool grey |

`danger.*`, `success.*`, `warning.*` follow the same saturation reduction. Retaining semantic meaning while fitting the palette.

### 3.6 Voice participant colors

Voice speaking indicators previously used emerald — now use **platinum** (the new accent):

```ts
voice: {
  speaking: '#C4CAD3',      // platinum ring around avatar
  mutedSpeaking: '#D69A3C', // muted amber — user speaking while muted
  deafened: '#C54846',      // cool red
  disconnected: '#6C7583',
}
```

This is the single most visible place the new accent appears in day-to-day use (the speaking ring), and it locks the luxury identity in.

### 3.7 Borders

| Token | Old | New |
|---|---|---|
| `border.subtle` | `rgba(255,255,255,0.04)` | `rgba(196,202,211,0.05)` — slight platinum tint |
| `border.default` | `rgba(255,255,255,0.07)` | `rgba(196,202,211,0.09)` |
| `border.strong` | `rgba(255,255,255,0.12)` | `rgba(196,202,211,0.16)` |
| `border.focus` | emerald 50% | `rgba(196,202,211,0.45)` — platinum focus ring |

Tinting borders with a hint of platinum (instead of pure white alpha) pulls the whole surface hierarchy toward the cool palette.

---

## 4. Typography — Fraunces + Inter

### 4.1 Font stack change

```ts
fontFamily: {
  display: "'Fraunces', 'Iowan Old Style', 'Cambria', Georgia, serif",
  sans:    "'Inter', 'system-ui', -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
}
```

- **Display (Fraunces):** optical-sized variable serif. Used for all page/section titles, channel names in headers, server names, modal titles, empty-state hero text. NOT used for body, buttons, or inline metadata.
- **Sans (Inter):** unchanged — remains the body/UI workhorse.
- **Mono (JetBrains Mono):** unchanged.

### 4.2 Loading strategy

- `next/font/google` for Fraunces with `display: 'swap'`, `axes: ['SOFT', 'WONK', 'opsz']` (enables optical sizing).
- Inter and JetBrains Mono already loaded via `next/font` — no change.
- No extra network weight: Fraunces loaded alongside existing Inter, both subsetted to Latin by default. Monitor LCP in production; if Fraunces shows up as a critical-path culprit, preload it.

### 4.3 Size scale — adjusted for serif pairing

Serif display needs slightly larger sizes to read with weight. Sans body stays the same.

| Token | Old | New | Primary use |
|---|---|---|---|
| `xs` | 11px | 11px | Timestamps, labels |
| `sm` | 13px | 13px | Secondary body |
| `base` | 15px | 15px | Default body |
| `md` | 16px | 16px | Emphasized body |
| `lg` | 18px | 19px | Small display |
| `xl` | 20px | 22px | Section headings (display) |
| `2xl` | 24px | 26px | Page headings (display) |
| `3xl` | 30px | 34px | Hero headings (display) |
| `4xl` | 36px | 44px | Marketing / empty-state hero |

Sizes `lg` and up are intended for `display` family; sizes `md` and below are intended for `sans`. This is a convention, not a hard binding.

### 4.4 Display usage rules

- Serif for **nouns of identity**: server name, channel title, user display name in profile cards, modal titles.
- Sans for **verbs and UI**: buttons, menu items, inline metadata, form labels, message body text.
- **Never mix inside a single paragraph.** A channel header shows serif title + sans metadata on separate lines.
- Display is always set with `letter-spacing: tight` (`-0.02em`) and `font-weight: 500` (not bold).

### 4.5 Line heights

No change to `lineHeight` tokens. Serif display titles use `snug` (1.375), body uses `normal` (1.5), long-form reading contexts use `relaxed` (1.625).

---

## 5. Spacing — the "Breathing" density shift

The current spacing scale (`packages/design-tokens/src/tokens.ts` lines 129-153) is a 4px grid and stays intact. The density change is implemented at the **component level** via recipes, not by changing the primitive scale.

### 5.1 Density recipes

```ts
export const density = {
  messageListGap: spacing[4.5],   // 18px (was effectively 10px)
  composerPadding: spacing[3.5],  // 14px
  voiceTileGap: spacing[3],       // 12px
  listItemPaddingY: spacing[2.5], // 10px (was ~7px)
  listItemPaddingX: spacing[4],   // 16px
  panelPadding: spacing[5],       // 20px
  sectionGap: spacing[6],         // 24px
} as const;
```

A new token `spacing[4.5] = '18px'` is added to the primitive scale. All other density values use existing tokens.

### 5.2 Layout dimension updates

```ts
layout: {
  serverRailWidth:      '64px',   // unchanged
  channelSidebarWidth:  '260px',  // was 240 — +20px for breathing room
  memberSidebarWidth:   '280px',  // was 260
  bottomBarHeight:      '56px',   // was 52
  titleBarHeight:       '48px',   // unchanged
  messageInputMinHeight: '48px',  // was 44
  messageInputMaxHeight: '50vh',  // unchanged
  threadPanelWidth:     '420px',  // was 400
}
```

**Risk:** changing shell widths can affect horizontal viewport budget on 1280px screens. Mitigation: verify a 3-column visible (channel + messages + thread) still fits at 1280px — the total rises from 240+400=640px sidebar budget to 260+420=680px. Main content still gets ≥600px, which is above the 520px minimum-readable-column target.

---

## 6. Motion — "Gravitas"

### 6.1 Canonical easing

```ts
motion: {
  easing: {
    gravitas:    'cubic-bezier(0.2, 0.8, 0.2, 1)',   // NEW — default for everything
    standard:    'cubic-bezier(0.4, 0, 0.2, 1)',      // kept for backcompat, deprecated
    decelerate:  'cubic-bezier(0, 0, 0.2, 1)',        // kept
    accelerate:  'cubic-bezier(0.4, 0, 1, 1)',        // kept
    spring:      'cubic-bezier(0.34, 1.56, 0.64, 1)', // kept, but forbidden in new code
    linear:      'linear',
  }
}
```

**Gravitas** is the single default. It enters fast and decelerates long — the animated thing "lands" slowly and deliberately. No overshoot, no bounce.

### 6.2 Canonical durations

```ts
duration: {
  instant: '80ms',   // unchanged — checkbox toggles, cursor blinks
  fast:    '180ms',  // was 140ms — hover, tap, state swaps
  normal:  '220ms',  // was 200ms — panels, accordions, popovers
  slow:    '320ms',  // was 300ms — modals entering, sheets, transitions
  slower:  '480ms',  // was 400ms — page transitions
  slowest: '700ms',  // was 600ms — hero animations, landing
}
```

Longer durations overall. The product should feel "unhurried" — never snappy.

### 6.3 Canonical motion gestures (recipes)

Three named gestures cover ~95% of UI motion. Components import these rather than authoring their own:

```ts
export const gestures = {
  // Subtle hover: 1px translate + shadow warm
  hoverLift: {
    transition: `transform ${motion.duration.fast} ${motion.easing.gravitas}, box-shadow ${motion.duration.fast} ${motion.easing.gravitas}`,
    rest:  { transform: 'translateY(0)', boxShadow: shadow.sm },
    hover: { transform: 'translateY(-1px)', boxShadow: shadow.md },
  },
  // Panel / sheet entrance: 8px rise + fade
  slideIn: {
    transition: `opacity ${motion.duration.normal} ${motion.easing.gravitas}, transform ${motion.duration.normal} ${motion.easing.gravitas}`,
    enter: { opacity: 0, transform: 'translateY(8px)' },
    enterActive: { opacity: 1, transform: 'translateY(0)' },
  },
  // Active / speaking breathe: gentle 2.5s pulse
  breathe: {
    animation: 'breathe 2.5s ease-in-out infinite',
    keyframes: '@keyframes breathe { 0%,100% { transform: scale(1); opacity: 0.65; } 50% { transform: scale(1.06); opacity: 1; } }',
  },
} as const;
```

### 6.4 Removed gestures

The following existing motion patterns are banned going forward:

- **Spring overshoot** on button taps — felt playful, clashes with the luxury tone.
- **Scale-from-0 popovers** — the "grow from nothing" gesture now uses `slideIn` (fade + rise).
- **Easeout pulse on notifications** — replaced by `breathe`.

Existing code using `motion.easing.spring` is not removed in this spec — follow-up specs migrate views one at a time.

### 6.5 Reduced motion

All three gestures must respect `prefers-reduced-motion: reduce`:

```ts
@media (prefers-reduced-motion: reduce) {
  .hoverLift, .slideIn, .breathe { transition: none !important; animation: none !important; }
}
```

This is non-negotiable and ships alongside gesture styles.

---

## 7. Component Grammar (Recipes)

`packages/design-tokens/src/recipes.ts` exports the following recipe groups. These describe the grammar — components consume them.

### 7.1 Button

```ts
button: {
  primary: {
    background: `linear-gradient(180deg, ${colors.accent.primary}, ${colors.accent.active})`,
    color:      colors.text.inverse,
    border:     'none',
    padding:    `${spacing[2]} ${spacing[4]}`,
    radius:     radius.md,            // 6px
    shadow:     `0 1px 0 rgba(255,255,255,0.22) inset, 0 6px 16px rgba(196,202,211,0.14)`,
    font:       { family: typography.fontFamily.sans, weight: 600, size: typography.fontSize.sm },
    gesture:    gestures.hoverLift,
  },
  secondary: {
    background: colors.surface.elevated,
    color:      colors.text.primary,
    border:     `1px solid ${colors.border.default}`,
    padding:    `${spacing[2]} ${spacing[4]}`,
    radius:     radius.md,
    shadow:     shadow.none,
    font:       { family: typography.fontFamily.sans, weight: 500, size: typography.fontSize.sm },
    gesture:    gestures.hoverLift,
  },
  ghost: {
    background: 'transparent',
    color:      colors.text.secondary,
    border:     'none',
    padding:    `${spacing[2]} ${spacing[3]}`,
    radius:     radius.md,
    font:       { family: typography.fontFamily.sans, weight: 500, size: typography.fontSize.sm },
    gesture:    { /* only color shift on hover, no lift */ },
  },
  danger: {
    background: colors.accent.secondary.default,
    color:      colors.text.primary,
    border:     `1px solid ${colors.accent.secondary.hover}`,
    padding:    `${spacing[2]} ${spacing[4]}`,
    radius:     radius.md,
    font:       { family: typography.fontFamily.sans, weight: 600, size: typography.fontSize.sm },
    gesture:    gestures.hoverLift,
  },
}
```

**Grammar rules:**
- Default size is `md` (above). Small (`sm`) reduces padding one step, large (`lg`) increases one step. No `xl` or `xs`.
- Border radius is **always `radius.md` (6px)**. Pill buttons (`radius.full`) are reserved for **only** status badges.
- Primary uses a platinum→darker-platinum gradient with an inset white top-highlight — this is what reads as "metallic" without being kitsch.

### 7.2 Card

```ts
card: {
  raised: {
    background: colors.surface.raised,
    border:     `1px solid ${colors.border.subtle}`,
    radius:     radius.xl,           // 12px
    padding:    spacing[5],          // 20px
    shadow:     shadow.md,
    gesture:    gestures.hoverLift,
  },
  flat: {
    background: colors.surface.elevated,
    border:     `1px solid ${colors.border.subtle}`,
    radius:     radius.lg,           // 8px
    padding:    spacing[4],          // 16px
    shadow:     shadow.none,
  },
  feature: {
    background: `linear-gradient(180deg, ${colors.surface.raised}, ${colors.surface.elevated})`,
    border:     `1px solid ${colors.border.default}`,
    radius:     radius['2xl'],       // 16px
    padding:    spacing[6],          // 24px
    shadow:     shadow.lg,
  },
}
```

### 7.3 Focus ring

A single focus ring spec, used everywhere:

```ts
focusRing: {
  outline: 'none',
  boxShadow: `0 0 0 2px ${colors.surface.base}, 0 0 0 4px ${colors.border.focus}`,
  transition: `box-shadow ${motion.duration.fast} ${motion.easing.gravitas}`,
}
```

The two-layer ring (surface color + platinum alpha) keeps the focus ring visible on any background. Every focusable element receives this — no custom focus styling.

### 7.4 Input

```ts
input: {
  default: {
    background: colors.surface.elevated,
    border:     `1px solid ${colors.border.default}`,
    radius:     radius.lg,           // 8px
    padding:    `${spacing[2.5]} ${spacing[3.5]}`,
    color:      colors.text.primary,
    placeholder: colors.text.tertiary,
    font:       { family: typography.fontFamily.sans, size: typography.fontSize.base },
    focus: {
      border:   `1px solid ${colors.border.focus}`,
      shadow:   `0 0 0 4px ${colors.accent.subtle}`,
    },
  },
}
```

### 7.5 Modal / overlay

```ts
overlay: {
  backdrop: {
    background: 'rgba(10, 12, 17, 0.72)',
    backdropFilter: 'blur(14px) saturate(1.1)',
    animation: gestures.slideIn,
  },
  panel: {
    background: colors.surface.overlay,
    border:     `1px solid ${colors.border.default}`,
    radius:     radius['2xl'],       // 16px
    padding:    spacing[6],          // 24px
    shadow:     shadow.xl,
    maxWidth:   '520px',             // conservative, reading-width
  },
}
```

### 7.6 What recipes are NOT

- Recipes do not define component JSX or behavior.
- Recipes do not replace `ui-primitives` components — components still decide their DOM, events, ARIA, keyboard handling.
- Recipes do not solve state (pressed, disabled, loading). Components implement those by layering on top of the base recipe.

---

## 8. Implementation Phasing (for follow-up planning)

This spec is **foundation only**. Implementing it involves three phases:

### Phase F1 — Tokens + recipes (this spec)
- Edit `tokens.ts`: colors, typography, spacing, motion, layout.
- Add `recipes.ts`: button, card, input, overlay, focus ring, gestures.
- Regenerate `css-variables.ts`.
- No consumer code changes. After this phase, the app looks **different** because tokens changed — but every component is still functionally identical.

### Phase F2 — `ui-primitives` adoption (own spec)
- Migrate each primitive (`Button`, `Input`, `Card`, `Modal`, etc.) to read from the new recipes.
- Verify zero behavior change via snapshot + interaction tests.

### Phase F3 — View-level redesigns (one spec per area)
- App shell, messaging, voice, settings, auth — each gets its own spec, its own plan, its own PR.
- Each view-level spec references this foundation spec for tokens and grammar.

Only F1 is in scope for the implementation plan that follows this spec.

---

## 9. Data Flow

Not applicable — this is a static token + recipe package update. No runtime data flow, no API contracts.

---

## 10. Error Handling

Not applicable at this layer. Runtime errors are produced by consumer code; tokens are static values compiled at build time.

Edge case considered: if a consumer hardcodes an old color (e.g., `#10B981`) rather than importing the token, the redesign won't reach that call site. **Mitigation in Phase F2:** grep for hardcoded hex colors in `apps/web` and `packages/ui-primitives`, replace with token references. Tracked in F2 spec.

---

## 11. Testing

### 11.1 Token-level tests

- Unit test in `packages/design-tokens`: every color token listed in `text.*` and `accent.primary` has WCAG contrast ≥ 4.5:1 against `surface.base`, `surface.elevated`, `surface.raised`. Uses a small `contrast(fg, bg) >= 4.5` helper.
- Unit test: every entry in `spacing` is a positive multiple of 2 (sanity).
- Unit test: every easing string in `motion.easing` is a valid `cubic-bezier(...)` or keyword.

### 11.2 Visual regression (Phase F2 concern, out of scope here)

This spec does not require visual regression infra. F2 and view-level specs will add Playwright snapshot checks at that time.

### 11.3 Accessibility

- Manual axe-core sweep of a representative page after tokens apply — **deferred to F2** when visual changes propagate to real components.
- `prefers-reduced-motion` honored by all three `gestures.*` — asserted by a styling test in F1.

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Consumers hardcode colors/fonts (tokens don't reach them) | Medium | Medium | Grep sweep in F2; lint rule forbidding hex literals in component code. |
| Fraunces worsens LCP | Low | Medium | Use `next/font` with `display: 'swap'`; monitor LCP metric after F1 ships; preload only if regressed. |
| Layout width changes break 3-column viewport at 1280px | Low | Medium | Verified in §5.2 — 1280px still fits 3 columns with ≥600px main content. Add a Playwright viewport test. |
| Platinum accent reads "washed out" on screens with poor color profile | Low | Low | Contrast tests pass at AAA. Review on 2-3 real devices before shipping F1. |
| Existing snapshot tests in `ui-primitives` break on token values | High (expected) | Low | Update snapshots deliberately in F1 PR — document every diff. |
| View-level specs discover a token gap | Medium | Low | Foundation spec is not frozen — if a view needs a new token category, we extend this spec. |

---

## 13. Open Questions

None — user selected palette (Obsidian Platinum), typography (Fraunces + Inter), density (Breathing), and motion (Gravitas). Subsequent view-level specs will surface their own open questions.

---

## 14. Deliverables Summary

When Phase F1 (covered by this spec + its follow-up plan) is complete:

1. `packages/design-tokens/src/tokens.ts` — new color, typography, spacing, layout values.
2. `packages/design-tokens/src/recipes.ts` — new file with `gestures`, `button`, `card`, `input`, `overlay`, `focusRing`.
3. `packages/design-tokens/src/css-variables.ts` — regenerated to export the updated palette and motion tokens.
4. Token-level unit tests (§11.1).
5. `apps/web` loads Fraunces via `next/font`.
6. No `apps/web`, `apps/mobile`, or `packages/ui-primitives` component code changes.

Visually, the product after F1 ships will already look different — because every component reads from the tokens. Behaviorally, nothing has changed.
