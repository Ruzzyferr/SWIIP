import React from 'react';
import { View } from 'react-native';
import { colors, spacing } from '@/lib/theme';

interface DividerProps {
  spacing?: number;
}

export function Divider({ spacing: gap = spacing[0] }: DividerProps) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border.subtle,
        marginVertical: gap,
      }}
    />
  );
}
