import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { type AudioPipelineUIState, createDefaultPipelineUIState } from '@/lib/audio/types';

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

/** Audio processing mode — only one noise processing layer active at a time. */
export type AudioMode = 'standard' | 'enhanced' | 'raw';

export interface AudioCapabilities {
  enhancedAvailable: boolean;
  enhancedChecked: boolean;
}

interface VoiceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  videoDeviceId: string;
  inputVolume: number;   // 0–100
  outputVolume: number;  // 0–100
  notificationSounds: boolean;
  /** Audio processing profile: standard (browser NS), enhanced (RNNoise), raw (no processing). */
  audioMode: AudioMode;
  /** Voice activity detection threshold (0=most sensitive, 100=least sensitive). -1 = automatic. */
  voiceActivityThreshold: number;
  /** Push-to-talk mode enabled */
  pushToTalk: boolean;
  /** Key to hold for push-to-talk (default: Space) */
  pttKey: string;
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
  /** Was the user manually muted before deafening? Used to restore mute state on un-deafen (Discord behavior). */
  _mutedBeforeDeafen: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  screenShareQuality: ScreenShareQuality;
  screenShareAudio: boolean;

  // Pinned participant (spotlight view)
  pinnedParticipantId: string | null;

  // All participants in voice channels (keyed by `channelId:userId`)
  participants: Record<string, VoiceParticipant>;

  // Connection quality (0=LOST, 1=POOR, 2=GOOD, 3=EXCELLENT)
  connectionQuality: number;

  // Auto-disconnect timer (seconds remaining, null = not counting)
  aloneTimeout: number | null;

  // Error
  error: string | null;

  // Device settings (persisted)
  settings: VoiceSettings;

  // Per-user volume overrides (persisted, 0-100, default 100)
  userVolumes: Record<string, number>;

  // Per-stream volume overrides (persisted, 0-100, default 100) — separate from userVolumes
  streamVolumes: Record<string, number>;

  // Which streams the local user is watching (userId → boolean, default true = auto-watch)
  watchingStreams: Record<string, boolean>;

  // Audio pipeline state (non-persisted)
  audioCapabilities: AudioCapabilities;
  effectiveAudioMode: AudioMode;
  audioReconfigureRequired: boolean;

  /** Full pipeline UI state — replaces simple booleans with honest state model */
  pipelineUIState: AudioPipelineUIState;

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
  setScreenShareAudio: (enabled: boolean) => void;
  setPinnedParticipant: (userId: string | null) => void;
  setConnectionQuality: (quality: number) => void;
  setAloneTimeout: (seconds: number | null) => void;
  setError: (error: string | null) => void;
  updateSettings: (patch: Partial<VoiceSettings>) => void;
  setUserVolume: (userId: string, volume: number) => void;
  setStreamVolume: (userId: string, volume: number) => void;
  setWatchingStream: (userId: string, watching: boolean) => void;
  clearStreamState: (userId: string) => void;
  setAudioCapabilities: (patch: Partial<AudioCapabilities>) => void;
  setEffectiveAudioMode: (mode: AudioMode) => void;
  setAudioReconfigureRequired: (required: boolean) => void;
  setPipelineUIState: (state: AudioPipelineUIState) => void;
  patchPipelineUIState: (patch: Partial<AudioPipelineUIState>) => void;

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
  audioMode: 'standard',
  voiceActivityThreshold: -1, // -1 = automatic
  pushToTalk: false,
  pttKey: 'Space',
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
    _mutedBeforeDeafen: false,
    cameraEnabled: false,
    screenShareEnabled: false,
    screenShareQuality: '1080p30' as ScreenShareQuality,
    screenShareAudio: false,
    pinnedParticipantId: null,
    participants: {},
    connectionQuality: 3,
    aloneTimeout: null,
    error: null,
    settings: { ...DEFAULT_SETTINGS },
    userVolumes: {},
    streamVolumes: {},
    watchingStreams: {},
    audioCapabilities: { enhancedAvailable: false, enhancedChecked: false },
    effectiveAudioMode: 'standard',
    audioReconfigureRequired: false,
    pipelineUIState: createDefaultPipelineUIState('browser', 'standard'),

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
        if (deafened) {
          // Save mute state before deafening — restore on un-deafen (Discord behavior)
          state._mutedBeforeDeafen = state.selfMuted;
          state.selfMuted = true;
        } else {
          // Restore previous mute state: if user was manually muted before deafening, stay muted
          state.selfMuted = state._mutedBeforeDeafen;
        }
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

    setScreenShareAudio: (enabled) =>
      set((state) => {
        state.screenShareAudio = enabled;
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
        state.userVolumes[userId] = Math.max(0, Math.min(100, volume));
      }),

    setStreamVolume: (userId, volume) =>
      set((state) => {
        state.streamVolumes[userId] = Math.max(0, Math.min(100, volume));
      }),

    setWatchingStream: (userId, watching) =>
      set((state) => {
        state.watchingStreams[userId] = watching;
      }),

    clearStreamState: (userId) =>
      set((state) => {
        delete state.watchingStreams[userId];
      }),

    setAudioCapabilities: (patch) =>
      set((state) => {
        Object.assign(state.audioCapabilities, patch);
      }),

    setEffectiveAudioMode: (mode) =>
      set((state) => {
        state.effectiveAudioMode = mode;
      }),

    setAudioReconfigureRequired: (required) =>
      set((state) => {
        state.audioReconfigureRequired = required;
      }),

    setPipelineUIState: (uiState) =>
      set((state) => {
        state.pipelineUIState = uiState;
      }),

    patchPipelineUIState: (patch) =>
      set((state) => {
        Object.assign(state.pipelineUIState, patch);
      }),

    setConnectionQuality: (quality) =>
      set((state) => {
        state.connectionQuality = quality;
      }),

    setAloneTimeout: (seconds) =>
      set((state) => {
        state.aloneTimeout = seconds;
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

    getChannelParticipants: (() => {
      let _cachedParticipants: Record<string, VoiceParticipant> | null = null;
      let _cachedChannelId: string | null = null;
      let _cachedResult: VoiceParticipant[] = [];

      return (channelId: string) => {
        const state = get();
        if (state.participants === _cachedParticipants && channelId === _cachedChannelId) {
          return _cachedResult;
        }
        _cachedParticipants = state.participants;
        _cachedChannelId = channelId;
        _cachedResult = Object.values(state.participants).filter(
          (p) => p.channelId === channelId
        );
        return _cachedResult;
      };
    })(),

    disconnect: () =>
      set((state) => {
        // Only remove SELF from the channel participants.
        // Other users' voice states must stay — they're still in the channel.
        // Gateway voice_state_update events manage remote participants.
        // We need userId from auth store to identify self.
        const leavingChannel = state.currentChannelId;
        // Note: we can't easily get userId here from another store inside immer,
        // so we clear only the LiveKit connection state. The gateway will send
        // a voice_state_update for our departure which removes our participant entry.
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
        state.watchingStreams = {};
        state.error = null;
        state.effectiveAudioMode = state.settings.audioMode;
        state.audioReconfigureRequired = false;
        state.pipelineUIState = createDefaultPipelineUIState(
          state.pipelineUIState.supportDetection.platform,
          state.settings.audioMode,
        );
      }),
  })),
  {
    name: 'voice-settings',
    partialize: (state) => ({
      settings: state.settings,
      userVolumes: state.userVolumes,
      streamVolumes: state.streamVolumes,
      selfMuted: state.selfMuted,
      selfDeafened: state.selfDeafened,
    }),
    merge: (persisted, current) => {
      const p = persisted as Record<string, any> | undefined;
      return {
        ...current,
        ...p,
        settings: { ...DEFAULT_SETTINGS, ...p?.settings },
      } as VoiceState;
    },
  })
);
