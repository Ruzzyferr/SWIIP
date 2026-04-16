'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  ConnectionState,
  Track,
  VideoPresets,
  AudioPresets,
  RemoteAudioTrack,
  RemoteTrackPublication,
  VideoQuality,
  DefaultReconnectPolicy,
  type RemoteParticipant,
  type RemoteTrack,
  type LocalParticipant,
  type LocalTrackPublication,
  type Participant,
  type TrackPublication,
} from 'livekit-client';
import { OpCode, ClientEventType } from '@constchat/protocol';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { getPlatformProvider } from '@/lib/platform';
import { useVoiceStore, type AudioMode } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import { playJoinSound, playLeaveSound, shouldPlaySound } from '@/lib/sounds';
import {
  AudioPipeline,
  BrowserAudioStrategy,
  DesktopAudioStrategy,
  buildCaptureConstraints,
  requiresRepublish,
  type AudioPlatform,
} from '@/lib/audio';
import { networkMonitor } from '@/lib/network/NetworkMonitor';

/** Create the appropriate strategy for the current platform. */
function createStrategy(platform: AudioPlatform) {
  return platform === 'desktop' ? new DesktopAudioStrategy() : new BrowserAudioStrategy();
}

/** Map of participantIdentity → { camera?: MediaStreamTrack, screen?: MediaStreamTrack } */
export interface VideoTrackMap {
  [participantId: string]: {
    camera?: MediaStreamTrack;
    screen?: MediaStreamTrack;
  };
}

/** How long to wait for LiveKit credentials after VOICE_JOIN before giving up */
const CREDENTIAL_TIMEOUT_MS = 12_000;

/**
 * Manages the LiveKit Room instance lifecycle.
 * Connects/disconnects based on voice store credentials.
 * Syncs participant speaking state back to the voice store.
 */
export function useLiveKitRoom() {
  const roomRef = useRef<Room | null>(null);
  const pipelineRef = useRef<AudioPipeline | null>(null);
  const credentialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const trackOwnerRef = useRef<Map<string, string>>(new Map()); // trackSid -> userId
  const trackSourceRef = useRef<Map<string, 'mic' | 'screen'>>(new Map()); // trackSid -> source type
  /** Timestamp until which screen-share unpublish events should be suppressed (reconnect grace). */
  const screenShareReconnectUntil = useRef(0);
  const [videoTracks, setVideoTracks] = useState<VideoTrackMap>({});

  const livekitToken = useVoiceStore((s) => s.livekitToken);
  const livekitUrl = useVoiceStore((s) => s.livekitUrl);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const cameraEnabled = useVoiceStore((s) => s.cameraEnabled);
  const screenShareEnabled = useVoiceStore((s) => s.screenShareEnabled);
  const inputDeviceId = useVoiceStore((s) => s.settings.inputDeviceId);
  const outputDeviceId = useVoiceStore((s) => s.settings.outputDeviceId);
  const videoDeviceId = useVoiceStore((s) => s.settings.videoDeviceId);
  const outputVolume = useVoiceStore((s) => s.settings.outputVolume);
  const inputVolume = useVoiceStore((s) => s.settings.inputVolume);
  const audioMode = useVoiceStore((s) => s.settings.audioMode);
  const rnnoiseGain = useVoiceStore((s) => s.settings.rnnoiseGain);
  const setConnectionState = useVoiceStore((s) => s.setConnectionState);
  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const setParticipant = useVoiceStore((s) => s.setParticipant);
  const setParticipantVideo = useVoiceStore((s) => s.setParticipantVideo);
  const setParticipantScreenShare = useVoiceStore((s) => s.setParticipantScreenShare);
  const removeParticipant = useVoiceStore((s) => s.removeParticipant);
  const setConnectionQuality = useVoiceStore((s) => s.setConnectionQuality);
  const setAloneTimeout = useVoiceStore((s) => s.setAloneTimeout);
  const setError = useVoiceStore((s) => s.setError);
  const disconnect = useVoiceStore((s) => s.disconnect);
  const userId = useAuthStore((s) => s.user?.id);
  const aloneTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Custom VAD: AudioContext + AnalyserNode for responsive speaking detection */
  const vadContextRef = useRef<AudioContext | null>(null);
  const vadAnimFrameRef = useRef<number>(0);

  // Helper to update video track map
  const updateVideoTrack = useCallback((
    participantId: string,
    type: 'camera' | 'screen',
    track: MediaStreamTrack | undefined,
  ) => {
    setVideoTracks((prev) => {
      const entry = prev[participantId] ?? {};
      const updated = { ...entry, [type]: track };
      // Remove entry entirely if both tracks are gone
      if (!updated.camera && !updated.screen) {
        const next = { ...prev };
        delete next[participantId];
        return next;
      }
      return { ...prev, [participantId]: updated };
    });
  }, []);

  // Timeout: if we're in "connecting" state but credentials never arrive, bail out
  useEffect(() => {
    if (connectionState === 'connecting' && currentChannelId && !livekitToken) {
      console.debug('[LiveKit] Waiting for credentials from gateway…');
      credentialTimeoutRef.current = setTimeout(() => {
        const state = useVoiceStore.getState();
        // Only fire if we're still waiting (no credentials arrived)
        if (state.connectionState === 'connecting' && !state.livekitToken) {
          console.error('[LiveKit] Credential timeout — gateway never sent VOICE_SERVER_UPDATE');
          state.setError('Voice server did not respond. Please try again.');
        }
      }, CREDENTIAL_TIMEOUT_MS);

      return () => {
        if (credentialTimeoutRef.current) {
          clearTimeout(credentialTimeoutRef.current);
          credentialTimeoutRef.current = null;
        }
      };
    }
  }, [connectionState, currentChannelId, livekitToken]);

  // Connect to LiveKit when credentials are available
  useEffect(() => {
    if (!livekitToken || !livekitUrl || !currentChannelId) return;

    // Clear credential timeout — credentials arrived
    if (credentialTimeoutRef.current) {
      clearTimeout(credentialTimeoutRef.current);
      credentialTimeoutRef.current = null;
    }

    console.debug('[LiveKit] Credentials received, connecting to', livekitUrl);

    const currentAudioMode = useVoiceStore.getState().settings.audioMode;
    const platform = getPlatformProvider();
    // Audio capture defaults — AGC always off (pumps floor noise).
    // Noise suppression is mode-controlled: standard=browser NS, enhanced=Krisp, raw=off.
    const room = new Room({
      // Adaptive stream — let LiveKit adjust video quality based on subscriber
      // bandwidth. Screen share tracks are pinned to HIGH quality in the
      // TrackSubscribed handler to prevent downgrading.
      adaptiveStream: { pixelDensity: 'screen' },
      // Dynacast — server-side track optimization when subscribers aren't
      // viewing. Works together with adaptiveStream; screen share is protected
      // via the HIGH quality pin on the subscriber side.
      dynacast: true,
      // Reconnect policy — platform-aware delays.
      // Desktop: faster initial retry, more attempts (always-on expectation).
      // Web: more conservative (browser tab may be backgrounded).
      reconnectPolicy: new DefaultReconnectPolicy(platform.livekitReconnectDelays),
      publishDefaults: {
        // Disable simulcast for screen share — send one high-quality stream
        screenShareSimulcastLayers: [],
        screenShareEncoding: {
          maxBitrate: 4_000_000,
          maxFramerate: 30,
        },
        // High-quality stereo audio for screen share by default
        audioPreset: AudioPresets.musicHighQualityStereo,
        dtx: false,
      },
      audioCaptureDefaults: buildCaptureConstraints(
        platform.isDesktop ? 'desktop' : 'browser',
        currentAudioMode,
      ),
    });

    roomRef.current = room;

    /** Route an audio element to the user's selected output device (isolates from loopback capture). */
    const applySinkId = (element: HTMLAudioElement) => {
      const deviceId = useVoiceStore.getState().settings.outputDeviceId;
      if (deviceId && deviceId !== 'default' && typeof element.setSinkId === 'function') {
        element.setSinkId(deviceId).catch((err: any) => {
          console.warn('[LiveKit] Failed to set audio output device:', err);
        });
      }
    };

    const detachAudio = (trackSid: string) => {
      const existing = audioElementsRef.current.get(trackSid);
      if (existing) {
        try {
          existing.pause();
          // Clear srcObject for raw screen share audio elements
          if (existing.srcObject) existing.srcObject = null;
          existing.remove();
        } catch {
          // ignore cleanup failures
        }
        audioElementsRef.current.delete(trackSid);
        trackOwnerRef.current.delete(trackSid);
        trackSourceRef.current.delete(trackSid);
      }
    };

    const attachAudio = async (track: RemoteTrack, participant?: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio) return;
      const trackSid = track.sid ?? `${Date.now()}-${Math.random()}`;
      detachAudio(trackSid);
      // Map owner and source type
      if (participant) {
        trackOwnerRef.current.set(trackSid, participant.identity);
      }
      const isScreenShareAudio = track.source === Track.Source.ScreenShareAudio;
      trackSourceRef.current.set(trackSid, isScreenShareAudio ? 'screen' : 'mic');

      if (isScreenShareAudio) {
        // Screen share audio bypasses LiveKit's audio pipeline entirely.
        // This prevents noise suppression/processing from cutting the stream audio
        // when other participants speak.
        const element = document.createElement('audio');
        element.autoplay = true;
        element.setAttribute('playsinline', 'true');
        const stream = new MediaStream([track.mediaStreamTrack]);
        element.srcObject = stream;
        element.muted = false;
        const state = useVoiceStore.getState();
        const globalVol = state.selfDeafened ? 0 : state.settings.outputVolume / 100;
        const streamVol = (state.streamVolumes[participant?.identity ?? ''] ?? 100) / 100;
        element.volume = Math.min(globalVol * streamVol, 1);
        document.body.appendChild(element);
        applySinkId(element);
        audioElementsRef.current.set(trackSid, element);
        try {
          await element.play();
        } catch {
          room.startAudio().catch(() => {});
        }
        return;
      }

      // Normal mic audio — use LiveKit's track.attach() which goes through audio pipeline
      const element = track.attach() as HTMLAudioElement;
      element.autoplay = true;
      element.setAttribute('playsinline', 'true');
      element.muted = false;
      const state = useVoiceStore.getState();
      const globalVol = state.selfDeafened ? 0 : state.settings.outputVolume / 100;
      const userVol = (state.userVolumes[participant?.identity ?? ''] ?? 100) / 100;
      element.volume = Math.min(globalVol * userVol, 1);
      if (track instanceof RemoteAudioTrack) {
        track.setVolume(globalVol * userVol);
      }
      document.body.appendChild(element);
      applySinkId(element);
      audioElementsRef.current.set(trackSid, element);
      try {
        await element.play();
      } catch {
        // Fallback for browsers that gate autoplay until explicit gesture.
        room.startAudio().catch(() => {});
      }
    };

    // Per-participant speaking detection for REMOTE participants (uses LiveKit's built-in VAD)
    const bindSpeakingListener = (participant: Participant) => {
      participant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        if (!currentChannelId) return;
        setSpeaking(currentChannelId, participant.identity, speaking);
      });
    };

    /**
     * Custom VAD for the LOCAL participant using Web Audio API AnalyserNode.
     * LiveKit's built-in IsSpeakingChanged has high latency (~300-500ms) and a
     * fixed high threshold. This custom detector:
     *  - Uses requestAnimationFrame (~16ms intervals) for near-instant response
     *  - Respects the user's voiceActivityThreshold setting from the store
     *  - Uses a short debounce (150ms) to avoid flickering on silence gaps
     */
    const startLocalVAD = (localParticipant: LocalParticipant) => {
      // Clean up any existing VAD
      stopLocalVAD();

      const micPub = localParticipant.getTrackPublication(Track.Source.Microphone);
      const micTrack = micPub?.track?.mediaStreamTrack;
      if (!micTrack) {
        console.debug('[VAD] No mic track available, skipping custom VAD');
        return;
      }

      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(new MediaStream([micTrack]));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.1; // Low smoothing for fast response
        source.connect(analyser);
        vadContextRef.current = ctx;

        // Use time-domain (waveform) data — much more sensitive than frequency data
        // for voice detection. Measures peak amplitude directly.
        const dataArray = new Uint8Array(analyser.fftSize);
        let wasSpeaking = false;
        let silenceStart = 0;
        const SILENCE_DEBOUNCE_MS = 150; // Short debounce to prevent flicker
        let frameCount = 0;
        const SKIP_FRAMES = 2; // Process every 3rd frame (~20fps) to reduce CPU load

        const detect = () => {
          vadAnimFrameRef.current = requestAnimationFrame(detect);

          // Throttle: skip 2 out of 3 frames
          if (++frameCount % (SKIP_FRAMES + 1) !== 0) return;

          // Skip detection when muted — don't show speaking indicator
          const storeState = useVoiceStore.getState();
          if (storeState.selfMuted) {
            if (wasSpeaking) {
              wasSpeaking = false;
              silenceStart = 0;
              if (currentChannelId && userId) {
                setSpeaking(currentChannelId, userId, false);
              }
            }
            return;
          }

          // Time-domain data: each byte is amplitude (128 = silence, 0/255 = peak)
          analyser.getByteTimeDomainData(dataArray);

          // Calculate peak deviation from silence (128)
          let peak = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const deviation = Math.abs(dataArray[i]! - 128);
            if (deviation > peak) peak = deviation;
          }
          // Normalize: 0 = silence, 100 = max amplitude
          const level = (peak / 128) * 100;

          // Get threshold: -1 = automatic (use low default for responsiveness)
          // VAD reads the processed track (post-RNNoise), so threshold must be
          // low enough that normal speech with noise suppression still triggers.
          const settings = storeState.settings;
          const threshold = settings.voiceActivityThreshold === -1
            ? 1.5  // Low default — compensates for RNNoise signal attenuation
            : settings.voiceActivityThreshold;

          const isSpeaking = level > threshold;

          if (isSpeaking) {
            silenceStart = 0;
            if (!wasSpeaking) {
              wasSpeaking = true;
              if (currentChannelId && userId) {
                setSpeaking(currentChannelId, userId, true);
              }
            }
          } else if (wasSpeaking) {
            // Debounce: only stop speaking after short silence
            if (silenceStart === 0) {
              silenceStart = performance.now();
            } else if (performance.now() - silenceStart > SILENCE_DEBOUNCE_MS) {
              wasSpeaking = false;
              silenceStart = 0;
              if (currentChannelId && userId) {
                setSpeaking(currentChannelId, userId, false);
              }
            }
          }
        };

        vadAnimFrameRef.current = requestAnimationFrame(detect);
        console.debug('[VAD] Custom local VAD started');
      } catch (err) {
        console.warn('[VAD] Failed to start custom VAD:', err);
      }
    };

    const stopLocalVAD = () => {
      if (vadAnimFrameRef.current) {
        cancelAnimationFrame(vadAnimFrameRef.current);
        vadAnimFrameRef.current = 0;
      }
      if (vadContextRef.current) {
        vadContextRef.current.close().catch(() => {});
        vadContextRef.current = null;
      }
    };

    // --- Event handlers ---
    room.on(RoomEvent.ConnectionStateChanged, async (state: ConnectionState) => {
      console.debug('[LiveKit] Connection state:', state);
      switch (state) {
        case ConnectionState.Connecting:
          setConnectionState('connecting');
          break;
        case ConnectionState.Connected:
          setConnectionState('connected');
          // After reconnect, re-sync all remote participants AND video tracks.
          // During reconnection, ParticipantDisconnected / TrackUnsubscribed may
          // have fired and cleared our state, but participants are back now.
          for (const [, participant] of room.remoteParticipants) {
            // Re-add participant to store
            if (currentChannelId) {
              setParticipant({
                userId: participant.identity,
                channelId: currentChannelId,
                selfMute: !participant.isMicrophoneEnabled,
                selfDeaf: false,
                serverMute: false,
                serverDeaf: false,
                speaking: participant.isSpeaking,
                selfVideo: participant.isCameraEnabled,
                screenSharing: participant.isScreenShareEnabled,
              });
            }
            // Re-attach audio tracks after reconnect
            for (const pub of participant.audioTrackPublications.values()) {
              if (pub.track && pub.isSubscribed) {
                await attachAudio(pub.track as RemoteTrack, participant);
              }
            }
            for (const pub of participant.videoTrackPublications.values()) {
              if (pub.track && pub.isSubscribed) {
                const isScreen = pub.source === Track.Source.ScreenShare;
                updateVideoTrack(
                  participant.identity,
                  isScreen ? 'screen' : 'camera',
                  pub.track.mediaStreamTrack,
                );
                if (currentChannelId) {
                  if (isScreen) {
                    setParticipantScreenShare(currentChannelId, participant.identity, true);
                  } else {
                    setParticipantVideo(currentChannelId, participant.identity, true);
                  }
                }
              }
            }
          }
          // Apply volumes with progressive retries to cover late track subscriptions
          for (const delay of [200, 800, 2000, 5000]) {
            setTimeout(() => applyVolumes(), delay);
          }

          // Restart custom VAD after reconnect (mic track may have changed)
          setTimeout(() => startLocalVAD(room.localParticipant), 600);

          // Reconcile: remove stale participants from store that are no longer in room
          if (currentChannelId) {
            const storeParticipants = useVoiceStore.getState().participants;
            const roomIdentities = new Set(
              Array.from(room.remoteParticipants.values()).map((p) => p.identity),
            );
            roomIdentities.add(room.localParticipant.identity);
            for (const key of Object.keys(storeParticipants)) {
              if (!key.startsWith(currentChannelId + ':')) continue;
              const userId = key.split(':')[1];
              if (userId && !roomIdentities.has(userId)) {
                removeParticipant(currentChannelId, userId);
              }
            }
          }

          // Re-publish screen share if it was active before reconnect.
          // We check the grace-period timestamp instead of a boolean flag
          // to avoid race conditions with late LocalTrackUnpublished events.
          if (screenShareReconnectUntil.current > 0 && useVoiceStore.getState().screenShareEnabled) {
            const hasScreenTrack = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
            if (hasScreenTrack) {
              // Track survived the reconnect — nothing to do.
              console.debug('[LiveKit] Screen share track survived reconnect');
              screenShareReconnectUntil.current = 0;
            } else {
              // Track was lost — try to re-publish.
              console.debug('[LiveKit] Re-publishing screen share after reconnect');
              const quality = useVoiceStore.getState().screenShareQuality;
              const presets = {
                '720p30': { maxBitrate: 2_500_000, fps: 30 },
                '1080p30': { maxBitrate: 4_000_000, fps: 30 },
                '1080p60': { maxBitrate: 6_000_000, fps: 60 },
              } as const;
              const preset = presets[quality as keyof typeof presets] ?? presets['1080p30'];
              const wantAudio = useVoiceStore.getState().screenShareAudio;
              room.localParticipant.setScreenShareEnabled(true, {
                contentHint: preset.fps >= 60 ? 'motion' : 'detail',
                audio: wantAudio,
                selfBrowserSurface: 'exclude',
                surfaceSwitching: 'include',
                systemAudio: 'include',
                preferCurrentTab: false,
              }, {
                simulcast: false,
                videoEncoding: { maxBitrate: preset.maxBitrate, maxFramerate: preset.fps },
                audioPreset: AudioPresets.musicHighQualityStereo,
                dtx: false,
              }).then(() => {
                console.debug('[LiveKit] Screen share re-published successfully');
              }).catch((err) => {
                console.warn('[LiveKit] Failed to re-publish screen share:', err);
                useVoiceStore.getState().setScreenShareEnabled(false);
                useVoiceStore.getState().setError(
                  'Screen share stopped due to connection loss. Click the screen share button to restart.',
                );
              }).finally(() => {
                screenShareReconnectUntil.current = 0;
              });
            }
          } else {
            screenShareReconnectUntil.current = 0;
          }
          break;
        case ConnectionState.Reconnecting:
          setConnectionState('reconnecting');
          // Save screen share state before reconnect tears it down.
          // Use a 30-second grace period so that late LocalTrackUnpublished
          // events don't falsely stop the share after we transition to Connected.
          if (useVoiceStore.getState().screenShareEnabled) {
            screenShareReconnectUntil.current = Date.now() + 30_000; // 30s grace
          }
          break;
        case ConnectionState.Disconnected:
          setConnectionState('disconnected');
          screenShareReconnectUntil.current = 0;
          // If we were previously connected (i.e. reconnect failed), clean up properly
          if (useVoiceStore.getState().currentChannelId) {
            setError('Voice connection lost. Please rejoin the channel.');
            disconnect();
          }
          break;
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      console.debug('[LiveKit] Disconnected from room');
      for (const sid of audioElementsRef.current.keys()) {
        detachAudio(sid);
      }
    });

    // Reconnect audio handling is managed by AudioPipeline.handleReconnect()
    // which is wired via pipeline.onTransition() — see below.

    // Connection quality monitoring + adaptive video quality
    const qualityToNumber = (q: string | number): number => {
      if (typeof q === 'number') return q;
      switch (q) {
        case 'excellent': return 3;
        case 'good':      return 2;
        case 'poor':      return 1;
        case 'lost':      return 0;
        default:          return 0; // 'unknown' or unexpected
      }
    };

    // Hysteresis for connection quality: require 2 consecutive low readings before
    // downgrading, but upgrade immediately. Prevents flickering quality indicator.
    let lastAppliedQuality = 3; // Start at EXCELLENT
    let consecutiveLowCount = 0;
    let lastLowQuality = 0;

    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (!participant.isLocal) return;
      // ConnectionQuality is a string enum in livekit-client v2+: 'excellent'|'good'|'poor'|'lost'|'unknown'
      const q = qualityToNumber(quality as unknown as string);

      // Determine effective quality with hysteresis
      let effectiveQ = q;
      if (q < lastAppliedQuality) {
        // Downgrade: require 2 consecutive low readings
        if (q === lastLowQuality) {
          consecutiveLowCount++;
        } else {
          consecutiveLowCount = 1;
          lastLowQuality = q;
        }
        if (consecutiveLowCount < 2) {
          effectiveQ = lastAppliedQuality; // Keep current quality
        }
      } else {
        // Upgrade: apply immediately
        consecutiveLowCount = 0;
      }

      if (effectiveQ !== lastAppliedQuality) {
        lastAppliedQuality = effectiveQ;
        setConnectionQuality(effectiveQ);

        // Adaptive video: reduce resolution on poor connection (adaptive quality)
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track) {
          if (effectiveQ <= 1) {
            // POOR or LOST → drop to 360p, low framerate
            camPub.track.mediaStreamTrack.applyConstraints({
              width: { ideal: 640 },
              height: { ideal: 360 },
              frameRate: { ideal: 15 },
            }).catch(() => {});
          } else if (effectiveQ === 2) {
            // GOOD → 720p
            camPub.track.mediaStreamTrack.applyConstraints({
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }).catch(() => {});
          } else {
            // EXCELLENT → full 1080p
            camPub.track.mediaStreamTrack.applyConstraints({
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            }).catch(() => {});
          }
        }

        // Proactive screen share degradation — reduce bitrate/resolution before
        // the connection drops entirely. Zoom/Meet do this to keep the session
        // alive on constrained networks.
        const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (screenPub?.track) {
          if (effectiveQ <= 1) {
            // POOR/LOST → drop screen share to 720p, 15fps to preserve connection
            screenPub.track.mediaStreamTrack.applyConstraints({
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 15 },
            }).catch(() => {});
          } else {
            // GOOD/EXCELLENT → restore to user's chosen quality
            const quality = useVoiceStore.getState().screenShareQuality;
            const presets = {
              '720p30': { width: 1280, height: 720, fps: 30 },
              '1080p30': { width: 1920, height: 1080, fps: 30 },
              '1080p60': { width: 1920, height: 1080, fps: 60 },
            };
            const preset = presets[quality as keyof typeof presets] ?? presets['1080p30'];
            screenPub.track.mediaStreamTrack.applyConstraints({
              width: { ideal: preset.width },
              height: { ideal: preset.height },
              frameRate: { ideal: preset.fps },
            }).catch(() => {});
          }
        }
      } else {
        // Still update store even if not changing video constraints
        setConnectionQuality(q);
      }
    });

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (!currentChannelId) return;
      // Note: isMicrophoneEnabled returns false until audio track is published,
      // so default to selfMute: false (assume unmuted). TrackMuted/TrackUnmuted
      // will update this once tracks are subscribed.
      setParticipant({
        userId: participant.identity,
        channelId: currentChannelId,
        selfMute: false,
        selfDeaf: false,
        serverMute: false,
        serverDeaf: false,
        speaking: participant.isSpeaking,
        selfVideo: participant.isCameraEnabled,
        screenSharing: participant.isScreenShareEnabled,
      });
      bindSpeakingListener(participant);
      if (shouldPlaySound()) {
        playJoinSound();
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.debug('[LiveKit] Participant disconnected:', participant.identity);
      // During reconnect, participants temporarily disconnect then reconnect.
      // Skip removal to prevent UI flicker.
      if (room.state === ConnectionState.Reconnecting) {
        console.debug('[LiveKit] Skipping participant removal during reconnect');
        return;
      }
      if (!currentChannelId) return;
      removeParticipant(currentChannelId, participant.identity);
      if (shouldPlaySound()) {
        playLeaveSound();
      }
    });

    // Track remote screen share PUBLICATIONS (not subscriptions) to know WHO is sharing.
    // This fires when a remote participant publishes a track, before we subscribe.
    room.on(RoomEvent.TrackPublished, (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (!currentChannelId) return;
      if (publication.source === Track.Source.ScreenShare && publication.kind === Track.Kind.Video) {
        setParticipantScreenShare(currentChannelId, participant.identity, true);
        // Default to unwatched — user opts in via "Watch Stream" on the tile.
        // This keeps the normal lobby view until the user chooses to watch.
        const ws = useVoiceStore.getState().watchingStreams;
        if (ws[participant.identity] === undefined) {
          useVoiceStore.getState().setWatchingStream(participant.identity, false);
        }
      }
    });

    room.on(RoomEvent.TrackUnpublished, (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (!currentChannelId) return;
      if (publication.source === Track.Source.ScreenShare) {
        setParticipantScreenShare(currentChannelId, participant.identity, false);
        updateVideoTrack(participant.identity, 'screen', undefined);
        // Clean up stream watching/volume state only when screen share truly ends
        useVoiceStore.getState().clearStreamState(participant.identity);
      }
    });

    room.on(
      RoomEvent.TrackSubscribed,
      async (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          const isScreen = publication.source === Track.Source.ScreenShare;
          updateVideoTrack(
            participant.identity,
            isScreen ? 'screen' : 'camera',
            track.mediaStreamTrack,
          );
          if (currentChannelId && !isScreen) {
            setParticipantVideo(currentChannelId, participant.identity, true);
          }
          // Pin screen share to HIGH quality — prevent adaptiveStream from
          // downgrading screen share (text/code must stay sharp).
          if (isScreen) {
            publication.setVideoQuality(VideoQuality.HIGH);
          }
          // Screen share screenSharing flag is managed by TrackPublished/TrackUnpublished
        }
        await attachAudio(track, participant);
        // Apply persisted volume to newly subscribed audio tracks.
        // Use initial delay + retry to ensure Web Audio pipeline is ready.
        if (track.kind === Track.Kind.Audio) {
          setTimeout(() => applyVolumes(), 200);
          // Retry after 500ms in case the first apply was too early
          setTimeout(() => applyVolumes(), 700);
        }
      },
    );

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        if (track.sid) detachAudio(track.sid);
      }
      if (track.kind === Track.Kind.Video) {
        const isScreen = publication.source === Track.Source.ScreenShare;
        updateVideoTrack(
          participant.identity,
          isScreen ? 'screen' : 'camera',
          undefined,
        );
        if (currentChannelId && !isScreen) {
          setParticipantVideo(currentChannelId, participant.identity, false);
        }
        // Screen share: DON'T clear screenSharing or watchingStreams here.
        // The participant is still sharing — we just voluntarily unsubscribed.
        // clearStreamState would delete watchingStreams[identity] → undefined →
        // subscription watcher would re-subscribe (undefined !== false = true) → infinite loop.
      }
    });

    // Track mute/unmute for all participants (audio + video)
    // When camera is disabled, LiveKit MUTES the track (doesn't unsubscribe).
    // We must clear the video track on mute to avoid a frozen black frame.
    room.on(RoomEvent.TrackMuted, (publication: TrackPublication, participant: Participant) => {
      if (!currentChannelId) return;

      if (publication.source === Track.Source.Camera && publication.kind === Track.Kind.Video) {
        // Camera was disabled — clear the stale track reference to remove black tile
        updateVideoTrack(participant.identity, 'camera', undefined);
        setParticipantVideo(currentChannelId, participant.identity, false);
      }

      if (publication.source === Track.Source.ScreenShare && publication.kind === Track.Kind.Video) {
        console.debug('[LiveKit] Screen share muted (ICE reconnecting?):', participant.identity);
        // Don't clear the track — VideoTile handles mute/unmute via MediaStreamTrack events.
        // Just ensure store knows screen share is still active so UI doesn't tear down.
      }

      if (publication.source === Track.Source.Microphone) {
        const key = `${currentChannelId}:${participant.identity}`;
        const existing = useVoiceStore.getState().participants[key];
        if (existing) {
          setParticipant({ ...existing, selfMute: true });
        }
      }
    });

    room.on(RoomEvent.TrackUnmuted, (publication: TrackPublication, participant: Participant) => {
      if (!currentChannelId) return;

      if (publication.source === Track.Source.Camera && publication.kind === Track.Kind.Video) {
        // Camera was re-enabled — grab the fresh MediaStreamTrack
        const track = publication.track;
        if (track) {
          updateVideoTrack(participant.identity, 'camera', track.mediaStreamTrack);
          setParticipantVideo(currentChannelId, participant.identity, true);
        }
      }

      if (publication.source === Track.Source.ScreenShare && publication.kind === Track.Kind.Video) {
        console.debug('[LiveKit] Screen share unmuted (ICE reconnected):', participant.identity);
        // Re-push the track to VideoTile so it re-attaches and retries play().
        // This handles the case where the MediaStreamTrack unmute event alone
        // isn't sufficient (e.g., track was replaced by LiveKit during reconnect).
        const track = publication.track;
        if (track) {
          updateVideoTrack(participant.identity, 'screen', track.mediaStreamTrack);
        }
      }

      if (publication.source === Track.Source.Microphone) {
        const key = `${currentChannelId}:${participant.identity}`;
        const existing = useVoiceStore.getState().participants[key];
        if (existing) {
          setParticipant({ ...existing, selfMute: false });
        }
      }
    });

    // Track local participant video publications (camera + screen share)
    room.on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication, participant: LocalParticipant) => {
      const track = publication.track;
      if (!track || track.kind !== Track.Kind.Video) return;
      const isScreen = publication.source === Track.Source.ScreenShare;
      updateVideoTrack(
        participant.identity,
        isScreen ? 'screen' : 'camera',
        track.mediaStreamTrack,
      );
      // Sync store flags for local participant
      if (currentChannelId) {
        if (isScreen) {
          setParticipantScreenShare(currentChannelId, participant.identity, true);
        } else {
          setParticipantVideo(currentChannelId, participant.identity, true);
        }
      }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication: LocalTrackPublication, participant: LocalParticipant) => {
      if (publication.source === Track.Source.Camera) {
        updateVideoTrack(participant.identity, 'camera', undefined);
        if (currentChannelId) {
          setParticipantVideo(currentChannelId, participant.identity, false);
        }
      } else if (publication.source === Track.Source.ScreenShare) {
        updateVideoTrack(participant.identity, 'screen', undefined);
        if (currentChannelId) {
          setParticipantScreenShare(currentChannelId, participant.identity, false);
        }
        // Only sync screen share stop if NOT in a reconnect grace period.
        // During LiveKit reconnect, tracks get unpublished/republished automatically.
        // The timestamp-based grace window prevents late unpublish events from
        // falsely stopping the share after transitioning back to Connected.
        const inReconnectGrace = Date.now() < screenShareReconnectUntil.current
          || room.state === ConnectionState.Reconnecting;
        if (!inReconnectGrace) {
          useVoiceStore.getState().setScreenShareEnabled(false);
          const gw = getGatewayClient();
          gw.send(OpCode.DISPATCH, { t: ClientEventType.SCREEN_SHARE_STOP, d: {} });
        }
      }
    });

    // MediaDevicesError: device unplugged or permission revoked mid-call.
    // Most device errors are non-fatal — log them but don't show scary UI errors.
    // Screen sharing and listening work without a microphone.
    room.on(RoomEvent.MediaDevicesError, (error: Error, kind?: MediaDeviceKind) => {
      console.warn('[LiveKit] Media device error:', error.message, 'name:', error.name, 'kind:', kind);

      // Audio input (mic) errors — never block, mic is optional
      if (kind === 'audioinput' || !kind) {
        // "Could not start audio source", NotFoundError, NotReadableError — all mic issues.
        // User can still listen, watch streams, and screen share without a mic.
        const isMicError = error.name === 'NotFoundError'
          || error.name === 'NotReadableError'
          || error.message.toLowerCase().includes('audio source')
          || error.message.toLowerCase().includes('audio');
        if (isMicError) {
          console.warn('[LiveKit] Mic unavailable — user can still listen and screen share');
          return;
        }
        if (error.name === 'NotAllowedError') {
          console.warn('[LiveKit] Mic permission denied');
          return;
        }
      }

      if (kind === 'videoinput') {
        setError('Camera error: ' + error.message);
        return;
      }

      // Only show error for truly unexpected failures
      console.error('[LiveKit] Unexpected device error:', error);
    });

    // AudioPlaybackStatusChanged: browser blocked autoplay — prompt user
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (!room.canPlaybackAudio) {
        console.warn('[LiveKit] Audio playback blocked by browser — requesting user gesture');
        // Try to start audio; if it fails, the user must interact with the page
        room.startAudio().catch(() => {
          setError('Click anywhere to enable voice audio (browser autoplay policy).');
        });
      }
    });

    // Let LiveKit handle ICE server configuration.
    // LiveKit server provides STUN + TURN servers via the token's ICE config.
    // Overriding iceServers here would REPLACE LiveKit's built-in TURN servers,
    // causing media path failures behind symmetric NAT or firewalls.

    // Validate saved input device still exists — fall back to default if removed
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const savedId = useVoiceStore.getState().settings.inputDeviceId;
      if (savedId && savedId !== 'default') {
        const deviceExists = devices.some((d) => d.deviceId === savedId && d.kind === 'audioinput');
        if (!deviceExists) {
          console.warn('[LiveKit] Saved input device not found, falling back to default');
          useVoiceStore.getState().updateSettings({ inputDeviceId: 'default' });
        }
      }
    }).catch(() => {
      // Non-fatal — proceed with current settings
    });

    setConnectionState('connecting');

    // RTC connection timeout — if the WebRTC connection isn't established within
    // 15 seconds (ICE negotiation hung, TURN unreachable, etc.), disconnect and
    // surface an error instead of showing "connecting" indefinitely.
    const RTC_CONNECT_TIMEOUT_MS = 15_000;
    let rtcConnectTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (room.state !== ConnectionState.Connected) {
        console.warn('[LiveKit] RTC connection timeout — disconnecting');
        room.disconnect();
        setError('Voice connection timed out. Please try again.');
      }
      rtcConnectTimer = null;
    }, RTC_CONNECT_TIMEOUT_MS);

    room
      .connect(livekitUrl, livekitToken)
      .then(async () => {
        console.debug('[LiveKit] Connected successfully');
        if (rtcConnectTimer) { clearTimeout(rtcConnectTimer); rtcConnectTimer = null; }
        // Resume AudioContext if browser suspended it (autoplay policy)
        await room.startAudio().catch(() => {});

        try {
          // Create and apply AudioPipeline
          const audioPlatform: AudioPlatform = platform.isDesktop ? 'desktop' : 'browser';
          const strategy = createStrategy(audioPlatform);
          const pipeline = new AudioPipeline(audioPlatform, strategy);

          // Wire pipeline state changes to voice store
          pipeline.onTransition((uiState) => {
            const store = useVoiceStore.getState();
            store.setPipelineUIState(uiState);
            store.setEffectiveAudioMode(uiState.activeMode);
            if (uiState.isDegraded !== store.audioReconfigureRequired) {
              store.setAudioReconfigureRequired(uiState.isDegraded);
            }
          });

          pipelineRef.current = pipeline;
          await pipeline.applyToRoom(room, currentAudioMode);
        } catch (micErr) {
          console.warn('[LiveKit] Microphone access denied or failed — joining muted', micErr);
          useVoiceStore.getState().setSelfMuted(true);
        }

        // Register self as participant + start custom VAD for local user
        if (currentChannelId && userId) {
          const isMuted = useVoiceStore.getState().selfMuted;
          setParticipant({
            userId,
            channelId: currentChannelId,
            selfMute: isMuted,
            selfDeaf: false,
            serverMute: false,
            serverDeaf: false,
            speaking: false,
            selfVideo: false,
            screenSharing: false,
          });
          // Use custom VAD for local participant (more responsive than LiveKit's built-in)
          // Keep LiveKit's listener as fallback
          bindSpeakingListener(room.localParticipant);
          // Start custom VAD after a short delay to ensure mic track is published
          setTimeout(() => startLocalVAD(room.localParticipant), 500);
        }

        // Register existing remote participants + bind speaking listeners
        for (const [, participant] of room.remoteParticipants) {
          if (currentChannelId) {
            // By this point, existing participants have already published their tracks,
            // so isMicrophoneEnabled is reliable here (unlike ParticipantConnected which fires before track publish)
            const hasMicTrack = participant.getTrackPublication(Track.Source.Microphone);
            const isMuted = hasMicTrack ? !participant.isMicrophoneEnabled : false;
            setParticipant({
              userId: participant.identity,
              channelId: currentChannelId,
              selfMute: isMuted,
              selfDeaf: false,
              serverMute: false,
              serverDeaf: false,
              speaking: participant.isSpeaking,
              selfVideo: participant.isCameraEnabled,
              screenSharing: participant.isScreenShareEnabled,
            });
            bindSpeakingListener(participant);
            // Default existing screen sharers to unwatched when joining.
            if (participant.isScreenShareEnabled) {
              const ws = useVoiceStore.getState().watchingStreams;
              if (ws[participant.identity] === undefined) {
                useVoiceStore.getState().setWatchingStream(participant.identity, false);
              }
            }
          }
          for (const pub of participant.audioTrackPublications.values()) {
            if (pub.track) {
              await attachAudio(pub.track as RemoteTrack);
            }
          }
        }
      })
      .catch((err) => {
        console.error('[LiveKit] Failed to connect:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to voice server');
      });

    // Periodic health check — sync store with actual room state
    const healthCheckInterval = setInterval(() => {
      if (room.state !== ConnectionState.Connected || !currentChannelId) return;

      // Check for stale screen share tracks
      if (useVoiceStore.getState().screenShareEnabled) {
        const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (!pub) {
          console.warn('[LiveKit] Health check: screen share track missing, syncing store');
          useVoiceStore.getState().setScreenShareEnabled(false);
        }
      }

      // Reconcile remote participants
      const storeParticipants = useVoiceStore.getState().participants;
      for (const [, p] of room.remoteParticipants) {
        const key = `${currentChannelId}:${p.identity}`;
        if (!storeParticipants[key]) {
          console.warn('[LiveKit] Health check: missing participant, re-adding:', p.identity);
          setParticipant({
            userId: p.identity,
            channelId: currentChannelId,
            selfMute: !p.isMicrophoneEnabled,
            selfDeaf: false,
            serverMute: false,
            serverDeaf: false,
            speaking: p.isSpeaking,
            selfVideo: p.isCameraEnabled,
            screenSharing: p.isScreenShareEnabled,
          });
        }
      }
    }, 10_000);

    // Network change detection — trigger reconnect on network interface changes
    // instead of waiting for LiveKit's internal ICE timeout.
    const unsubNetwork = networkMonitor.subscribe((online, event) => {
      if (event === 'change' && online && room.state === ConnectionState.Connected) {
        // Network interface changed while connected (WiFi→cellular, VPN toggle).
        // Stale ICE candidates make the existing connection unreliable — force a
        // full LiveKit reconnect which will perform fresh ICE negotiation.
        console.info('[LiveKit] Network interface changed — forcing reconnect');
        room.engine?.client?.sendLeave?.();
        room.disconnect().then(() => {
          if (livekitToken && livekitUrl) {
            room.connect(livekitUrl, livekitToken).catch((err) => {
              console.error('[LiveKit] Reconnect after network change failed:', err);
            });
          }
        });
      } else if (event === 'online' && room.state !== ConnectionState.Connected) {
        // Device came back online while disconnected — reconnect immediately
        console.info('[LiveKit] Network online — attempting reconnect');
        if (livekitToken && livekitUrl) {
          room.connect(livekitUrl, livekitToken).catch((err) => {
            console.error('[LiveKit] Reconnect on online event failed:', err);
          });
        }
      }
    });

    return () => {
      console.debug('[LiveKit] Cleaning up room');
      if (rtcConnectTimer) { clearTimeout(rtcConnectTimer); rtcConnectTimer = null; }
      unsubNetwork();
      clearInterval(healthCheckInterval);
      stopLocalVAD();
      // Persist pending audio mode change so it's applied on next join
      if (pendingModeRef.current) {
        useVoiceStore.getState().updateSettings({ audioMode: pendingModeRef.current });
        pendingModeRef.current = null;
      }
      // Dispose audio pipeline first
      if (pipelineRef.current) {
        pipelineRef.current.dispose();
        pipelineRef.current = null;
      }
      room.disconnect();
      room.removeAllListeners();
      for (const sid of audioElementsRef.current.keys()) {
        detachAudio(sid);
      }
      roomRef.current = null;
      setVideoTracks({});
    };
  }, [livekitToken, livekitUrl, currentChannelId]);

  // Sync mute state to LiveKit + apply pending audio mode on unmute
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.setMicrophoneEnabled(!selfMuted).catch(console.error);

    // Clear speaking state immediately on mute — VAD loop also checks mute
    // but this ensures instant UI response
    if (selfMuted && currentChannelId && userId) {
      setSpeaking(currentChannelId, userId, false);
    }

    // When unmuting, apply any audio mode change that was deferred while muted
    if (!selfMuted && pendingModeRef.current && pipelineRef.current) {
      const mode = pendingModeRef.current;
      pendingModeRef.current = null;
      pipelineRef.current.requestMode(mode);
      console.debug(`[Audio] Applied deferred mode switch to ${mode} on unmute`);
    }
  }, [selfMuted]);

  // Sync deafen state + output volume + per-user volume — adjust all remote audio
  // Uses LiveKit's RemoteAudioTrack.setVolume() which properly controls the Web Audio
  // API gain node, unlike raw HTMLAudioElement.volume which is bypassed by LiveKit's pipeline.
  const applyVolumes = useCallback(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    const state = useVoiceStore.getState();
    const globalVol = state.selfDeafened ? 0 : state.settings.outputVolume / 100;

    // Apply via LiveKit's RemoteAudioTrack.setVolume (Web Audio API GainNode)
    // Screen share audio and mic audio use independent volume controls.
    for (const [, participant] of room.remoteParticipants) {
      const userVol = (state.userVolumes[participant.identity] ?? 100) / 100;
      const streamVol = (state.streamVolumes[participant.identity] ?? 100) / 100;

      for (const pub of participant.audioTrackPublications.values()) {
        if (pub.track && pub.track instanceof RemoteAudioTrack) {
          const isScreenAudio = pub.source === Track.Source.ScreenShareAudio;
          const trackVol = isScreenAudio ? streamVol : userVol;
          pub.track.setVolume(globalVol * trackVol);
          // Keep trackOwnerRef in sync in case SID was assigned after initial mapping
          if (pub.track.sid) {
            trackOwnerRef.current.set(pub.track.sid, participant.identity);
            trackSourceRef.current.set(pub.track.sid, isScreenAudio ? 'screen' : 'mic');
          }
        }
      }
    }

    // Also update raw HTMLAudioElement volumes (used for screen share audio bypass)
    for (const [trackSid, audioElement] of audioElementsRef.current.entries()) {
      const ownerId = trackOwnerRef.current.get(trackSid);
      const isScreen = trackSourceRef.current.get(trackSid) === 'screen';
      const vol = ownerId
        ? ((isScreen
            ? (state.streamVolumes[ownerId] ?? 100)
            : (state.userVolumes[ownerId] ?? 100)) / 100)
        : 1;
      audioElement.volume = Math.min(globalVol * vol, 1);
    }
  }, []);

  // React to deafen/volume changes
  useEffect(() => {
    applyVolumes();
  }, [selfDeafened, outputVolume, applyVolumes]);

  // Single combined subscribe for per-user volumes, stream volumes, and watchingStreams.
  // Avoids 3 separate subscriptions each evaluating on every store update.
  useEffect(() => {
    let prevUserVol = useVoiceStore.getState().userVolumes;
    let prevStreamVol = useVoiceStore.getState().streamVolumes;
    let prevWatching = useVoiceStore.getState().watchingStreams;

    const unsub = useVoiceStore.subscribe((state) => {
      let volumeChanged = false;

      if (state.userVolumes !== prevUserVol) {
        prevUserVol = state.userVolumes;
        volumeChanged = true;
      }
      if (state.streamVolumes !== prevStreamVol) {
        prevStreamVol = state.streamVolumes;
        volumeChanged = true;
      }
      if (volumeChanged) {
        applyVolumes();
      }

      if (state.watchingStreams !== prevWatching) {
        prevWatching = state.watchingStreams;
        const room = roomRef.current;
        if (!room || room.state !== ConnectionState.Connected) return;

        for (const [, participant] of room.remoteParticipants) {
          const isWatching = state.watchingStreams[participant.identity] !== false;
          for (const pub of participant.trackPublications.values()) {
            if (
              (pub.source === Track.Source.ScreenShare ||
               pub.source === Track.Source.ScreenShareAudio) &&
              'setSubscribed' in pub
            ) {
              (pub as RemoteTrackPublication).setSubscribed(isWatching);
            }
          }
        }
      }
    });
    return unsub;
  }, [applyVolumes]);

  // Sync input device to LiveKit + notify pipeline of device change
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    if (inputDeviceId && inputDeviceId !== 'default') {
      room.switchActiveDevice('audioinput', inputDeviceId)
        .then(() => {
          // Notify pipeline to re-apply processor after device change
          pipelineRef.current?.handleDeviceChange(inputDeviceId);
        })
        .catch(console.error);
    }
  }, [inputDeviceId]);

  // Sync output device to all audio elements
  useEffect(() => {
    if (!outputDeviceId || outputDeviceId === 'default') return;
    for (const audioElement of audioElementsRef.current.values()) {
      if (typeof audioElement.setSinkId === 'function') {
        audioElement.setSinkId(outputDeviceId).catch(console.error);
      }
    }
  }, [outputDeviceId]);

  // Switch audio processing mode at runtime via AudioPipeline.
  // The pipeline handles EC boundary detection, constraint changes, and processor swaps.
  const prevAudioModeRef = useRef<AudioMode | null>(null);
  const pendingModeRef = useRef<AudioMode | null>(null);
  useEffect(() => {
    const room = roomRef.current;
    const pipeline = pipelineRef.current;
    if (!room || room.state !== ConnectionState.Connected || !pipeline) return;

    const prevMode = prevAudioModeRef.current;
    prevAudioModeRef.current = audioMode;

    // Detect EC boundary cross for reconfigure flag
    if (prevMode !== null) {
      const platform: AudioPlatform = getPlatformProvider().isDesktop ? 'desktop' : 'browser';
      if (requiresRepublish(platform, prevMode, audioMode)) {
        useVoiceStore.getState().setAudioReconfigureRequired(true);
      }
    }

    // If muted, defer the mode change until unmute
    if (useVoiceStore.getState().selfMuted) {
      pendingModeRef.current = audioMode;
      return;
    }

    pendingModeRef.current = null;
    pipeline.requestMode(audioMode);
    console.debug(`[Audio] Requested mode switch to ${audioMode}`);
  }, [audioMode]);

  // Sync inputVolume to pipeline gain
  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;
    pipeline.setInputGain(inputVolume / 100);
  }, [inputVolume]);

  // Sync RNNoise compensation gain to the active processor
  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline || !rnnoiseGain) return;
    pipeline.setRnnoiseGain?.(rnnoiseGain);
  }, [rnnoiseGain]);

  // Sync camera enabled state to LiveKit
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.setCameraEnabled(cameraEnabled, {
      resolution: VideoPresets.h1080.resolution,
      deviceId: videoDeviceId !== 'default' ? videoDeviceId : undefined,
    }).catch((err) => {
      console.warn('[LiveKit] Camera toggle failed:', err);
      const store = useVoiceStore.getState();
      store.setCameraEnabled(false);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        store.setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err instanceof Error && err.name === 'NotFoundError') {
        store.setError('No camera found. Please connect a camera and try again.');
      }
    });
  }, [cameraEnabled]); // videoDeviceId is handled by switchActiveDevice below

  // Sync screen share state to LiveKit
  // Note: screenShareQuality is read from store at start time, NOT in deps.
  // Changing quality requires stopping and restarting the share.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    if (screenShareEnabled) {
      // Read quality from store at start time (not reactive — avoids re-prompting)
      const quality = useVoiceStore.getState().screenShareQuality;
      const presets = {
        '720p30': { width: 1280, height: 720, fps: 30, maxBitrate: 2_500_000 },
        '1080p30': { width: 1920, height: 1080, fps: 30, maxBitrate: 4_000_000 },
        '1080p60': { width: 1920, height: 1080, fps: 60, maxBitrate: 6_000_000 },
      } as const;
      const preset = presets[quality as keyof typeof presets] ?? presets['1080p30'];

      const wantAudio = useVoiceStore.getState().screenShareAudio;

      const captureOpts = (audio: boolean) => ({
        contentHint: (preset.fps >= 60 ? 'motion' : 'detail') as 'motion' | 'detail',
        audio,
        suppressLocalAudioPlayback: true,
        selfBrowserSurface: 'exclude' as const,
        surfaceSwitching: 'include' as const,
        systemAudio: 'include' as const,
        preferCurrentTab: false,
      });

      const publishOpts = {
        simulcast: false,
        videoEncoding: {
          maxBitrate: preset.maxBitrate,
          maxFramerate: preset.fps,
        },
        audioPreset: AudioPresets.musicHighQualityStereo,
        dtx: false,
      };

      const listenForEnd = () => {
        const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (screenPub?.track) {
          screenPub.track.on('ended', () => {
            if (Date.now() >= screenShareReconnectUntil.current) {
              console.warn('[LiveKit] Screen share track ended unexpectedly');
              useVoiceStore.getState().setScreenShareEnabled(false);
            }
          });
        }
      };

      room.localParticipant.setScreenShareEnabled(true, captureOpts(wantAudio), publishOpts)
        .then(listenForEnd)
        .catch((err) => {
          // If audio was requested and it failed, retry without audio.
          // Some systems can't capture system audio (no loopback device, permissions, etc.)
          if (wantAudio) {
            console.warn('[LiveKit] Screen share with audio failed, retrying without audio:', err);
            room.localParticipant.setScreenShareEnabled(true, captureOpts(false), publishOpts)
              .then(listenForEnd)
              .catch((retryErr) => {
                console.warn('[LiveKit] Screen share failed entirely:', retryErr);
                useVoiceStore.getState().setScreenShareEnabled(false);
              });
          } else {
            console.warn('[LiveKit] Screen share failed:', err);
            useVoiceStore.getState().setScreenShareEnabled(false);
          }
        });
    } else {
      room.localParticipant.setScreenShareEnabled(false).catch(console.error);
    }
  }, [screenShareEnabled]);

  // Sync video device change
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    if (!cameraEnabled) return;
    if (videoDeviceId && videoDeviceId !== 'default') {
      room.switchActiveDevice('videoinput', videoDeviceId).catch(console.error);
    }
  }, [videoDeviceId, cameraEnabled]);

  // Auto-disconnect when alone in channel for 5 minutes
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    const ALONE_TIMEOUT_SEC = getPlatformProvider().aloneTimeoutSec;

    const checkAlone = () => {
      const remoteCount = room.remoteParticipants.size;
      if (remoteCount === 0) {
        // Already counting down — don't restart
        if (aloneTimerRef.current) return;
        // Start countdown
        let remaining = ALONE_TIMEOUT_SEC;
        setAloneTimeout(remaining);
        aloneTimerRef.current = setInterval(() => {
          remaining -= 1;
          setAloneTimeout(remaining);
          if (remaining <= 0) {
            // Auto-disconnect
            if (aloneTimerRef.current) clearInterval(aloneTimerRef.current);
            aloneTimerRef.current = null;
            setAloneTimeout(null);
            // Trigger leave via store disconnect + room cleanup
            const room = roomRef.current;
            if (room) {
              room.disconnect();
              room.removeAllListeners();
            }
            for (const el of audioElementsRef.current.values()) {
              try { el.pause(); el.remove(); } catch { /* ignore cleanup errors */ }
            }
            audioElementsRef.current.clear();
            trackOwnerRef.current.clear();
            roomRef.current = null;
            setVideoTracks({});
            disconnect();
          }
        }, 1000);
      } else {
        // Cancel countdown
        if (aloneTimerRef.current) {
          clearInterval(aloneTimerRef.current);
          aloneTimerRef.current = null;
        }
        setAloneTimeout(null);
      }
    };

    // Check on participant changes
    room.on(RoomEvent.ParticipantConnected, checkAlone);
    room.on(RoomEvent.ParticipantDisconnected, checkAlone);

    // Initial check
    checkAlone();

    return () => {
      room.off(RoomEvent.ParticipantConnected, checkAlone);
      room.off(RoomEvent.ParticipantDisconnected, checkAlone);
      if (aloneTimerRef.current) {
        clearInterval(aloneTimerRef.current);
        aloneTimerRef.current = null;
      }
      setAloneTimeout(null);
    };
  }, [livekitToken, livekitUrl, currentChannelId]);

  const disconnectRoom = useCallback(() => {
    if (credentialTimeoutRef.current) {
      clearTimeout(credentialTimeoutRef.current);
      credentialTimeoutRef.current = null;
    }
    // Stop custom VAD
    if (vadAnimFrameRef.current) {
      cancelAnimationFrame(vadAnimFrameRef.current);
      vadAnimFrameRef.current = 0;
    }
    if (vadContextRef.current) {
      vadContextRef.current.close().catch(() => {});
      vadContextRef.current = null;
    }
    if (pipelineRef.current) {
      pipelineRef.current.dispose();
      pipelineRef.current = null;
    }
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      room.removeAllListeners();
      for (const audioElement of audioElementsRef.current.values()) {
        try {
          audioElement.pause();
          audioElement.remove();
        } catch {
          // ignore cleanup failures
        }
      }
      audioElementsRef.current.clear();
      trackOwnerRef.current.clear();
      roomRef.current = null;
    }
    setVideoTracks({});
    disconnect();
  }, [disconnect]);

  return { room: roomRef, disconnectRoom, videoTracks };
}
