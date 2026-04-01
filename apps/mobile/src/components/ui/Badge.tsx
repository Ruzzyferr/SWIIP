import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing, borderRadius, fontSize } from '@/lib/theme';

interface BadgeProps {
  count: number;
  maxCount?: number;
}

export function Badge({ count, maxCount = 99 }: BadgeProps) {
  if (count <= 0) return null;

  const label = count > maxCount ? `${maxCount}+` : `${count}`;

  return (
    <View style={styles.badge}>
      <Text variant="caption" weight="700" color="#fff" style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger.default,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
  },
  text: {
    fontSize: 10,
    lineHeight: 14,
  },
});
