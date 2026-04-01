import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { useGuildsStore } from '@/lib/stores';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { HomeStackParamList } from '@/navigation/MainTabs';
import type { ChannelPayload } from '@constchat/protocol';

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'ChannelList'>;
  route: RouteProp<HomeStackParamList, 'ChannelList'>;
};

export function ChannelListScreen({ navigation, route }: Props) {
  const { guildId } = route.params;
  const channels = useGuildsStore((s) => s.channels);
  const guild = useGuildsStore((s) => s.guilds[guildId]);

  const sections = useMemo(() => {
    const guildChannels = Object.values(channels).filter(
      (ch) => ch.guildId === guildId
    );

    // Group by category
    const categories = guildChannels.filter((ch) => ch.type === 'CATEGORY');
    const uncategorized = guildChannels.filter(
      (ch) => ch.type !== 'CATEGORY' && !ch.parentId
    );

    const result: { title: string; data: ChannelPayload[] }[] = [];

    if (uncategorized.length > 0) {
      result.push({
        title: '',
        data: uncategorized.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      });
    }

    for (const cat of categories.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      const children = guildChannels
        .filter((ch) => ch.parentId === cat.id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      result.push({ title: cat.name, data: children });
    }

    return result;
  }, [channels, guildId]);

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'VOICE': return '🔊';
      case 'ANNOUNCEMENT': return '📢';
      default: return '#';
    }
  };

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) =>
          title ? (
            <Text style={styles.categoryTitle}>{title.toUpperCase()}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.channelItem}
            activeOpacity={0.7}
            onPress={() => {
              if (item.type === 'TEXT' || item.type === 'ANNOUNCEMENT') {
                navigation.navigate('ChannelChat', {
                  channelId: item.id,
                  channelName: item.name,
                });
              }
            }}
          >
            <Text style={styles.channelIcon}>{getChannelIcon(item.type)}</Text>
            <Text style={styles.channelName}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Henüz kanal yok</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  list: {
    padding: spacing[2],
  },
  categoryTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[4],
    paddingBottom: spacing[1],
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.md,
  },
  channelIcon: {
    fontSize: fontSize.md,
    color: colors.text.tertiary,
    width: 24,
    textAlign: 'center',
    marginRight: spacing[2],
  },
  channelName: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing[16],
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.text.tertiary,
  },
});
