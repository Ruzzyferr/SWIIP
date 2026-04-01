import React from 'react';
import { View, type ViewProps, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '@/lib/theme';

type Level = 'base' | 'elevated' | 'raised' | 'overlay' | 'floating';

interface SurfaceProps extends ViewProps {
  level?: Level;
  rounded?: boolean;
  bordered?: boolean;
  padded?: boolean;
}

export function Surface({ level = 'elevated', rounded = true, bordered = true, padded, style, ...props }: SurfaceProps) {
  return (
    <View
      style={[
        { backgroundColor: colors.surface[level] },
        rounded && { borderRadius: borderRadius.xl },
        bordered && { borderWidth: 1, borderColor: colors.border.subtle },
        padded && { padding: spacing[4] },
        style,
      ]}
      {...props}
    />
  );
}
