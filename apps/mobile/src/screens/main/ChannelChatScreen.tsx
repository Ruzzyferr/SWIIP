import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '@/lib/theme';
import type { RouteProp } from '@react-navigation/native';
import type { HomeStackParamList } from '@/navigation/MainTabs';

type Props = {
  route: RouteProp<HomeStackParamList, 'ChannelChat'>;
};

export function ChannelChatScreen({ route }: Props) {
  // TODO: Connect to messages store, gateway bridge, FlashList
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>#{route.params.channelName}</Text>
      <Text style={styles.subtitle}>Mesajlar yüklenecek...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
});
