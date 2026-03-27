'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  ConnectionState,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type LocalParticipant,
  type Participant,
} from 'livekit-client';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import { playJoinSound, playLeaveSound, playDisconnectSound } from '@/lib/sounds';

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

  const livekitToken = useVoiceStore((s) => s.livekitToken);
  const livekitUrl = useVoiceStore((s) => s.livekitUrl);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const inputDeviceId = useVoiceStore((s) => s.settings.inputDeviceId);
  const outputDeviceId = useVoiceStore((s) => s.settings.outputDeviceId);
  const outputVolume = useVoiceStore((s) => s.settings.outputVolume);
  const setConnectionState = useVoiceStore((s) => s.setConnectionState);
  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const setParticipant = useVoiceStore((s) => s.setParticipant);
  const removeParticipant = useVoiceStore((s) => s.removeParticipant);
  const setError = useVoiceStore((s) => s.setError);
  const disconnect = useVoiceStore((s) => s.disconnect);
  const userId = useAuthStore((s) => s.user?.id);

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

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
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
      element.volume = selfDeafened ? 0 : 1;
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

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (!currentChannelId) return;
      setParticipant({
        userId: participant.identity,
        channelId: currentChannelId,
        selfMute: participant.isMicrophoneEnabled === false,
        selfDeaf: false,
        serverMute: false,
        serverDeaf: false,
        speaking: participant.isSpeaking,
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
      async (track: RemoteTrack, _publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
        await attachAudio(track);
      },
    );

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      if (track.sid) {
        detachAudio(track.sid);
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
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch (micErr) {
          console.warn('[LiveKit] Microphone access denied or failed — joining muted', micErr);
          // Still connected, just muted
          useVoiceStore.getState().setSelfMuted(true);
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
          });
          bindSpeakingListener(room.localParticipant);
        }

        // Register existing remote participants + bind speaking listeners
        for (const [, participant] of room.remoteParticipants) {
          if (currentChannelId) {
            setParticipant({
              userId: participant.identity,
              channelId: currentChannelId,
              selfMute: participant.isMicrophoneEnabled === false,
              selfDeaf: false,
              serverMute: false,
              serverDeaf: false,
              speaking: participant.isSpeaking,
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
    };
  }, [livekitToken, livekitUrl, currentChannelId]);

  // Sync mute state to LiveKit
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.setMicrophoneEnabled(!selfMuted).catch(console.error);
  }, [selfMuted]);

  // Sync deafen state + output volume — adjust all remote audio elements
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    const vol = selfDeafened ? 0 : Math.min(outputVolume / 100, 1);
    for (const audioElement of audioElementsRef.current.values()) {
      audioElement.volume = vol;
    }
  }, [selfDeafened, outputVolume]);

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
      roomRef.current = null;
    }
    disconnect();
  }, [disconnect]);

  return { room: roomRef, disconnectRoom };
}
