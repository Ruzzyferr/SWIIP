import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { MessagePayload } from '@constchat/protocol';

interface ChannelMessages {
  messages: MessagePayload[];
  hasMore: boolean;
  hasNewer: boolean;
  loading: boolean;
  lastReadId: string | null;
  mentionCount: number;
}

interface MessagesState {
  channels: Record<string, ChannelMessages>;

  // Actions
  setMessages: (channelId: string, messages: MessagePayload[], hasMore: boolean, hasNewer?: boolean) => void;
  prependMessages: (channelId: string, messages: MessagePayload[]) => void;
  appendMessages: (channelId: string, messages: MessagePayload[]) => void;
  setHasNewer: (channelId: string, hasNewer: boolean) => void;
  addMessage: (channelId: string, message: MessagePayload) => void;
  updateMessage: (
    channelId: string,
    messageId: string,
    partial: Partial<MessagePayload>
  ) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setLoading: (channelId: string, loading: boolean) => void;
  setHasMore: (channelId: string, hasMore: boolean) => void;
  setLastRead: (channelId: string, messageId: string) => void;
  setMentionCount: (channelId: string, count: number) => void;
  clearChannel: (channelId: string) => void;

  // Selectors
  getChannelMessages: (channelId: string) => MessagePayload[];
  getUnreadCount: (channelId: string) => number;
}

const defaultChannelState = (): ChannelMessages => ({
  messages: [],
  hasMore: true,
  hasNewer: false,
  loading: false,
  lastReadId: null,
  mentionCount: 0,
});

export const useMessagesStore = create<MessagesState>()(
  immer((set, get) => ({
    channels: {},

    setMessages: (channelId, messages, hasMore, hasNewer) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        state.channels[channelId].messages = messages;
        state.channels[channelId].hasMore = hasMore;
        if (hasNewer !== undefined) state.channels[channelId].hasNewer = hasNewer;
        state.channels[channelId].loading = false;
      }),

    prependMessages: (channelId, messages) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        // Deduplicate by id
        const existingIds = new Set(
          state.channels[channelId].messages.map((m) => m.id)
        );
        const newMessages = messages.filter((m) => !existingIds.has(m.id));
        state.channels[channelId].messages = [
          ...newMessages,
          ...state.channels[channelId].messages,
        ];
        state.channels[channelId].loading = false;
      }),

    appendMessages: (channelId, messages) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        const existingIds = new Set(
          state.channels[channelId].messages.map((m) => m.id)
        );
        const newMessages = messages.filter((m) => !existingIds.has(m.id));
        state.channels[channelId].messages = [
          ...state.channels[channelId].messages,
          ...newMessages,
        ];
        state.channels[channelId].loading = false;
      }),

    setHasNewer: (channelId, hasNewer) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        state.channels[channelId].hasNewer = hasNewer;
      }),

    addMessage: (channelId, message) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        const ch = state.channels[channelId];
        // Avoid duplicates — check last few messages (messages arrive in order,
        // so duplicates are almost always near the end)
        const msgs = ch.messages;
        const len = msgs.length;
        let exists = false;
        for (let i = len - 1; i >= Math.max(0, len - 10); i--) {
          if (msgs[i]!.id === message.id) { exists = true; break; }
        }
        if (!exists) {
          msgs.push(message);
        }
      }),

    updateMessage: (channelId, messageId, partial) =>
      set((state) => {
        const ch = state.channels[channelId];
        if (!ch) return;
        const idx = ch.messages.findIndex((m) => m.id === messageId);
        if (idx !== -1 && ch.messages[idx]) {
          Object.assign(ch.messages[idx], partial);
        }
      }),

    removeMessage: (channelId, messageId) =>
      set((state) => {
        const ch = state.channels[channelId];
        if (!ch) return;
        ch.messages = ch.messages.filter((m) => m.id !== messageId);
      }),

    setLoading: (channelId, loading) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        state.channels[channelId].loading = loading;
      }),

    setHasMore: (channelId, hasMore) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        state.channels[channelId].hasMore = hasMore;
      }),

    setLastRead: (channelId, messageId) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        state.channels[channelId].lastReadId = messageId;
        state.channels[channelId].mentionCount = 0;
      }),

    setMentionCount: (channelId, count) =>
      set((state) => {
        if (!state.channels[channelId]) {
          state.channels[channelId] = defaultChannelState();
        }
        state.channels[channelId].mentionCount = count;
      }),

    clearChannel: (channelId) =>
      set((state) => {
        delete state.channels[channelId];
      }),

    getChannelMessages: (channelId) => {
      return get().channels[channelId]?.messages ?? [];
    },

    getUnreadCount: (channelId) => {
      const ch = get().channels[channelId];
      if (!ch || !ch.lastReadId) return 0;
      const lastReadIdx = ch.messages.findIndex((m) => m.id === ch.lastReadId);
      if (lastReadIdx === -1) return 0;
      return ch.messages.length - lastReadIdx - 1;
    },
  }))
);
