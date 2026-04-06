import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PresenceStatus, ActivityPayload } from '@constchat/protocol';

interface UserPresence {
  status: PresenceStatus;
  customStatus?: string;
  customStatusEmoji?: string;
  customStatusExpiresAt?: string;
  activities?: ActivityPayload[];
}

interface PresenceState {
  users: Record<string, UserPresence>;
  // channelId → userId → timestamp (ms)
  typing: Record<string, Record<string, number>>;

  // Actions
  setPresence: (userId: string, presence: UserPresence) => void;
  setPresences: (presences: Array<{ userId: string } & UserPresence>) => void;
  removePresence: (userId: string) => void;
  setTyping: (channelId: string, userId: string, timestamp?: number) => void;
  clearTyping: (channelId: string, userId: string) => void;
  clearChannelTyping: (channelId: string) => void;
  pruneStaleTyping: () => void;

  // Selectors
  getPresence: (userId: string) => PresenceStatus;
  getTypingUsers: (channelId: string) => string[];
}

const TYPING_TIMEOUT_MS = 8000;

export const usePresenceStore = create<PresenceState>()(
  immer((set, get) => ({
    users: {},
    typing: {},

    setPresence: (userId, presence) =>
      set((state) => {
        state.users[userId] = presence;
      }),

    setPresences: (presences) =>
      set((state) => {
        for (const p of presences) {
          const { userId, ...rest } = p;
          state.users[userId] = rest;
        }
      }),

    removePresence: (userId) =>
      set((state) => {
        delete state.users[userId];
      }),

    setTyping: (channelId, userId, timestamp) =>
      set((state) => {
        if (!state.typing[channelId]) {
          state.typing[channelId] = {};
        }
        state.typing[channelId][userId] = timestamp ?? Date.now();
      }),

    clearTyping: (channelId, userId) =>
      set((state) => {
        if (state.typing[channelId]) {
          delete state.typing[channelId][userId];
        }
      }),

    clearChannelTyping: (channelId) =>
      set((state) => {
        delete state.typing[channelId];
      }),

    pruneStaleTyping: () =>
      set((state) => {
        const cutoff = Date.now() - TYPING_TIMEOUT_MS;
        for (const channelId of Object.keys(state.typing)) {
          const channelTyping = state.typing[channelId];
          if (!channelTyping) continue;
          for (const userId of Object.keys(channelTyping)) {
            if (channelTyping[userId]! < cutoff) {
              delete channelTyping[userId];
            }
          }
        }
      }),

    getPresence: (userId) => {
      return get().users[userId]?.status ?? 'offline';
    },

    getTypingUsers: (channelId) => {
      const typing = get().typing[channelId];
      if (!typing) return [];
      const cutoff = Date.now() - TYPING_TIMEOUT_MS;
      return Object.entries(typing)
        .filter(([, ts]) => ts > cutoff)
        .map(([userId]) => userId);
    },
  }))
);
