import { create } from 'zustand';
import { persist, type StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  type AudioPipelineUIState,
  type AudioMode,
  type AudioPlatform,
  createDefaultPipelineUIState,
} from '../types';

export type { AudioMode, AudioPlatform };

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

export interface AudioCapabilities {
  enhancedAvailable: boolean;
  enhancedChecked: boolean;
}

interface VoiceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  videoDeviceId: string;
  inputVolume: number;
  outputVolume: number;
  notificationSounds: boolean;
  audioMode: AudioMode;
  voiceActivityThreshold: number;
  pushToTalk: boolean;
  pttKey: string;
}

interface VoiceState {
  connectionState: VoiceConnectionState;
  currentChannelId: string | null;
  currentGuildId: string | null;
  livekitToken: string | null;
  livekitUrl: string | null;
  selfMuted: boolean;
  selfDeafened: boolean;
  _mutedBeforeDeafen: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  screenShareQuality: ScreenShareQuality;
  screenShareAudio: boolean;
  pinnedParticipantId: string | null;
  participants: Record<string, VoiceParticipant>;
  connectionQuality: number;
  aloneTimeout: number | null;
  error: string | null;
  settings: VoiceSettings;
  userVolumes: Record<string, number>;
  streamVolumes: Record<string, number>;
  watchingStreams: Record<string, boolean>;
  audioCapabilities: AudioCapabilities;
  effectiveAudioMode: AudioMode;
  audioReconfigureRequired: boolean;
  pipelineUIState: AudioPipelineUIState;

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
  setParticipant: (participant: VoiceParticipant) => void;
  removeParticipant: (channelId: string, userId: string) => void;
  setSpeaking: (channelId: string, userId: string, speaking: boolean) => void;
  setParticipantVideo: (channelId: string, userId: string, selfVideo: boolean) => void;
  setParticipantScreenShare: (channelId: string, userId: string, screenSharing: boolean) => void;
  clearChannelParticipants: (channelId: string) => void;
  getChannelParticipants: (channelId: string) => VoiceParticipant[];
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
  voiceActivityThreshold: -1,
  pushToTalk: false,
  pttKey: 'Space',
};

function participantKey(channelId: string, userId: string) {
  return `${channelId}:${userId}`;
}

export function createVoiceStore(platform: AudioPlatform = 'browser', storage?: StateStorage) {
  const storeCreator = immer<VoiceState>((set, get) => ({
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
    pipelineUIState: createDefaultPipelineUIState(platform, 'standard'),

    setConnectionState: (connectionState) => set((state) => { state.connectionState = connectionState; }),
    setCurrentChannel: (channelId, guildId) => set((state) => { state.currentChannelId = channelId; state.currentGuildId = guildId; }),
    setLivekitCredentials: (token, url) => set((state) => { state.livekitToken = token; state.livekitUrl = url; }),
    clearLivekitCredentials: () => set((state) => { state.livekitToken = null; state.livekitUrl = null; }),
    setSelfMuted: (muted) => set((state) => { state.selfMuted = muted; }),
    setSelfDeafened: (deafened) => set((state) => {
      state.selfDeafened = deafened;
      if (deafened) {
        state._mutedBeforeDeafen = state.selfMuted;
        state.selfMuted = true;
      } else {
        state.selfMuted = state._mutedBeforeDeafen;
      }
    }),
    setCameraEnabled: (enabled) => set((state) => { state.cameraEnabled = enabled; }),
    setScreenShareEnabled: (enabled) => set((state) => { state.screenShareEnabled = enabled; }),
    setScreenShareQuality: (quality) => set((state) => { state.screenShareQuality = quality; }),
    setScreenShareAudio: (enabled) => set((state) => { state.screenShareAudio = enabled; }),
    setPinnedParticipant: (userId) => set((state) => { state.pinnedParticipantId = state.pinnedParticipantId === userId ? null : userId; }),
    updateSettings: (patch) => set((state) => { Object.assign(state.settings, patch); }),
    setUserVolume: (userId, volume) => set((state) => { state.userVolumes[userId] = Math.max(0, Math.min(100, volume)); }),
    setStreamVolume: (userId, volume) => set((state) => { state.streamVolumes[userId] = Math.max(0, Math.min(100, volume)); }),
    setWatchingStream: (userId, watching) => set((state) => { state.watchingStreams[userId] = watching; }),
    clearStreamState: (userId) => set((state) => { delete state.watchingStreams[userId]; }),
    setAudioCapabilities: (patch) => set((state) => { Object.assign(state.audioCapabilities, patch); }),
    setEffectiveAudioMode: (mode) => set((state) => { state.effectiveAudioMode = mode; }),
    setAudioReconfigureRequired: (required) => set((state) => { state.audioReconfigureRequired = required; }),
    setPipelineUIState: (uiState) => set((state) => { state.pipelineUIState = uiState; }),
    patchPipelineUIState: (patch) => set((state) => { Object.assign(state.pipelineUIState, patch); }),
    setConnectionQuality: (quality) => set((state) => { state.connectionQuality = quality; }),
    setAloneTimeout: (seconds) => set((state) => { state.aloneTimeout = seconds; }),
    setError: (error) => set((state) => { state.error = error; if (error) state.connectionState = 'error'; }),

    setParticipant: (participant) => set((state) => {
      state.participants[participantKey(participant.channelId, participant.userId)] = participant;
    }),
    removeParticipant: (channelId, userId) => set((state) => {
      delete state.participants[participantKey(channelId, userId)];
    }),
    setSpeaking: (channelId, userId, speaking) => set((state) => {
      const key = participantKey(channelId, userId);
      if (state.participants[key]) state.participants[key].speaking = speaking;
    }),
    setParticipantVideo: (channelId, userId, selfVideo) => set((state) => {
      const key = participantKey(channelId, userId);
      if (state.participants[key]) state.participants[key].selfVideo = selfVideo;
    }),
    setParticipantScreenShare: (channelId, userId, screenSharing) => set((state) => {
      const key = participantKey(channelId, userId);
      if (state.participants[key]) state.participants[key].screenSharing = screenSharing;
    }),
    clearChannelParticipants: (channelId) => set((state) => {
      for (const key of Object.keys(state.participants)) {
        if (key.startsWith(`${channelId}:`)) delete state.participants[key];
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
        _cachedResult = Object.values(state.participants).filter((p) => p.channelId === channelId);
        return _cachedResult;
      };
    })(),

    disconnect: () => set((state) => {
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
  }));

  if (storage) {
    return create<VoiceState>()(
      persist(storeCreator, {
        name: 'voice-settings',
        storage: {
          getItem: (name) => {
            const str = storage.getItem(name);
            return str ? (typeof str === 'string' ? JSON.parse(str) : str) : null;
          },
          setItem: (name, value) => storage.setItem(name, JSON.stringify(value)),
          removeItem: (name) => storage.removeItem(name),
        },
        partialize: (state: VoiceState) => ({
          settings: state.settings,
          userVolumes: state.userVolumes,
          streamVolumes: state.streamVolumes,
          selfMuted: state.selfMuted,
          selfDeafened: state.selfDeafened,
        } as unknown as VoiceState),
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
  }

  return create<VoiceState>()(storeCreator);
}

export const useVoiceStore = createVoiceStore(
  'browser',
  typeof window !== 'undefined'
    ? {
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      }
    : undefined
);
