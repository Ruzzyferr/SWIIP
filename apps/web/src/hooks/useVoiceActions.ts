'use client';

import { useCallback } from 'react';
import { OpCode } from '@constchat/protocol';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { useVoiceStore } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';

/**
 * Provides actions for joining/leaving voice channels and toggling mute/deafen.
 * Communicates with the gateway via the existing GatewayClient singleton.
 */
export function useVoiceActions() {
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const setCurrentChannel = useVoiceStore((s) => s.setCurrentChannel);
  const setConnectionState = useVoiceStore((s) => s.setConnectionState);
  const setSelfMuted = useVoiceStore((s) => s.setSelfMuted);
  const setSelfDeafened = useVoiceStore((s) => s.setSelfDeafened);
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
        gw.send(OpCode.DISPATCH, { t: 'VOICE_LEAVE', d: {} });
      }

      setCurrentChannel(channelId, guildId);
      setConnectionState('connecting');

      // Send VOICE_JOIN — the gateway will respond with VOICE_SERVER_UPDATE
      gw.send(OpCode.DISPATCH, { t: 'VOICE_JOIN', d: { channelId } });
    },
    [currentChannelId, setCurrentChannel, setConnectionState]
  );

  const leaveVoiceChannel = useCallback(() => {
    if (!currentChannelId) return;
    const gw = getGatewayClient();
    gw.send(OpCode.DISPATCH, { t: 'VOICE_LEAVE', d: {} });
    voiceDisconnect();
  }, [currentChannelId, voiceDisconnect]);

  const toggleMute = useCallback(() => {
    const newMuted = !selfMuted;
    setSelfMuted(newMuted);
    const gw = getGatewayClient();
    gw.send(OpCode.VOICE_STATE_UPDATE, {
      selfMute: newMuted,
      selfDeaf: selfDeafened,
    });
  }, [selfMuted, selfDeafened, setSelfMuted]);

  const toggleDeafen = useCallback(() => {
    const newDeafened = !selfDeafened;
    setSelfDeafened(newDeafened);
    // If deafening, also mute
    const newMuted = newDeafened ? true : selfMuted;
    if (newDeafened && !selfMuted) {
      setSelfMuted(true);
    }
    // If un-deafening, also unmute
    if (!newDeafened && selfMuted) {
      setSelfMuted(false);
    }
    const gw = getGatewayClient();
    gw.send(OpCode.VOICE_STATE_UPDATE, {
      selfMute: newDeafened ? true : !selfMuted ? false : selfMuted,
      selfDeaf: newDeafened,
    });
  }, [selfDeafened, selfMuted, setSelfDeafened, setSelfMuted]);

  return {
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
  };
}
