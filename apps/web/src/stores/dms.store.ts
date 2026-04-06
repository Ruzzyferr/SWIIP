import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DMChannelPayload } from '@constchat/protocol';

interface DMsState {
  conversations: Record<string, DMChannelPayload>;
  /** Tracks the last message read by the other participant(s) in each DM. */
  recipientReadState: Record<string, string>; // dmId -> lastReadMessageId
  isLoaded: boolean;

  // Actions
  setConversations: (dms: DMChannelPayload[]) => void;
  addConversation: (dm: DMChannelPayload) => void;
  removeConversation: (dmId: string) => void;
  updateConversation: (dmId: string, partial: Partial<DMChannelPayload>) => void;
  setRecipientRead: (dmId: string, messageId: string) => void;
}

export const useDMsStore = create<DMsState>()(
  immer((set) => ({
    conversations: {},
    recipientReadState: {},
    isLoaded: false,

    setConversations: (dms) =>
      set((state) => {
        state.conversations = {};
        for (const dm of dms) {
          state.conversations[dm.id] = dm;
        }
        state.isLoaded = true;
      }),

    addConversation: (dm) =>
      set((state) => {
        state.conversations[dm.id] = dm;
      }),

    removeConversation: (dmId) =>
      set((state) => {
        delete state.conversations[dmId];
      }),

    updateConversation: (dmId, partial) =>
      set((state) => {
        const existing = state.conversations[dmId];
        if (existing) {
          Object.assign(existing, partial);
        }
      }),

    setRecipientRead: (dmId, messageId) =>
      set((state) => {
        state.recipientReadState[dmId] = messageId;
      }),
  }))
);
