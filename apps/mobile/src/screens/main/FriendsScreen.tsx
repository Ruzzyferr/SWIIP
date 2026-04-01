import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { StatusDot } from '@/components/ui/StatusDot';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { useFriendsStore, usePresenceStore } from '@/lib/stores';
import { apiClient } from '@/lib/api';
import type { RelationshipPayload } from '@constchat/shared';

type Tab = 'all' | 'online' | 'pending';

export function FriendsScreen() {
  const relationships = useFriendsStore((s) => s.relationships);
  const isLoaded = useFriendsStore((s) => s.isLoaded);
  const setRelationships = useFriendsStore((s) => s.setRelationships);
  const [tab, setTab] = useState<Tab>('online');
  const [loading, setLoading] = useState(false);

  // Fetch friends list if not loaded via gateway
  useEffect(() => {
    if (isLoaded) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get('/users/@me/relationships');
        setRelationships(data);
      } catch (err) {
        console.error('[Friends] Failed to load:', err);
      }
      setLoading(false);
    })();
  }, [isLoaded]);

  const friends = useMemo(() => relationships.filter((r) => r.type === 'FRIEND'), [relationships]);
  const pending = useMemo(
    () => relationships.filter((r) => r.type === 'PENDING_INCOMING' || r.type === 'PENDING_OUTGOING'),
    [relationships],
  );

  const filtered = useMemo(() => {
    switch (tab) {
      case 'online': {
        const presences = usePresenceStore.getState();
        return friends.filter((r) => {
          const p = presences.users[r.user.id];
          return p?.status && p.status !== 'offline';
        });
      }
      case 'pending':
        return pending;
      default:
        return friends;
    }
  }, [tab, friends, pending]);

  const renderItem = ({ item }: { item: RelationshipPayload }) => {
    const name = item.user.globalName ?? item.user.username;
    const presence = usePresenceStore.getState().users[item.user.id];
    const status = (presence?.status ?? 'offline') as 'online' | 'idle' | 'dnd' | 'offline';

    return (
      <View style={styles.friendItem}>
        <Avatar name={name} uri={item.user.avatar} size="md" status={status} />
        <View style={styles.friendInfo}>
          <Text weight="600" style={styles.friendName}>{name}</Text>
          <Text variant="caption" color={colors.text.tertiary}>
            {item.type === 'PENDING_INCOMING'
              ? 'Arkadaşlık isteği gönderdi'
              : item.type === 'PENDING_OUTGOING'
                ? 'İstek gönderildi'
                : presence?.status ?? 'Çevrimdışı'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        {(['online', 'all', 'pending'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text
              weight={tab === t ? '600' : '400'}
              color={tab === t ? colors.text.primary : colors.text.tertiary}
              style={styles.tabText}
            >
              {t === 'online' ? 'Çevrimiçi' : t === 'all' ? 'Tümü' : 'Bekleyen'}
              {t === 'pending' && pending.length > 0 ? ` (${pending.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="body" color={colors.text.tertiary}>
              {tab === 'online'
                ? 'Çevrimiçi arkadaş yok'
                : tab === 'pending'
                  ? 'Bekleyen istek yok'
                  : 'Henüz arkadaş yok'}
            </Text>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.surface.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tab: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    marginRight: spacing[1],
  },
  tabActive: {
    backgroundColor: colors.surface.raised,
  },
  tabText: {
    fontSize: fontSize.sm,
  },
  list: {
    padding: spacing[2],
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  friendInfo: {
    flex: 1,
    marginLeft: spacing[3],
  },
  friendName: {
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  empty: {
    paddingTop: spacing[16],
    alignItems: 'center',
  },
});
