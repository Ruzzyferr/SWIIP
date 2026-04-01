import { colors, typography, radius, motion } from '@constchat/design-tokens';

/**
 * React Native compatible spacing values (numeric, no 'px' suffix).
 */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

/**
 * React Native compatible font sizes (numeric).
 */
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

/**
 * React Native compatible border radius (numeric).
 */
export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

/**
 * React Native compatible motion durations (numeric ms).
 */
export const duration = {
  instant: 80,
  fast: 140,
  normal: 200,
  slow: 300,
  slower: 400,
  slowest: 600,
} as const;

/**
 * Re-export colors and typography weights directly — they are already RN compatible.
 */
export { colors, typography, radius, motion };

export const theme = {
  colors,
  spacing,
  fontSize,
  fontWeight: typography.fontWeight,
  lineHeight: typography.lineHeight,
  borderRadius,
  duration,
} as const;

export type Theme = typeof theme;
