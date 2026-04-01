import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors } from '@/lib/theme';

type Size = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: Size;
  status?: 'online' | 'idle' | 'dnd' | 'offline';
}

const sizeMap: Record<Size, number> = { sm: 32, md: 40, lg: 56, xl: 80 };
const statusSize: Record<Size, number> = { sm: 10, md: 12, lg: 16, xl: 20 };
const fontSizeMap: Record<Size, number> = { sm: 13, md: 16, lg: 22, xl: 30 };

export function Avatar({ uri, name, size = 'md', status }: AvatarProps) {
  const s = sizeMap[size];
  const initial = name?.charAt(0).toUpperCase() ?? '?';

  return (
    <View style={{ width: s, height: s }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: s, height: s, borderRadius: s / 2 }} />
      ) : (
        <View style={[styles.fallback, { width: s, height: s, borderRadius: s / 2 }]}>
          <Text weight="600" color={colors.accent.primary} style={{ fontSize: fontSizeMap[size] }}>
            {initial}
          </Text>
        </View>
      )}
      {status && (
        <View
          style={[
            styles.statusDot,
            {
              width: statusSize[size],
              height: statusSize[size],
              borderRadius: statusSize[size] / 2,
              backgroundColor: colors.status[status],
              borderWidth: size === 'sm' ? 1.5 : 2,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.accent.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderColor: colors.surface.base,
  },
});
