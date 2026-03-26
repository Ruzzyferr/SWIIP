import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface VoiceParticipant {
  userId: string;
  channelId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  serverMute: boolean;
  serverDeaf: boolean;
  speaking: boolean;
}

export type VoiceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface VoiceState {
  // Connection
  connectionState: VoiceConnectionState;
  currentChannelId: string | null;
  currentGuildId: string | null;
  livekitToken: string | null;
  livekitUrl: string | null;

  // Local user controls
  selfMuted: boolean;
  selfDeafened: boolean;

  // All participants in voice channels (keyed by `channelId:userId`)
  participants: Record<string, VoiceParticipant>;

  // Error
  error: string | null;

  // Actions
  setConnectionState: (state: VoiceConnectionState) => void;
  setCurrentChannel: (channelId: string | null, guildId: string | null) => void;
  setLivekitCredentials: (token: string, url: string) => void;
  clearLivekitCredentials: () => void;
  setSelfMuted: (muted: boolean) => void;
  setSelfDeafened: (deafened: boolean) => void;
  setError: (error: string | null) => void;

  // Participant management
  setParticipant: (participant: VoiceParticipant) => void;
  removeParticipant: (channelId: string, userId: string) => void;
  setSpeaking: (channelId: string, userId: string, speaking: boolean) => void;
  clearChannelParticipants: (channelId: string) => void;

  // Selectors
  getChannelParticipants: (channelId: string) => VoiceParticipant[];

  // Full disconnect
  disconnect: () => void;
}

function participantKey(channelId: string, userId: string) {
  return `${channelId}:${userId}`;
}

export const useVoiceStore = create<VoiceState>()(
  immer((set, get) => ({
    connectionState: 'disconnected',
    currentChannelId: null,
    currentGuildId: null,
    livekitToken: null,
    livekitUrl: null,
    selfMuted: false,
    selfDeafened: false,
    participants: {},
    error: null,

    setConnectionState: (connectionState) =>
      set((state) => {
        state.connectionState = connectionState;
      }),

    setCurrentChannel: (channelId, guildId) =>
      set((state) => {
        state.currentChannelId = channelId;
        state.currentGuildId = guildId;
      }),

    setLivekitCredentials: (token, url) =>
      set((state) => {
        state.livekitToken = token;
        state.livekitUrl = url;
      }),

    clearLivekitCredentials: () =>
      set((state) => {
        state.livekitToken = null;
        state.livekitUrl = null;
      }),

    setSelfMuted: (muted) =>
      set((state) => {
        state.selfMuted = muted;
      }),

    setSelfDeafened: (deafened) =>
      set((state) => {
        state.selfDeafened = deafened;
        if (deafened) state.selfMuted = true;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        if (error) state.connectionState = 'error';
      }),

    setParticipant: (participant) =>
      set((state) => {
        const key = participantKey(participant.channelId, participant.userId);
        state.participants[key] = participant;
      }),

    removeParticipant: (channelId, userId) =>
      set((state) => {
        delete state.participants[participantKey(channelId, userId)];
      }),

    setSpeaking: (channelId, userId, speaking) =>
      set((state) => {
        const key = participantKey(channelId, userId);
        if (state.participants[key]) {
          state.participants[key].speaking = speaking;
        }
      }),

    clearChannelParticipants: (channelId) =>
      set((state) => {
        for (const key of Object.keys(state.participants)) {
          if (key.startsWith(`${channelId}:`)) {
            delete state.participants[key];
          }
        }
      }),

    getChannelParticipants: (channelId) => {
      const state = get();
      return Object.values(state.participants).filter(
        (p) => p.channelId === channelId
      );
    },

    disconnect: () =>
      set((state) => {
        state.connectionState = 'disconnected';
        state.currentChannelId = null;
        state.currentGuildId = null;
        state.livekitToken = null;
        state.livekitUrl = null;
        state.selfMuted = false;
        state.selfDeafened = false;
        state.error = null;
      }),
  }))
);
