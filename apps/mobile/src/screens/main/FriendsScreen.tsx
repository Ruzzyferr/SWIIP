import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '@/lib/theme';

export function FriendsScreen() {
  // TODO: Connect to friends store
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Arkadaş listesi yüklenecek...</Text>
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
});
