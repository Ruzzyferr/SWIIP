import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface VoiceParticipant {
  userId: string;
  channelId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  serverMute: boolean;
  serverDeaf: boolean;
  speaking: boolean;
  selfVideo: boolean;
  screenSharing: boolean;
}

export type VoiceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type ScreenShareQuality = '720p30' | '1080p30' | '1080p60';

interface VoiceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  videoDeviceId: string;
  inputVolume: number;   // 0–100
  outputVolume: number;  // 0–100
  notificationSounds: boolean;
  noiseSuppression: boolean;
}

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
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  screenShareQuality: ScreenShareQuality;

  // Pinned participant (spotlight view)
  pinnedParticipantId: string | null;

  // All participants in voice channels (keyed by `channelId:userId`)
  participants: Record<string, VoiceParticipant>;

  // Error
  error: string | null;

  // Device settings (persisted)
  settings: VoiceSettings;

  // Per-user volume overrides (persisted, 0-200, default 100)
  userVolumes: Record<string, number>;

  // Actions
  setConnectionState: (state: VoiceConnectionState) => void;
  setCurrentChannel: (channelId: string | null, guildId: string | null) => void;
  setLivekitCredentials: (token: string, url: string) => void;
  clearLivekitCredentials: () => void;
  setSelfMuted: (muted: boolean) => void;
  setSelfDeafened: (deafened: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  setScreenShareEnabled: (enabled: boolean) => void;
  setScreenShareQuality: (quality: ScreenShareQuality) => void;
  setPinnedParticipant: (userId: string | null) => void;
  setError: (error: string | null) => void;
  updateSettings: (patch: Partial<VoiceSettings>) => void;
  setUserVolume: (userId: string, volume: number) => void;

  // Participant management
  setParticipant: (participant: VoiceParticipant) => void;
  removeParticipant: (channelId: string, userId: string) => void;
  setSpeaking: (channelId: string, userId: string, speaking: boolean) => void;
  setParticipantVideo: (channelId: string, userId: string, selfVideo: boolean) => void;
  setParticipantScreenShare: (channelId: string, userId: string, screenSharing: boolean) => void;
  clearChannelParticipants: (channelId: string) => void;

  // Selectors
  getChannelParticipants: (channelId: string) => VoiceParticipant[];

  // Full disconnect
  disconnect: () => void;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  videoDeviceId: 'default',
  inputVolume: 100,
  outputVolume: 100,
  notificationSounds: true,
  noiseSuppression: true,
};

function participantKey(channelId: string, userId: string) {
  return `${channelId}:${userId}`;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
  immer((set, get) => ({
    connectionState: 'disconnected',
    currentChannelId: null,
    currentGuildId: null,
    livekitToken: null,
    livekitUrl: null,
    selfMuted: false,
    selfDeafened: false,
    cameraEnabled: false,
    screenShareEnabled: false,
    screenShareQuality: '1080p30' as ScreenShareQuality,
    pinnedParticipantId: null,
    participants: {},
    error: null,
    settings: { ...DEFAULT_SETTINGS },
    userVolumes: {},

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

    setCameraEnabled: (enabled) =>
      set((state) => {
        state.cameraEnabled = enabled;
      }),

    setScreenShareEnabled: (enabled) =>
      set((state) => {
        state.screenShareEnabled = enabled;
      }),

    setScreenShareQuality: (quality) =>
      set((state) => {
        state.screenShareQuality = quality;
      }),

    setPinnedParticipant: (userId) =>
      set((state) => {
        state.pinnedParticipantId = state.pinnedParticipantId === userId ? null : userId;
      }),

    updateSettings: (patch) =>
      set((state) => {
        Object.assign(state.settings, patch);
      }),

    setUserVolume: (userId, volume) =>
      set((state) => {
        state.userVolumes[userId] = Math.max(0, Math.min(200, volume));
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

    setParticipantVideo: (channelId, userId, selfVideo) =>
      set((state) => {
        const key = participantKey(channelId, userId);
        if (state.participants[key]) {
          state.participants[key].selfVideo = selfVideo;
        }
      }),

    setParticipantScreenShare: (channelId, userId, screenSharing) =>
      set((state) => {
        const key = participantKey(channelId, userId);
        if (state.participants[key]) {
          state.participants[key].screenSharing = screenSharing;
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
        state.cameraEnabled = false;
        state.screenShareEnabled = false;
        state.pinnedParticipantId = null;
        state.participants = {};
        state.error = null;
      }),
  })),
  {
    name: 'voice-settings',
    partialize: (state) => ({ settings: state.settings, userVolumes: state.userVolumes }),
  })
);
