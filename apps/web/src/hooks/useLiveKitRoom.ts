'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  ConnectionState,
  Track,
  VideoPresets,
  RemoteAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type LocalParticipant,
  type LocalTrackPublication,
  type Participant,
  type TrackPublication,
} from 'livekit-client';
import { OpCode, ClientEventType } from '@constchat/protocol';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import { playJoinSound, playLeaveSound } from '@/lib/sounds';

// Krisp noise filter — lazy loaded to avoid "Worker is not defined" during SSR/prerender.
// The type is inferred as `any` since we can't statically import the type without triggering
// the Worker instantiation at module level.
let krispProcessor: any = null;
async function getKrispProcessor(): Promise<any> {
  if (!krispProcessor) {
    const { KrispNoiseFilter } = await import('@livekit/krisp-noise-filter');
    krispProcessor = KrispNoiseFilter();
  }
  return krispProcessor;
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
  const credentialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const trackOwnerRef = useRef<Map<string, string>>(new Map()); // trackSid -> userId
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
  const noiseSuppression = useVoiceStore((s) => s.settings.noiseSuppression);
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

    const krispEnabled = useVoiceStore.getState().settings.noiseSuppression;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        // Disable simulcast for screen share — send one high-quality stream
        screenShareSimulcastLayers: [],
        screenShareEncoding: {
          maxBitrate: 8_000_000,
          maxFramerate: 30,
        },
      },
      audioCaptureDefaults: {
        echoCancellation: true,
        // Browser-level NS disabled — Krisp handles it
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    roomRef.current = room;

    const detachAudio = (trackSid: string) => {
      const existing = audioElementsRef.current.get(trackSid);
      if (existing) {
        try {
          existing.pause();
          existing.remove();
        } catch {
          // ignore cleanup failures
        }
        audioElementsRef.current.delete(trackSid);
        trackOwnerRef.current.delete(trackSid);
      }
    };

    const attachAudio = async (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const trackSid = track.sid ?? `${Date.now()}-${Math.random()}`;
      detachAudio(trackSid);
      const element = track.attach() as HTMLAudioElement;
      element.autoplay = true;
      element.setAttribute('playsinline', 'true');
      element.muted = false;
      const currentDeafened = useVoiceStore.getState().selfDeafened;
      const currentOutputVol = useVoiceStore.getState().settings.outputVolume;
      element.volume = currentDeafened ? 0 : Math.min(currentOutputVol / 100, 1);
      document.body.appendChild(element);
      audioElementsRef.current.set(trackSid, element);
      try {
        await element.play();
      } catch {
        // Fallback for browsers that gate autoplay until explicit gesture.
        room.startAudio().catch(() => {});
      }
    };

    // Per-participant speaking detection (instant, no batching delay)
    const bindSpeakingListener = (participant: Participant) => {
      participant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        if (!currentChannelId) return;
        setSpeaking(currentChannelId, participant.identity, speaking);
      });
    };

    // --- Event handlers ---
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
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
          break;
        case ConnectionState.Reconnecting:
          setConnectionState('reconnecting');
          break;
        case ConnectionState.Disconnected:
          setConnectionState('disconnected');
          break;
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      console.debug('[LiveKit] Disconnected from room');
      for (const sid of audioElementsRef.current.keys()) {
        detachAudio(sid);
      }
    });

    // Connection quality monitoring
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      // Only track local participant's quality for the UI indicator
      if (participant.isLocal) {
        // ConnectionQuality enum: 0=LOST, 1=POOR, 2=GOOD, 3=EXCELLENT
        setConnectionQuality(quality as unknown as number);
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
      const vs = useVoiceStore.getState();
      if (!vs.selfDeafened && vs.settings.notificationSounds) {
        playJoinSound();
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (!currentChannelId) return;
      removeParticipant(currentChannelId, participant.identity);
      const vs = useVoiceStore.getState();
      if (!vs.selfDeafened && vs.settings.notificationSounds) {
        playLeaveSound();
      }
    });

    room.on(
      RoomEvent.TrackSubscribed,
      async (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio && track.sid) {
          trackOwnerRef.current.set(track.sid, participant.identity);
        }
        if (track.kind === Track.Kind.Video) {
          const isScreen = publication.source === Track.Source.ScreenShare;
          updateVideoTrack(
            participant.identity,
            isScreen ? 'screen' : 'camera',
            track.mediaStreamTrack,
          );
          if (currentChannelId) {
            if (isScreen) {
              setParticipantScreenShare(currentChannelId, participant.identity, true);
            } else {
              setParticipantVideo(currentChannelId, participant.identity, true);
            }
          }
        }
        await attachAudio(track);
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
        if (currentChannelId) {
          if (isScreen) {
            setParticipantScreenShare(currentChannelId, participant.identity, false);
          } else {
            setParticipantVideo(currentChannelId, participant.identity, false);
          }
        }
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
        // Clear selfVideo flag so the VideoGrid tile is properly removed
        if (currentChannelId) {
          setParticipantVideo(currentChannelId, participant.identity, false);
        }
      } else if (publication.source === Track.Source.ScreenShare) {
        updateVideoTrack(participant.identity, 'screen', undefined);
        if (currentChannelId) {
          setParticipantScreenShare(currentChannelId, participant.identity, false);
        }
        // If screen share was stopped externally (e.g. browser "Stop sharing"), sync store + notify gateway
        useVoiceStore.getState().setScreenShareEnabled(false);
        const gw = getGatewayClient();
        gw.send(OpCode.DISPATCH, { t: ClientEventType.SCREEN_SHARE_STOP, d: {} });
      }
    });

    // Connect — use Google STUN for local dev (avoids Twilio DNS errors)
    setConnectionState('connecting');
    room
      .connect(livekitUrl, livekitToken, {
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      })
      .then(async () => {
        console.debug('[LiveKit] Connected successfully');
        await room.startAudio().catch(() => {});

        // Try to publish microphone — handle permission denial gracefully
        try {
          await room.localParticipant.setMicrophoneEnabled(true, {
            // Browser-level NS disabled — Krisp processor handles noise suppression
            noiseSuppression: false,
            echoCancellation: true,
            autoGainControl: true,
          });
        } catch (micErr) {
          console.warn('[LiveKit] Microphone access denied or failed — joining muted', micErr);
          // Still connected, just muted
          useVoiceStore.getState().setSelfMuted(true);
        }

        // Apply Krisp noise filter after mic is published
        if (krispEnabled) {
          try {
            const krisp = await getKrispProcessor();
            const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
            const audioTrack = micPub?.audioTrack;
            if (audioTrack) {
              await audioTrack.setProcessor(krisp);
              console.debug('[LiveKit] Krisp noise filter applied');
            }
          } catch (err) {
            console.warn('[LiveKit] Krisp init failed:', err);
          }
        }

        // Register self as participant + bind speaking listener
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
          bindSpeakingListener(room.localParticipant);
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

    return () => {
      console.debug('[LiveKit] Cleaning up room');
      room.disconnect();
      room.removeAllListeners();
      for (const sid of audioElementsRef.current.keys()) {
        detachAudio(sid);
      }
      roomRef.current = null;
      setVideoTracks({});
    };
  }, [livekitToken, livekitUrl, currentChannelId]);

  // Sync mute state to LiveKit
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.setMicrophoneEnabled(!selfMuted).catch(console.error);
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
    for (const [, participant] of room.remoteParticipants) {
      const userVol = (state.userVolumes[participant.identity] ?? 100) / 100;
      const finalVol = globalVol * userVol;
      for (const pub of participant.audioTrackPublications.values()) {
        if (pub.track && pub.track instanceof RemoteAudioTrack) {
          pub.track.setVolume(finalVol);
        }
      }
    }

    // Also update raw HTMLAudioElement volumes as fallback
    for (const [trackSid, audioElement] of audioElementsRef.current.entries()) {
      const ownerId = trackOwnerRef.current.get(trackSid);
      const userVol = ownerId ? (state.userVolumes[ownerId] ?? 100) / 100 : 1;
      audioElement.volume = Math.min(globalVol * userVol, 1);
    }
  }, []);

  // React to deafen/volume changes
  useEffect(() => {
    applyVolumes();
  }, [selfDeafened, outputVolume, applyVolumes]);

  // Subscribe to per-user volume changes (not reactive via hook)
  useEffect(() => {
    let prev = useVoiceStore.getState().userVolumes;
    const unsub = useVoiceStore.subscribe((state) => {
      if (state.userVolumes !== prev) {
        prev = state.userVolumes;
        applyVolumes();
      }
    });
    return unsub;
  }, [applyVolumes]);

  // Sync input device to LiveKit
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    if (inputDeviceId && inputDeviceId !== 'default') {
      room.switchActiveDevice('audioinput', inputDeviceId).catch(console.error);
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

  // Toggle Krisp noise suppression at runtime
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const localAudioTrack = micPub?.audioTrack;
    if (!localAudioTrack) return;

    if (noiseSuppression) {
      getKrispProcessor().then((krisp) => {
        return localAudioTrack.setProcessor(krisp);
      }).then(() => {
        console.debug('[LiveKit] Krisp noise filter enabled');
      }).catch((err) => {
        console.warn('[LiveKit] Krisp enable failed:', err);
      });
    } else {
      // Stop processor — destroy and recreate next time
      const existing = localAudioTrack.getProcessor();
      if (existing) {
        existing.destroy().then(() => {
          krispProcessor = null; // reset singleton so a fresh one is created next enable
          console.debug('[LiveKit] Krisp noise filter disabled');
        }).catch((err) => {
          console.warn('[LiveKit] Krisp disable failed:', err);
        });
      }
    }
  }, [noiseSuppression]);

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
        '720p30': { width: 1280, height: 720, fps: 30, maxBitrate: 5_000_000 },
        '1080p30': { width: 1920, height: 1080, fps: 30, maxBitrate: 8_000_000 },
        '1080p60': { width: 1920, height: 1080, fps: 60, maxBitrate: 12_000_000 },
      } as const;
      const preset = presets[quality as keyof typeof presets] ?? presets['1080p30'];

      const wantAudio = useVoiceStore.getState().screenShareAudio;
      room.localParticipant.setScreenShareEnabled(true, {
        // Capture options — don't constrain resolution, let browser capture at native resolution
        contentHint: preset.fps >= 60 ? 'motion' : 'detail',
        audio: wantAudio,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: 'include',
        preferCurrentTab: false,
      }, {
        // Publish options — disable simulcast so remote gets full resolution
        simulcast: false,
        videoEncoding: {
          maxBitrate: preset.maxBitrate,
          maxFramerate: preset.fps,
        },
        // Screen share audio enabled when requested
      }).catch((err) => {
        console.warn('[LiveKit] Screen share failed:', err);
        useVoiceStore.getState().setScreenShareEnabled(false);
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

    const ALONE_TIMEOUT_SEC = 300; // 5 minutes

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
              try { el.pause(); el.remove(); } catch {}
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
