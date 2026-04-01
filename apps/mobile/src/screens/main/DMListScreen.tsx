import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { useDMsStore, useAuthStore } from '@/lib/stores';
import { Avatar } from '@/components/ui';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DMStackParamList } from '@/navigation/MainTabs';

type Props = {
  navigation: NativeStackNavigationProp<DMStackParamList, 'DMList'>;
};

export function DMListScreen({ navigation }: Props) {
  const conversations = useDMsStore((s) => s.conversations);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const dmList = useMemo(() => {
    return Object.values(conversations).map((dm) => {
      const recipient = dm.recipients.find((r) => r.id !== currentUserId) ?? dm.recipients[0];
      const name = dm.name ?? recipient?.globalName ?? recipient?.username ?? 'Unknown';
      return { ...dm, recipientName: name, recipient };
    });
  }, [conversations, currentUserId]);

  return (
    <View style={styles.container}>
      {dmList.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
          <Text style={styles.emptySubtitle}>
            Arkadaşlarınla sohbet etmeye başla
          </Text>
        </View>
      ) : (
        <FlatList
          data={dmList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dmItem}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('DMChat', {
                  conversationId: item.id,
                  recipientName: item.recipientName,
                })
              }
            >
              <Avatar
                name={item.recipientName}
                uri={item.recipient?.avatar}
                size="md"
              />
              <View style={styles.dmInfo}>
                <Text style={styles.dmName} numberOfLines={1}>
                  {item.recipientName}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  list: {
    padding: spacing[2],
  },
  dmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  dmInfo: {
    flex: 1,
    marginLeft: spacing[3],
  },
  dmName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
