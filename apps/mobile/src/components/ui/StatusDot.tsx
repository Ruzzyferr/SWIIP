import React from 'react';
import { View } from 'react-native';
import { colors } from '@/lib/theme';

type Status = 'online' | 'idle' | 'dnd' | 'offline';

interface StatusDotProps {
  status: Status;
  size?: number;
}

export function StatusDot({ status, size = 10 }: StatusDotProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.status[status],
      }}
    />
  );
}
