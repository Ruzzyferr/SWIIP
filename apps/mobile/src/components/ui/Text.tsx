import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';
import { colors, fontSize } from '@/lib/theme';

type Variant = 'heading' | 'title' | 'body' | 'label' | 'caption' | 'overline';

interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  weight?: '400' | '500' | '600' | '700' | '800';
  align?: 'left' | 'center' | 'right';
}

const variantStyles: Record<Variant, { fontSize: number; fontWeight: string; color: string; letterSpacing?: number }> = {
  heading: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.text.primary },
  title: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary },
  body: { fontSize: fontSize.base, fontWeight: '400', color: colors.text.primary },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text.secondary },
  caption: { fontSize: fontSize.xs, fontWeight: '400', color: colors.text.tertiary },
  overline: { fontSize: fontSize.xs, fontWeight: '700', color: colors.text.secondary, letterSpacing: 0.5 },
};

export function Text({ variant = 'body', color, weight, align, style, ...props }: TextProps) {
  const v = variantStyles[variant];
  return (
    <RNText
      style={[
        { fontSize: v.fontSize, fontWeight: (weight ?? v.fontWeight) as any, color: color ?? v.color, letterSpacing: v.letterSpacing },
        align && { textAlign: align },
        style,
      ]}
      {...props}
    />
  );
}
