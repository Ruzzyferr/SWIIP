'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageItem } from './MessageItem';
import { useMessagesStore } from '@/stores/messages.store';
import { getMessages } from '@/lib/api/messages.api';
import { formatDateSeparator } from '@/lib/utils';
import type { MessagePayload } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Date separator
// ---------------------------------------------------------------------------

function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
      <span
        className="text-xs font-semibold flex-shrink-0 px-2"
        style={{ color: 'var(--color-text-disabled)' }}
      >
        {formatDateSeparator(date)}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function MessageSkeleton({ grouped = false }: { grouped?: boolean }) {
  return (
    <div
      className="flex gap-3 px-4 animate-pulse"
      style={{ paddingTop: grouped ? '2px' : '8px' }}
    >
      <div className="w-10 flex-shrink-0">
        {!grouped && (
          <div
            className="w-10 h-10 rounded-full"
            style={{ background: 'var(--color-surface-raised)' }}
          />
        )}
      </div>
      <div className="flex-1 space-y-1.5 pt-1">
        {!grouped && (
          <div className="flex gap-2 items-center">
            <div
              className="h-3 rounded"
              style={{ width: '80px', background: 'var(--color-surface-raised)' }}
            />
            <div
              className="h-2.5 rounded"
              style={{ width: '60px', background: 'var(--color-surface-raised)' }}
            />
          </div>
        )}
        <div
          className="h-3 rounded"
          style={{
            width: grouped ? '65%' : '80%',
            background: 'var(--color-surface-raised)',
          }}
        />
        {!grouped && (
          <div
            className="h-3 rounded"
            style={{
              width: '45%',
              background: 'var(--color-surface-raised)',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped message detection
// ---------------------------------------------------------------------------

const GROUP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function getAuthorId(msg: MessagePayload): string {
  return msg.author?.id ?? (msg as unknown as { authorId?: string }).authorId ?? '';
}

function getTimestamp(msg: MessagePayload): string {
  return msg.timestamp ?? (msg as unknown as { createdAt?: string }).createdAt ?? '';
}

function isGroupedMessage(prev: MessagePayload | undefined, current: MessagePayload): boolean {
  if (!prev) return false;
  if (getAuthorId(prev) !== getAuthorId(current)) return false;
  const prevTime = new Date(getTimestamp(prev)).getTime();
  const currTime = new Date(getTimestamp(current)).getTime();
  return currTime - prevTime < GROUP_THRESHOLD_MS;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Virtualised list items (messages + separators)
// ---------------------------------------------------------------------------

type ListItem =
  | { kind: 'date'; date: Date; key: string }
  | { kind: 'message'; message: MessagePayload; grouped: boolean; key: string };

function buildListItems(messages: MessagePayload[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDate: Date | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const msgDate = new Date(getTimestamp(msg));

    // Date separator
    if (!lastDate || !isSameDay(lastDate, msgDate)) {
      items.push({ kind: 'date', date: msgDate, key: `date-${msgDate.toDateString()}` });
      lastDate = msgDate;
    }

    const prev = i > 0 ? messages[i - 1] : undefined;
    const grouped = isGroupedMessage(prev, msg);
    items.push({ kind: 'message', message: msg, grouped, key: msg.id });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main MessageList
// ---------------------------------------------------------------------------

interface MessageListProps {
  channelId: string;
  lastReadMessageId?: string | null;
  onReply: (message: MessagePayload) => void;
}

export function MessageList({ channelId, lastReadMessageId, onReply }: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const channelData = useMessagesStore((s) => s.channels[channelId]);
  const setMessages = useMessagesStore((s) => s.setMessages);
  const prependMessages = useMessagesStore((s) => s.prependMessages);
  const setLoading = useMessagesStore((s) => s.setLoading);
  const setHasMore = useMessagesStore((s) => s.setHasMore);

  const messages = channelData?.messages ?? [];
  const loading = channelData?.loading ?? false;
  const hasMore = channelData?.hasMore ?? true;

  // Initial load
  useEffect(() => {
    if (messages.length > 0) return;
    let cancelled = false;

    const load = async () => {
      setLoading(channelId, true);
      try {
        const fetched = await getMessages(channelId, { limit: 50 });
        if (!cancelled) {
          setMessages(channelId, fetched, fetched.length === 50);
        }
      } catch {
        if (!cancelled) setLoading(channelId, false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [channelId]);

  // Load more (older messages)
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest) return;

    setLoading(channelId, true);
    try {
      const older = await getMessages(channelId, {
        before: oldest.id,
        limit: 50,
      });
      prependMessages(channelId, older);
      setHasMore(channelId, older.length === 50);
    } catch {
      setLoading(channelId, false);
    }
  }, [channelId, hasMore, loading, messages]);

  const listItems = buildListItems(messages);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Loading skeleton (initial) */}
      {loading && messages.length === 0 ? (
        <div className="flex flex-col justify-end h-full pb-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <MessageSkeleton key={i} grouped={i % 3 !== 0} />
          ))}
        </div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%' }}
          totalCount={listItems.length}
          initialTopMostItemIndex={listItems.length - 1}
          followOutput="auto"
          atBottomStateChange={(bottom) => {
            setAtBottom(bottom);
            if (bottom) setUnreadCount(0);
          }}
          startReached={loadMore}
          itemContent={(index) => {
            const item = listItems[index];
            if (!item) return null;

            if (item.kind === 'date') {
              return <DateSeparator date={item.date} />;
            }

            // Show unread separator BEFORE the first unread message
            // (i.e., on the message right after the last-read one)
            const prevMessageItem = (() => {
              for (let i = index - 1; i >= 0; i--) {
                const prev = listItems[i];
                if (prev && prev.kind === 'message') return prev;
              }
              return null;
            })();
            const isUnreadSeparator =
              lastReadMessageId != null &&
              prevMessageItem != null &&
              prevMessageItem.kind === 'message' &&
              prevMessageItem.message.id === lastReadMessageId;

            return (
              <MessageItem
                key={item.message.id}
                message={item.message}
                channelId={channelId}
                isGrouped={item.grouped}
                onReply={onReply}
                showUnreadSeparator={isUnreadSeparator}
              />
            );
          }}
          components={{
            Header: () =>
              loading ? (
                <div className="flex justify-center p-3">
                  <div
                    className="w-5 h-5 rounded-full border-2 animate-spin"
                    style={{
                      borderColor: 'var(--color-border-strong)',
                      borderTopColor: 'var(--color-accent-primary)',
                    }}
                  />
                </div>
              ) : hasMore ? (
                <div className="h-4" />
              ) : (
                <div className="flex flex-col items-center py-8 px-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                    style={{ background: 'var(--color-surface-raised)' }}
                  >
                    <span style={{ fontSize: 28 }}>💬</span>
                  </div>
                  <p
                    className="font-semibold text-lg"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Beginning of channel
                  </p>
                  <p
                    className="text-sm mt-1"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    This is the start of the conversation.
                  </p>
                </div>
              ),
          }}
        />
      )}

      {/* Jump to bottom FAB */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            onClick={scrollToBottom}
            className="absolute bottom-6 right-6 flex items-center gap-1.5 px-3 py-2 rounded-full font-medium text-sm shadow-lg"
            style={{
              background: 'var(--color-surface-floating)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-primary)',
              boxShadow: 'var(--shadow-lg)',
            }}
            aria-label="Jump to bottom"
          >
            {unreadCount > 0 && (
              <span
                className="font-semibold text-xs"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                {unreadCount} new
              </span>
            )}
            <ArrowDown size={14} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
