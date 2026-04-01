import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { useGuildsStore } from '@/lib/stores';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '@/navigation/MainTabs';

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'GuildList'>;
};

export function GuildListScreen({ navigation }: Props) {
  const guildsMap = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);

  const guilds = useMemo(() => {
    if (guildOrder.length > 0) {
      return guildOrder.map((id) => guildsMap[id]).filter(Boolean);
    }
    return Object.values(guildsMap);
  }, [guildsMap, guildOrder]);

  return (
    <View style={styles.container}>
      {guilds.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏰</Text>
          <Text style={styles.emptyTitle}>Henüz sunucu yok</Text>
          <Text style={styles.emptySubtitle}>
            Bir sunucuya katıl veya kendi sunucunu oluştur
          </Text>
          <TouchableOpacity style={styles.createButton} activeOpacity={0.8}>
            <Text style={styles.createButtonText}>Sunucu Oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={guilds}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.guildItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ChannelList', { guildId: item.id, guildName: item.name })}
            >
              <View style={styles.guildIcon}>
                <Text style={styles.guildIconText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.guildName}>{item.name}</Text>
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
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
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
    marginBottom: spacing[6],
  },
  createButton: {
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
  },
  createButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  list: {
    padding: spacing[3],
  },
  guildItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: borderRadius.xl,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  guildIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface.raised,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  guildIconText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.accent.primary,
  },
  guildName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
