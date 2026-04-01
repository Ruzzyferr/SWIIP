import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Text } from './Text';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
}

const variantConfig: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.accent.primary, text: colors.text.inverse },
  secondary: { bg: colors.surface.raised, text: colors.text.primary, border: colors.border.default },
  danger: { bg: colors.danger.muted, text: colors.danger.default, border: colors.danger.default },
  ghost: { bg: 'transparent', text: colors.text.secondary },
};

const sizeConfig: Record<string, { py: number; px: number; fs: number }> = {
  sm: { py: spacing[1.5], px: spacing[3], fs: fontSize.sm },
  md: { py: spacing[3], px: spacing[5], fs: fontSize.base },
  lg: { py: spacing[3.5], px: spacing[6], fs: fontSize.md },
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style, size = 'md' }: ButtonProps) {
  const v = variantConfig[variant];
  const s = sizeConfig[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        {
          backgroundColor: v.bg,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          borderRadius: borderRadius.lg,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          flexDirection: 'row' as const,
        },
        v.border && { borderWidth: 1, borderColor: v.border },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text variant="body" weight="600" color={v.text} style={{ fontSize: s.fs }}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
