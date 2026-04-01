import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '@/lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { HomeStackParamList } from '@/navigation/MainTabs';

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'ChannelList'>;
  route: RouteProp<HomeStackParamList, 'ChannelList'>;
};

export function ChannelListScreen({ route }: Props) {
  // TODO: Fetch channels for route.params.guildId from store
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Kanallar yüklenecek...</Text>
      <Text style={styles.guildId}>Guild: {route.params.guildId}</Text>
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
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },
  guildId: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing[2],
  },
});
