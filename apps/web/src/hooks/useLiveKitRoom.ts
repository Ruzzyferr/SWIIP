'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
  type RemoteParticipant,
  type LocalParticipant,
  type Participant,
} from 'livekit-client';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Manages the LiveKit Room instance lifecycle.
 * Connects/disconnects based on voice store credentials.
 * Syncs participant speaking state back to the voice store.
 */
export function useLiveKitRoom() {
  const roomRef = useRef<Room | null>(null);

  const livekitToken = useVoiceStore((s) => s.livekitToken);
  const livekitUrl = useVoiceStore((s) => s.livekitUrl);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const setConnectionState = useVoiceStore((s) => s.setConnectionState);
  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const setParticipant = useVoiceStore((s) => s.setParticipant);
  const removeParticipant = useVoiceStore((s) => s.removeParticipant);
  const setError = useVoiceStore((s) => s.setError);
  const disconnect = useVoiceStore((s) => s.disconnect);
  const userId = useAuthStore((s) => s.user?.id);

  // Connect to LiveKit when credentials are available
  useEffect(() => {
    if (!livekitToken || !livekitUrl || !currentChannelId) return;

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

    // --- Event handlers ---
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
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
      // Room fully disconnected
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
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (!currentChannelId) return;
      removeParticipant(currentChannelId, participant.identity);
    });

    room.on(
      RoomEvent.ActiveSpeakersChanged,
      (speakers: Participant[]) => {
        if (!currentChannelId) return;
        // Reset all speaking states for this channel, then set active ones
        const participants = useVoiceStore.getState().getChannelParticipants(currentChannelId);
        for (const p of participants) {
          const isSpeaking = speakers.some((s) => s.identity === p.userId);
          if (p.speaking !== isSpeaking) {
            setSpeaking(currentChannelId, p.userId, isSpeaking);
          }
        }
      }
    );

    room.on(RoomEvent.ConnectionQualityChanged, () => {
      // Could surface connection quality indicators in the future
    });

    // Connect
    setConnectionState('connecting');
    room
      .connect(livekitUrl, livekitToken)
      .then(async () => {
        // Publish microphone track (unmuted by default)
        await room.localParticipant.setMicrophoneEnabled(true);

        // Register self as participant
        if (currentChannelId && userId) {
          setParticipant({
            userId,
            channelId: currentChannelId,
            selfMute: false,
            selfDeaf: false,
            serverMute: false,
            serverDeaf: false,
            speaking: false,
          });
        }

        // Register existing remote participants
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
          }
        }
      })
      .catch((err) => {
        console.error('[LiveKit] Failed to connect:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to voice');
      });

    return () => {
      room.disconnect();
      room.removeAllListeners();
      roomRef.current = null;
    };
  }, [livekitToken, livekitUrl, currentChannelId]);

  // Sync mute state to LiveKit
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.setMicrophoneEnabled(!selfMuted).catch(console.error);
  }, [selfMuted]);

  // Sync deafen state — mute all remote audio tracks
  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    for (const [, participant] of room.remoteParticipants) {
      for (const pub of participant.audioTrackPublications.values()) {
        if (pub.track && pub.track.mediaStreamTrack) {
          pub.track.mediaStreamTrack.enabled = !selfDeafened;
        }
      }
    }
  }, [selfDeafened]);

  const disconnectRoom = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      room.removeAllListeners();
      roomRef.current = null;
    }
    disconnect();
  }, [disconnect]);

  return { room: roomRef, disconnectRoom };
}
