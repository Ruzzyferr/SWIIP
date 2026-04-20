/**
 * ConstChat Design Token System — Obsidian Platinum
 *
 * Visual language principles:
 * - Cool blue-slate surface stack. Depth through progressive lightening.
 * - Platinum accent: metallic, desaturated. Used for meaning, not decoration.
 * - Wine secondary reserved for emotional/theatrical moments only.
 * - Thin, platinum-tinted borders to suggest containment without harsh division.
 * - Strong typographic hierarchy via size, weight, and the Fraunces display serif.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const colors = {
  /**
   * Surface scale — cool blue-slate, 5 layers of depth.
   * base: the true page background (darkest)
   * elevated: sidebars, panels sitting above the base
   * raised: cards, list items sitting above panels
   * overlay: modals, sheets that float above raised content
   * floating: tooltips, context menus, dropdowns at the very top
   */
  surface: {
    base: '#0A0C11',
    elevated: '#141820',
    raised: '#1B212C',
    overlay: '#242B39',
    floating: '#2E3646',
  },

  /**
   * Accent — platinum. A desaturated cool grey that reads as quiet precious metal.
   * secondary.* — cool wine, reserved for theatrical or emotionally-weighted moments.
   */
  accent: {
    primary: '#C4CAD3',
    hover: '#DDE2E9',
    active: '#A8AFB8',
    muted: 'rgba(196, 202, 211, 0.14)',
    subtle: 'rgba(196, 202, 211, 0.07)',
    strong: 'rgba(196, 202, 211, 0.22)',
    secondary: {
      default: '#5B1F2A',
      hover: '#6E2632',
      muted: 'rgba(91, 31, 42, 0.32)',
      subtle: 'rgba(91, 31, 42, 0.14)',
    },
  },

  /**
   * Text scale — contrast verified against surface.base (#0A0C11).
   * primary 15.2:1 (AAA), secondary 9.8:1 (AAA), tertiary 5.8:1 (AA), accent 11.1:1 (AAA).
   */
  text: {
    primary: '#E8ECF1',
    secondary: '#B4BAC4',
    tertiary: '#8A92A0',
    disabled: '#454C58',
    inverse: '#141820',
    accent: '#C4CAD3',
  },

  /**
   * Borders — platinum-tinted alpha so hierarchy reads as cool.
   */
  border: {
    subtle: 'rgba(196, 202, 211, 0.05)',
    default: 'rgba(196, 202, 211, 0.09)',
    strong: 'rgba(196, 202, 211, 0.16)',
    focus: 'rgba(196, 202, 211, 0.45)',
  },

  /**
   * Presence / status indicators — saturation reduced ~10% so semantic colors sit inside the cool palette.
   */
  status: {
    online: '#3FA887',
    idle: '#D69A3C',
    dnd: '#C54846',
    offline: '#6C7583',
  },

  /** Destructive actions and error states. */
  danger: {
    default: '#C54846',
    hover: '#B13B39',
    active: '#932F2E',
    muted: 'rgba(197, 72, 70, 0.15)',
    subtle: 'rgba(197, 72, 70, 0.08)',
  },

  /** Positive confirmations and success states. */
  success: {
    default: '#3FA887',
    hover: '#35907A',
    muted: 'rgba(63, 168, 135, 0.12)',
    subtle: 'rgba(63, 168, 135, 0.06)',
  },

  /** Caution and warning states. */
  warning: {
    default: '#D69A3C',
    hover: '#B88430',
    muted: 'rgba(214, 154, 60, 0.15)',
    subtle: 'rgba(214, 154, 60, 0.08)',
  },

  /** @mention highlight in message content. */
  mention: {
    bg: 'rgba(196, 202, 211, 0.10)',
    border: 'rgba(196, 202, 211, 0.35)',
    hover: 'rgba(196, 202, 211, 0.16)',
    text: '#DDE2E9',
  },

  /** Voice channel participant state colors. */
  voice: {
    speaking: '#C4CAD3',
    mutedSpeaking: '#D69A3C',
    deafened: '#C54846',
    disconnected: '#6C7583',
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/**
 * 4 px base grid. Keys mirror Tailwind's scale. 4.5 (18px) is the messaging
 * rhythm step used by the density recipe.
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
  4.5: '18px',
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
    display: "'Fraunces', 'Iowan Old Style', 'Cambria', Georgia, serif",
  },

  fontSize: {
    xs: '11px',
    sm: '13px',
    base: '15px',
    md: '16px',
    lg: '19px',
    xl: '22px',
    '2xl': '26px',
    '3xl': '34px',
    '4xl': '44px',
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
 * Shadows carry depth in a dark UI. The glow variant uses platinum at low
 * alpha — a cold highlight, not a warm bloom.
 */
export const shadow = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.40)',
  md: '0 4px 8px rgba(0, 0, 0, 0.50)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.60)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.70)',
  '2xl': '0 24px 64px rgba(0, 0, 0, 0.80)',
  glow: '0 0 20px rgba(196, 202, 211, 0.22)',
  glowStrong: '0 0 32px rgba(196, 202, 211, 0.38)',
  inset: 'inset 0 1px 3px rgba(0, 0, 0, 0.40)',
} as const;

// ---------------------------------------------------------------------------
// Motion — "Gravitas"
// ---------------------------------------------------------------------------

/**
 * Canonical motion vocabulary: one easing curve (gravitas), three canonical
 * durations for ~95% of gestures. Enters fast, decelerates long, lands deliberately.
 * spring is retained for backcompat but forbidden in new code per foundation spec §6.4.
 */
export const motion = {
  duration: {
    instant: '80ms',
    fast: '180ms',
    normal: '220ms',
    slow: '320ms',
    slower: '480ms',
    slowest: '700ms',
  },
  easing: {
    /** Default for everything — enters fast, decelerates long. */
    gravitas: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    /** Kept for backcompat — prefer gravitas in new code. */
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Elements entering the screen. */
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    /** Elements leaving the screen. */
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    /** Playful overshoot — forbidden in new code under Gravitas. */
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
 * Fixed structural dimensions of the Swiip shell. Breathing-density widths.
 */
export const layout = {
  serverRailWidth: '64px',
  channelSidebarWidth: '260px',
  memberSidebarWidth: '280px',
  bottomBarHeight: '56px',
  titleBarHeight: '48px',
  messageInputMinHeight: '48px',
  messageInputMaxHeight: '50vh',
  threadPanelWidth: '420px',
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
