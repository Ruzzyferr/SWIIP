'use client';

import { useCallback } from 'react';
import { OpCode, ClientEventType } from '@constchat/protocol';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { useVoiceStore, type ScreenShareQuality } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { playDisconnectSound } from '@/lib/sounds';

/**
 * Provides actions for joining/leaving voice channels and toggling mute/deafen/camera/screenshare.
 * Communicates with the gateway via the existing GatewayClient singleton.
 */
export function useVoiceActions() {
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const cameraEnabled = useVoiceStore((s) => s.cameraEnabled);
  const screenShareEnabled = useVoiceStore((s) => s.screenShareEnabled);
  const setCurrentChannel = useVoiceStore((s) => s.setCurrentChannel);
  const setConnectionState = useVoiceStore((s) => s.setConnectionState);
  const setSelfMuted = useVoiceStore((s) => s.setSelfMuted);
  const setSelfDeafened = useVoiceStore((s) => s.setSelfDeafened);
  const setCameraEnabled = useVoiceStore((s) => s.setCameraEnabled);
  const setScreenShareEnabled = useVoiceStore((s) => s.setScreenShareEnabled);
  const setScreenShareQuality = useVoiceStore((s) => s.setScreenShareQuality);
  const voiceDisconnect = useVoiceStore((s) => s.disconnect);

  const joinVoiceChannel = useCallback(
    (channelId: string) => {
      const gw = getGatewayClient();
      const channels = useGuildsStore.getState().channels;
      const channel = channels[channelId];
      const guildId = (channel as { guildId?: string })?.guildId ?? null;

      // If already in this channel, do nothing
      if (currentChannelId === channelId) return;

      // If in another channel, leave first
      if (currentChannelId) {
        console.debug('[Voice] Leaving current channel before joining new one');
        gw.send(OpCode.DISPATCH, { t: 'VOICE_LEAVE', d: {} });
      }

      console.debug('[Voice] Joining voice channel', { channelId, guildId });
      setCurrentChannel(channelId, guildId);
      setConnectionState('connecting');

      // Send VOICE_JOIN — the gateway will respond with VOICE_SERVER_UPDATE
      const sent = gw.send(OpCode.DISPATCH, { t: 'VOICE_JOIN', d: { channelId } });
      if (!sent) {
        console.error('[Voice] Failed to send VOICE_JOIN — gateway not connected');
        useVoiceStore.getState().setError('Not connected to server. Please try again.');
        return;
      }
      console.debug('[Voice] VOICE_JOIN sent to gateway');
    },
    [currentChannelId, setCurrentChannel, setConnectionState]
  );

  const leaveVoiceChannel = useCallback(() => {
    if (!currentChannelId) return;
    const gw = getGatewayClient();
    gw.send(OpCode.DISPATCH, { t: 'VOICE_LEAVE', d: {} });
    playDisconnectSound();
    voiceDisconnect();
  }, [currentChannelId, voiceDisconnect]);

  const toggleMute = useCallback(() => {
    const newMuted = !selfMuted;
    setSelfMuted(newMuted);
    const gw = getGatewayClient();
    gw.send(OpCode.VOICE_STATE_UPDATE, {
      selfMute: newMuted,
      selfDeaf: selfDeafened,
      selfVideo: cameraEnabled,
    });
  }, [selfMuted, selfDeafened, cameraEnabled, setSelfMuted]);

  const toggleDeafen = useCallback(() => {
    const newDeafened = !selfDeafened;
    setSelfDeafened(newDeafened);
    const newMuted = newDeafened ? true : false;
    setSelfMuted(newMuted);
    const gw = getGatewayClient();
    gw.send(OpCode.VOICE_STATE_UPDATE, {
      selfMute: newMuted,
      selfDeaf: newDeafened,
      selfVideo: cameraEnabled,
    });
  }, [selfDeafened, cameraEnabled, setSelfDeafened, setSelfMuted]);

  const toggleCamera = useCallback(() => {
    if (!currentChannelId) return;
    const newEnabled = !cameraEnabled;
    setCameraEnabled(newEnabled);
    const gw = getGatewayClient();
    gw.send(OpCode.VOICE_STATE_UPDATE, {
      selfMute: selfMuted,
      selfDeaf: selfDeafened,
      selfVideo: newEnabled,
    });
  }, [currentChannelId, cameraEnabled, selfMuted, selfDeafened, setCameraEnabled]);

  const toggleScreenShare = useCallback((quality?: ScreenShareQuality) => {
    if (!currentChannelId) return;

    // If a quality is explicitly passed while already sharing, stop then restart
    // with the new quality (screen share requires re-prompting the picker).
    if (quality && screenShareEnabled) {
      // Stop current share first
      setScreenShareEnabled(false);
      setScreenShareQuality(quality);
      // Re-enable in next tick so the effect fires with new quality
      setTimeout(() => {
        useVoiceStore.getState().setScreenShareEnabled(true);
        const gw = getGatewayClient();
        gw.send(OpCode.DISPATCH, {
          t: ClientEventType.SCREEN_SHARE_START,
          d: { channelId: currentChannelId, quality },
        });
      }, 100);
      return;
    }

    const newEnabled = !screenShareEnabled;
    if (quality) setScreenShareQuality(quality);
    setScreenShareEnabled(newEnabled);

    const gw = getGatewayClient();
    if (newEnabled) {
      gw.send(OpCode.DISPATCH, {
        t: ClientEventType.SCREEN_SHARE_START,
        d: { channelId: currentChannelId, quality: quality ?? useVoiceStore.getState().screenShareQuality },
      });
    } else {
      gw.send(OpCode.DISPATCH, {
        t: ClientEventType.SCREEN_SHARE_STOP,
        d: {},
      });
    }
  }, [currentChannelId, screenShareEnabled, setScreenShareEnabled, setScreenShareQuality]);

  return {
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
  };
}
