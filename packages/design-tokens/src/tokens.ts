/**
 * ConstChat Design Token System
 *
 * Visual language principles:
 * - Layered dark surfaces, never flat black — depth is created through subtle
 *   elevation steps, not shadows alone.
 * - Controlled blur and translucency for overlays and floating elements.
 * - Thin, low-opacity borders to suggest containment without harsh division.
 * - Emerald accent that reads as intentional, not aggressive.
 * - Strong typographic hierarchy through size and weight, not color noise.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  /**
   * Surface scale — each step is a distinct "layer" in the UI stack.
   * base: the true page background (darkest)
   * elevated: sidebars, panels sitting above the base
   * raised: cards, list items sitting above panels
   * overlay: modals, sheets that float above raised content
   * floating: tooltips, context menus, dropdowns at the very top
   */
  surface: {
    base: '#090B0B',
    elevated: '#121616',
    raised: '#181E1D',
    overlay: '#202827',
    floating: '#2B3533',
  },

  /**
   * Accent — emerald green, balanced for dark surfaces.
   */
  accent: {
    primary: '#10B981',
    hover: '#059669',
    active: '#047857',
    muted: 'rgba(52, 211, 153, 0.16)',
    subtle: 'rgba(52, 211, 153, 0.08)',
    strong: 'rgba(52, 211, 153, 0.25)',
  },

  /**
   * Text scale — primary for body copy, secondary for supporting text,
   * tertiary for placeholders and hints, disabled for non-interactive labels.
   */
  text: {
    primary: '#F5F7F6',
    secondary: '#B7C3BF',
    tertiary: '#788682',
    disabled: '#3D4A46',
    inverse: '#090B0B',
    accent: '#34D399',
  },

  /**
   * Borders — all alpha-based so they adapt to any surface color.
   */
  border: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    default: 'rgba(255, 255, 255, 0.07)',
    strong: 'rgba(255, 255, 255, 0.12)',
    focus: 'rgba(16, 185, 129, 0.50)',
  },

  /**
   * Presence / status indicators.
   */
  status: {
    online: '#10B981',
    idle: '#F59E0B',
    dnd: '#EF4444',
    offline: '#788682',
  },

  /** Destructive actions and error states. */
  danger: {
    default: '#ef4444',
    hover: '#dc2626',
    active: '#b91c1c',
    muted: 'rgba(239, 68, 68, 0.15)',
    subtle: 'rgba(239, 68, 68, 0.08)',
  },

  /** Positive confirmations and success states. */
  success: {
    default: '#10B981',
    hover: '#059669',
    muted: 'rgba(16, 185, 129, 0.12)',
    subtle: 'rgba(16, 185, 129, 0.06)',
  },

  /** Caution and warning states. */
  warning: {
    default: '#f59e0b',
    hover: '#d97706',
    muted: 'rgba(245, 158, 11, 0.15)',
    subtle: 'rgba(245, 158, 11, 0.08)',
  },

  /** @mention highlight in message content. */
  mention: {
    bg: 'rgba(16, 185, 129, 0.10)',
    border: 'rgba(16, 185, 129, 0.35)',
    hover: 'rgba(16, 185, 129, 0.16)',
    text: '#34D399',
  },

  /** Voice channel participant state colors. */
  voice: {
    speaking: '#10B981',
    mutedSpeaking: '#f59e0b',
    deafened: '#ef4444',
    disconnected: '#788682',
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/**
 * 4 px base grid. Keys mirror Tailwind's scale so designers and engineers
 * share the same vocabulary.
 */
export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  fontFamily: {
    sans: "'Inter', 'system-ui', -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    display: "'Cal Sans', 'Inter', 'system-ui', sans-serif",
  },

  fontSize: {
    xs: '11px',
    sm: '13px',
    base: '15px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeight: {
    none: 1,
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: '-0.04em',
    tight: '-0.02em',
    normal: '0em',
    wide: '0.04em',
    wider: '0.08em',
    widest: '0.16em',
  },
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const radius = {
  none: '0px',
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px',
} as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

/**
 * Shadows are heavier than typical light-mode shadows because dark UI needs
 * more contrast to read as depth. The glow variant is for accent-colored
 * focus rings and highlights.
 */
export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.40)',
  md: '0 4px 8px rgba(0, 0, 0, 0.50)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.60)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.70)',
  '2xl': '0 24px 64px rgba(0, 0, 0, 0.80)',
  glow: '0 0 20px rgba(16, 185, 129, 0.30)',
  glowStrong: '0 0 32px rgba(16, 185, 129, 0.50)',
  inset: 'inset 0 1px 3px rgba(0, 0, 0, 0.40)',
} as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/**
 * Duration and easing pairings designed for UI animation:
 * - instant/fast: micro-interactions (button press, toggle)
 * - normal: panel transitions, accordions
 * - slow/slower: page transitions, modal entrances
 * - spring: playful bounce for confirmations and delight moments
 */
export const motion = {
  duration: {
    instant: '80ms',
    fast: '140ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '600ms',
  },
  easing: {
    /** General-purpose: accelerates then decelerates. */
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Elements entering the screen. */
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    /** Elements leaving the screen. */
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    /** Playful overshoot — use sparingly for delight. */
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    /** Perfectly linear — for things like progress bars. */
    linear: 'linear',
  },
} as const;

// ---------------------------------------------------------------------------
// Z-Index
// ---------------------------------------------------------------------------

/**
 * Named stacking layers. Each layer is spaced by 10 to allow local stacking
 * within a layer without leaking into the next.
 */
export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700,
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Fixed structural dimensions of the ConstChat shell. These should be treated
 * as constants — not to be overridden by component styles.
 */
export const layout = {
  serverRailWidth: '64px',
  channelSidebarWidth: '240px',
  memberSidebarWidth: '260px',
  bottomBarHeight: '52px',
  titleBarHeight: '48px',
  messageInputMinHeight: '44px',
  messageInputMaxHeight: '50vh',
  threadPanelWidth: '400px',
} as const;

// ---------------------------------------------------------------------------
// Root token object
// ---------------------------------------------------------------------------

export const tokens = {
  colors,
  spacing,
  typography,
  radius,
  shadow,
  motion,
  zIndex,
  layout,
} as const;

export type Tokens = typeof tokens;

// Individual group types
export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Typography = typeof typography;
export type Radius = typeof radius;
export type Shadow = typeof shadow;
export type Motion = typeof motion;
export type ZIndex = typeof zIndex;
export type Layout = typeof layout;
