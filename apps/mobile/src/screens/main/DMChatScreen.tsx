import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '@/lib/theme';
import type { RouteProp } from '@react-navigation/native';
import type { DMStackParamList } from '@/navigation/MainTabs';

type Props = {
  route: RouteProp<DMStackParamList, 'DMChat'>;
};

export function DMChatScreen({ route }: Props) {
  // TODO: Connect to messages store for DM conversation
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>{route.params.recipientName}</Text>
      <Text style={styles.subtitle}>DM mesajları yüklenecek...</Text>
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
  },
});
