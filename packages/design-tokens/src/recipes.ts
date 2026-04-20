/**
 * Component Grammar Recipes — Obsidian Platinum
 *
 * Recipes are DATA that describe how primitive tokens combine into component
 * patterns. Components (in ui-primitives / apps) read these to style themselves.
 *
 * Recipes are NOT components — they don't define JSX, events, or ARIA. The
 * component decides DOM and behavior; the recipe decides visuals.
 */

import { colors, spacing, radius, shadow, typography, motion } from './tokens';

// ---------------------------------------------------------------------------
// Density — "Breathing" spacing recipes
// ---------------------------------------------------------------------------

/**
 * Density recipe: a ~20% breathing-room shift over the old Discord-like
 * compact layout. Applied at the component level so primitive spacing stays
 * unchanged.
 */
export const density = {
  messageListGap: spacing[4.5],
  composerPadding: spacing[3.5],
  voiceTileGap: spacing[3],
  listItemPaddingY: spacing[2.5],
  listItemPaddingX: spacing[4],
  panelPadding: spacing[5],
  sectionGap: spacing[6],
} as const;

// ---------------------------------------------------------------------------
// Gestures — canonical motion recipes
// ---------------------------------------------------------------------------

/**
 * Three named gestures cover ~95% of UI motion. Components import these
 * rather than authoring their own transition strings.
 *
 * All three respect `prefers-reduced-motion: reduce` — see globals.css.
 */
export const gestures = {
  /** Subtle 1px rise + shadow warm on hover. */
  hoverLift: {
    transition: `transform ${motion.duration.fast} ${motion.easing.gravitas}, box-shadow ${motion.duration.fast} ${motion.easing.gravitas}`,
    rest: { transform: 'translateY(0)', boxShadow: shadow.sm },
    hover: { transform: 'translateY(-1px)', boxShadow: shadow.md },
  },
  /** Panel / sheet entrance: 8px rise + fade. */
  slideIn: {
    transition: `opacity ${motion.duration.normal} ${motion.easing.gravitas}, transform ${motion.duration.normal} ${motion.easing.gravitas}`,
    enter: { opacity: 0, transform: 'translateY(8px)' },
    enterActive: { opacity: 1, transform: 'translateY(0)' },
  },
  /** Active / speaking breathe: gentle 2.5s pulse. */
  breathe: {
    animation: 'breathe 2.5s ease-in-out infinite',
    keyframes:
      '@keyframes breathe { 0%, 100% { transform: scale(1); opacity: 0.65; } 50% { transform: scale(1.06); opacity: 1; } }',
  },
} as const;

// ---------------------------------------------------------------------------
// Focus ring — used everywhere
// ---------------------------------------------------------------------------

/**
 * Single focus ring spec, applied to every focusable element.
 * Two-layer ring (surface color + platinum alpha) stays visible on any background.
 */
export const focusRing = {
  outline: 'none',
  boxShadow: `0 0 0 2px ${colors.surface.base}, 0 0 0 4px ${colors.border.focus}`,
  transition: `box-shadow ${motion.duration.fast} ${motion.easing.gravitas}`,
} as const;

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

/**
 * Grammar rules:
 * - Default size is `md`. `sm` reduces padding one step; `lg` increases one step.
 *   No `xl` or `xs`.
 * - Border radius is always `radius.md` (6px). `radius.full` is reserved for status badges.
 * - Primary uses a platinum→darker-platinum gradient with an inset white highlight
 *   — reads as "metallic" without kitsch.
 */
export const button = {
  primary: {
    background: `linear-gradient(180deg, ${colors.accent.primary}, ${colors.accent.active})`,
    color: colors.text.inverse,
    border: 'none',
    padding: `${spacing[2]} ${spacing[4]}`,
    radius: radius.md,
    shadow:
      '0 1px 0 rgba(255, 255, 255, 0.22) inset, 0 6px 16px rgba(196, 202, 211, 0.14)',
    font: {
      family: typography.fontFamily.sans,
      weight: typography.fontWeight.semibold,
      size: typography.fontSize.sm,
    },
    gesture: gestures.hoverLift,
  },
  secondary: {
    background: colors.surface.elevated,
    color: colors.text.primary,
    border: `1px solid ${colors.border.default}`,
    padding: `${spacing[2]} ${spacing[4]}`,
    radius: radius.md,
    shadow: shadow.none,
    font: {
      family: typography.fontFamily.sans,
      weight: typography.fontWeight.medium,
      size: typography.fontSize.sm,
    },
    gesture: gestures.hoverLift,
  },
  ghost: {
    background: 'transparent',
    color: colors.text.secondary,
    border: 'none',
    padding: `${spacing[2]} ${spacing[3]}`,
    radius: radius.md,
    shadow: shadow.none,
    font: {
      family: typography.fontFamily.sans,
      weight: typography.fontWeight.medium,
      size: typography.fontSize.sm,
    },
    gesture: null,
  },
  danger: {
    background: colors.accent.secondary.default,
    color: colors.text.primary,
    border: `1px solid ${colors.accent.secondary.hover}`,
    padding: `${spacing[2]} ${spacing[4]}`,
    radius: radius.md,
    shadow: shadow.none,
    font: {
      family: typography.fontFamily.sans,
      weight: typography.fontWeight.semibold,
      size: typography.fontSize.sm,
    },
    gesture: gestures.hoverLift,
  },
} as const;

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export const card = {
  raised: {
    background: colors.surface.raised,
    border: `1px solid ${colors.border.subtle}`,
    radius: radius.xl,
    padding: spacing[5],
    shadow: shadow.md,
    gesture: gestures.hoverLift,
  },
  flat: {
    background: colors.surface.elevated,
    border: `1px solid ${colors.border.subtle}`,
    radius: radius.lg,
    padding: spacing[4],
    shadow: shadow.none,
    gesture: null,
  },
  feature: {
    background: `linear-gradient(180deg, ${colors.surface.raised}, ${colors.surface.elevated})`,
    border: `1px solid ${colors.border.default}`,
    radius: radius['2xl'],
    padding: spacing[6],
    shadow: shadow.lg,
    gesture: null,
  },
} as const;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export const input = {
  default: {
    background: colors.surface.elevated,
    border: `1px solid ${colors.border.default}`,
    radius: radius.lg,
    padding: `${spacing[2.5]} ${spacing[3.5]}`,
    color: colors.text.primary,
    placeholder: colors.text.tertiary,
    font: {
      family: typography.fontFamily.sans,
      size: typography.fontSize.base,
    },
    focus: {
      border: `1px solid ${colors.border.focus}`,
      shadow: `0 0 0 4px ${colors.accent.subtle}`,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Overlay — modal, sheet
// ---------------------------------------------------------------------------

export const overlay = {
  backdrop: {
    background: 'rgba(10, 12, 17, 0.72)',
    backdropFilter: 'blur(14px) saturate(1.1)',
    animation: gestures.slideIn,
  },
  panel: {
    background: colors.surface.overlay,
    border: `1px solid ${colors.border.default}`,
    radius: radius['2xl'],
    padding: spacing[6],
    shadow: shadow.xl,
    maxWidth: '520px',
  },
} as const;

// ---------------------------------------------------------------------------
// Root recipe object
// ---------------------------------------------------------------------------

export const recipes = {
  density,
  gestures,
  focusRing,
  button,
  card,
  input,
  overlay,
} as const;

export type Recipes = typeof recipes;
export type Density = typeof density;
export type Gestures = typeof gestures;
export type FocusRing = typeof focusRing;
export type Button = typeof button;
export type Card = typeof card;
export type Input = typeof input;
export type Overlay = typeof overlay;
