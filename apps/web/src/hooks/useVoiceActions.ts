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
  // All toggle callbacks use useVoiceStore.getState() internally for stable references.
  // This prevents unnecessary re-renders and global shortcut re-registration on every state change.

  const joinVoiceChannel = useCallback(
    (channelId: string, isDM?: boolean) => {
      const gw = getGatewayClient();
      let guildId: string | null = null;
      if (!isDM) {
        const channels = useGuildsStore.getState().channels;
        const channel = channels[channelId];
        guildId = (channel as { guildId?: string })?.guildId ?? null;
      }
      const state = useVoiceStore.getState();

      // If already in this channel, do nothing
      if (state.currentChannelId === channelId) return;

      // If in another channel, leave first
      if (state.currentChannelId) {
        console.debug('[Voice] Leaving current channel before joining new one');
        gw.send(OpCode.DISPATCH, { t: 'VOICE_LEAVE', d: {} });
      }

      console.debug('[Voice] Joining voice channel', { channelId, guildId, isDM });
      state.setCurrentChannel(channelId, isDM ? 'dm' : guildId);
      state.setConnectionState('connecting');

      // Send VOICE_JOIN — the gateway will respond with VOICE_SERVER_UPDATE
      const sent = gw.send(OpCode.DISPATCH, { t: 'VOICE_JOIN', d: { channelId } });
      if (!sent) {
        console.error('[Voice] Failed to send VOICE_JOIN — gateway not connected');
        useVoiceStore.getState().setError('Not connected to server. Please try again.');
        return;
      }
      console.debug('[Voice] VOICE_JOIN sent to gateway');
    },
    []
  );

  const leaveVoiceChannel = useCallback(() => {
    const state = useVoiceStore.getState();
    if (!state.currentChannelId) return;
    const gw = getGatewayClient();
    gw.send(OpCode.DISPATCH, { t: 'VOICE_LEAVE', d: {} });
    playDisconnectSound();
    state.disconnect();
  }, []);

  // Use getState() inside callbacks to avoid re-creating on every mute/deafen change.
  // This keeps callback references stable, preventing unnecessary re-renders and
  // global shortcut re-registration in useVoiceKeyboardShortcuts.
  const toggleMute = useCallback(() => {
    const state = useVoiceStore.getState();
    const newMuted = !state.selfMuted;
    state.setSelfMuted(newMuted);
    const gw = getGatewayClient();
    gw.send(OpCode.VOICE_STATE_UPDATE, {
      selfMute: newMuted,
      selfDeaf: state.selfDeafened,
      selfVideo: state.cameraEnabled,
    });
  }, []);

  const toggleDeafen = useCallback(() => {
    const state = useVoiceStore.getState();
    const newDeafened = !state.selfDeafened;
    // setSelfDeafened handles mute state preservation internally (Standard deafen behavior:
    // un-deafen restores previous mute state, not always unmute)
    state.setSelfDeafened(newDeafened);
    // Read the resulting mute state from store (setSelfDeafened may have changed it)
    const resultingMuted = useVoiceStore.getState().selfMuted;
    const gw = getGatewayClient();
    gw.send(OpCode.VOICE_STATE_UPDATE, {
      selfMute: resultingMuted,
      selfDeaf: newDeafened,
      selfVideo: state.cameraEnabled,
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    const state = useVoiceStore.getState();
    if (!state.currentChannelId) return;
    const newEnabled = !state.cameraEnabled;

    // Let LiveKit handle the camera permission prompt directly.
    // Don't do a test getUserMedia — it creates a race condition where
    // the device is released and LiveKit can't grab it fast enough.
    state.setCameraEnabled(newEnabled);
    const gw = getGatewayClient();
    gw.send(OpCode.VOICE_STATE_UPDATE, {
      selfMute: state.selfMuted,
      selfDeaf: state.selfDeafened,
      selfVideo: newEnabled,
    });
  }, []);

  const toggleScreenShare = useCallback((quality?: ScreenShareQuality, audio?: boolean) => {
    const state = useVoiceStore.getState();
    if (!state.currentChannelId) return;

    // Store audio preference
    if (audio !== undefined) {
      state.setScreenShareAudio(audio);
    }

    // If a quality is explicitly passed while already sharing, stop then restart
    // with the new quality (screen share requires re-prompting the picker).
    if (quality && state.screenShareEnabled) {
      state.setScreenShareEnabled(false);
      state.setScreenShareQuality(quality);
      setTimeout(() => {
        const s = useVoiceStore.getState();
        s.setScreenShareEnabled(true);
        const gw = getGatewayClient();
        gw.send(OpCode.DISPATCH, {
          t: ClientEventType.SCREEN_SHARE_START,
          d: { channelId: s.currentChannelId, quality },
        });
      }, 100);
      return;
    }

    const newEnabled = !state.screenShareEnabled;
    if (quality) state.setScreenShareQuality(quality);
    state.setScreenShareEnabled(newEnabled);

    const gw = getGatewayClient();
    if (newEnabled) {
      gw.send(OpCode.DISPATCH, {
        t: ClientEventType.SCREEN_SHARE_START,
        d: { channelId: state.currentChannelId, quality: quality ?? state.screenShareQuality },
      });
    } else {
      gw.send(OpCode.DISPATCH, {
        t: ClientEventType.SCREEN_SHARE_STOP,
        d: {},
      });
    }
  }, []);

  return {
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
  };
}
