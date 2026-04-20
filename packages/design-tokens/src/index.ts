/**
 * @constchat/design-tokens
 *
 * The single source of truth for all visual constants in ConstChat.
 * Import from this package in application code and UI components.
 *
 * @example
 * import { tokens, colors, cssVariables } from '@constchat/design-tokens';
 * import { generateCSSVariables } from '@constchat/design-tokens/css';
 */

// Core token objects and types
export {
  tokens,
  colors,
  spacing,
  typography,
  radius,
  shadow,
  motion,
  zIndex,
  layout,
  type Tokens,
  type Colors,
  type Spacing,
  type Typography,
  type Radius,
  type Shadow,
  type Motion,
  type ZIndex,
  type Layout,
} from './tokens';

// CSS variable generation utilities
export { generateCSSVariables, cssVariables } from './css-variables';

// Component grammar recipes (Obsidian Platinum foundation)
export {
  recipes,
  density,
  gestures,
  focusRing,
  button,
  card,
  input,
  overlay,
  type Recipes,
  type Density,
  type Gestures,
  type FocusRing,
  type Button,
  type Card,
  type Input,
  type Overlay,
} from './recipes';
