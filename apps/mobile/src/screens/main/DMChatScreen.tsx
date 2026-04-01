import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { useMessagesStore } from '@/lib/stores';
import { apiClient } from '@/lib/api';
import type { RouteProp } from '@react-navigation/native';
import type { DMStackParamList } from '@/navigation/MainTabs';
import type { MessagePayload } from '@constchat/protocol';

type Props = {
  route: RouteProp<DMStackParamList, 'DMChat'>;
};

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Bugün ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Dün ${time}`;
  return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${time}`;
}

function shouldShowHeader(messages: MessagePayload[], index: number): boolean {
  if (index === messages.length - 1) return true;
  const current = messages[index];
  const prev = messages[index + 1];
  if (current.author.id !== prev.author.id) return true;
  const diff = new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime();
  return diff > 5 * 60 * 1000;
}

function MessageItem({ message, showHeader }: { message: MessagePayload; showHeader: boolean }) {
  const displayName = message.author.globalName ?? message.author.username;

  if (!showHeader) {
    return (
      <View style={styles.messageCompact}>
        <Text variant="body" style={styles.messageContent}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={styles.messageItem}>
      <Avatar name={displayName} uri={message.author.avatar} size="sm" />
      <View style={styles.messageBody}>
        <View style={styles.messageHeader}>
          <Text weight="600" style={styles.authorName}>{displayName}</Text>
          <Text variant="caption" color={colors.text.tertiary} style={styles.timestamp}>
            {formatTime(message.timestamp)}
          </Text>
        </View>
        <Text variant="body" style={styles.messageContent}>{message.content}</Text>
      </View>
    </View>
  );
}

export function DMChatScreen({ route }: Props) {
  const { conversationId, recipientName } = route.params;
  const messages = useMessagesStore((s) => s.channels[conversationId]?.messages ?? []);
  const hasMore = useMessagesStore((s) => s.channels[conversationId]?.hasMore ?? true);
  const loading = useMessagesStore((s) => s.channels[conversationId]?.loading ?? false);
  const setMessages = useMessagesStore((s) => s.setMessages);
  const prependMessages = useMessagesStore((s) => s.prependMessages);
  const setLoading = useMessagesStore((s) => s.setLoading);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (messages.length > 0) return;
    (async () => {
      setLoading(conversationId, true);
      try {
        const { data } = await apiClient.get(`/channels/${conversationId}/messages`, {
          params: { limit: 50 },
        });
        setMessages(conversationId, data, data.length === 50);
      } catch (err) {
        console.error('[DM] Failed to load messages:', err);
      }
      setLoading(conversationId, false);
    })();
  }, [conversationId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || messages.length === 0) return;
    setLoading(conversationId, true);
    try {
      const oldest = messages[messages.length - 1];
      const { data } = await apiClient.get(`/channels/${conversationId}/messages`, {
        params: { before: oldest.id, limit: 50 },
      });
      prependMessages(conversationId, data);
      if (data.length < 50) {
        useMessagesStore.getState().setHasMore(conversationId, false);
      }
    } catch (err) {
      console.error('[DM] Failed to load more:', err);
    }
    setLoading(conversationId, false);
  }, [conversationId, hasMore, loading, messages]);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      await apiClient.post(`/channels/${conversationId}/messages`, { content });
    } catch (err) {
      console.error('[DM] Failed to send:', err);
      setText(content);
    }
    setSending(false);
  }, [conversationId, text, sending]);

  const renderItem = useCallback(({ item, index }: { item: MessagePayload; index: number }) => {
    const showHeader = shouldShowHeader(messages, index);
    return <MessageItem message={item} showHeader={showHeader} />;
  }, [messages]);

  if (loading && messages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlashList
        data={messages}
        renderItem={renderItem}
        estimatedItemSize={60}
        keyExtractor={(item) => item.id}
        inverted
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.text.tertiary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text variant="heading" color={colors.text.secondary}>
              {recipientName}
            </Text>
            <Text variant="body" color={colors.text.tertiary}>
              Sohbetin başlangıcı
            </Text>
          </View>
        }
      />

      <View style={styles.composer}>
        <TextInput
          ref={inputRef}
          style={styles.composerInput}
          value={text}
          onChangeText={setText}
          placeholder={`${recipientName} kişisine mesaj gönder`}
          placeholderTextColor={colors.text.tertiary}
          multiline
          maxLength={2000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text weight="700" color={text.trim() ? colors.text.inverse : colors.text.tertiary}>
              ➤
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  messageItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  messageCompact: {
    paddingHorizontal: spacing[4],
    paddingLeft: spacing[4] + 32 + spacing[2.5],
    paddingVertical: spacing[0.5],
  },
  messageBody: {
    flex: 1,
    marginLeft: spacing[2.5],
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing[0.5],
  },
  authorName: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    marginRight: spacing[2],
  },
  timestamp: {
    fontSize: 11,
  },
  messageContent: {
    color: colors.text.primary,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.4,
  },
  loadingMore: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[16],
    transform: [{ scaleY: -1 }],
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.surface.elevated,
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surface.raised,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    fontSize: fontSize.base,
    color: colors.text.primary,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing[2],
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface.raised,
  },
});
