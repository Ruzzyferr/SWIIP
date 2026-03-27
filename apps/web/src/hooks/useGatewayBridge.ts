'use client';

import { useEffect, useRef } from 'react';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { setAccessToken } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useGatewayStore } from '@/stores/gateway.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useMessagesStore } from '@/stores/messages.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useDMsStore } from '@/stores/dms.store';
import { getGuildMembers, getGuildMember } from '@/lib/api/guilds.api';
import { toastError, toastInfo } from '@/lib/toast';

/**
 * Wires the singleton GatewayClient events into Zustand stores.
 * Mount this once in the authenticated app shell.
 */
export function useGatewayBridge() {
  const bridged = useRef(false);

  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const setGatewayStatus = useGatewayStore((s) => s.setStatus);
  const setGatewaySessionId = useGatewayStore((s) => s.setSessionId);
  const resetGateway = useGatewayStore((s) => s.reset);

  const setGuilds = useGuildsStore((s) => s.setGuilds);
  const setGuild = useGuildsStore((s) => s.setGuild);
  const updateGuild = useGuildsStore((s) => s.updateGuild);
  const removeGuild = useGuildsStore((s) => s.removeGuild);
  const setChannel = useGuildsStore((s) => s.setChannel);
  const updateChannel = useGuildsStore((s) => s.updateChannel);
  const removeChannel = useGuildsStore((s) => s.removeChannel);
  const setMember = useGuildsStore((s) => s.setMember);
  const setMembers = useGuildsStore((s) => s.setMembers);
  const updateMember = useGuildsStore((s) => s.updateMember);
  const removeMember = useGuildsStore((s) => s.removeMember);

  const addMessage = useMessagesStore((s) => s.addMessage);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const removeMessage = useMessagesStore((s) => s.removeMessage);

  const setPresence = usePresenceStore((s) => s.setPresence);
  const setTyping = usePresenceStore((s) => s.setTyping);

  const setConversations = useDMsStore((s) => s.setConversations);

  useEffect(() => {
    if (!accessToken || bridged.current) return;
    bridged.current = true;

    const gw = getGatewayClient();

    // Sync access token for API calls
    setAccessToken(accessToken);

    // --- Connection lifecycle ---
    gw.on('connected', () => {
      setGatewayStatus('connected');
    });

    gw.on('disconnected', (code, _reason) => {
      setGatewayStatus('disconnected');

      // Session invalidated — gateway store should reflect the reset
      if (code === 4009 || code === 4007) {
        setGatewaySessionId(null);
      }

      // Auth failure — force logout and redirect to login
      if (code === 4004) {
        toastError('Session expired. Please log in again.');
        setAccessToken(null);
        logout();
        window.location.href = '/login';
      }
    });

    gw.on('reconnecting', () => {
      setGatewayStatus('reconnecting');
      toastInfo('Reconnecting to server...');
    });

    // --- READY ---
    gw.on('ready', (data) => {
      setUser(data.user);
      setGatewaySessionId(data.sessionId);
      setGuilds(data.guilds);
      if (data.dms) {
        setConversations(data.dms);
      }
      setGatewayStatus('connected');

      // Ensure member maps are loaded even if READY payload omits full members.
      for (const guild of data.guilds) {
        getGuildMembers(guild.id)
          .then((members) => setMembers(guild.id, members))
          .catch(() => {
            // Non-fatal; sidebar can still hydrate via realtime updates.
          });
      }
    });

    gw.on('resumed', () => {
      setGatewayStatus('connected');
    });

    gw.on('invalid_session', (resumable) => {
      if (!resumable) {
        resetGateway();
      }
    });

    // --- Messages ---
    gw.on('message_create', (data) => {
      addMessage(data.message.channelId, data.message);
    });

    gw.on('message_update', (data) => {
      updateMessage(data.channelId, data.id, data);
    });

    gw.on('message_delete', (data) => {
      removeMessage(data.channelId, data.messageId);
    });

    // --- Typing ---
    gw.on('typing_start', (data) => {
      setTyping(data.channelId, data.userId, data.timestamp);
    });

    // --- Presence ---
    gw.on('presence_update', (data) => {
      setPresence(data.userId, {
        status: data.status,
        ...(data.customStatus != null && { customStatus: data.customStatus }),
        ...(data.activities != null && { activities: data.activities }),
      });
    });

    // --- Guilds ---
    gw.on('guild_create', (data) => {
      setGuild(data.guild);
    });

    gw.on('guild_update', (data) => {
      updateGuild(data.id, data);
    });

    gw.on('guild_delete', (data) => {
      removeGuild(data.guildId);
    });

    // --- Members ---
    gw.on('member_add', (data) => {
      if (data.member) {
        setMember(data.guildId, data.member);
        return;
      }
      // Backward compatibility for payloads that still send only userId.
      const fallbackUserId = (data as { userId?: string }).userId;
      if (!fallbackUserId) return;
      getGuildMember(data.guildId, fallbackUserId)
        .then((member) => setMember(data.guildId, member))
        .catch(() => {
          // ignore; next state event will reconcile
        });
    });

    gw.on('member_update', (data) => {
      updateMember(data.guildId, data.member.userId, data.member);
    });

    gw.on('member_remove', (data) => {
      removeMember(data.guildId, data.userId);
    });

    // --- Channels ---
    gw.on('channel_create', (data) => {
      setChannel(data.channel);
    });

    gw.on('channel_update', (data) => {
      updateChannel(data.id, data);
    });

    gw.on('channel_delete', (data) => {
      removeChannel(data.channelId);
    });

    // --- Voice ---
    gw.on('voice_state_update', (data) => {
      const voiceStore = useVoiceStore.getState();
      if (data.channelId) {
        voiceStore.setParticipant({
          userId: data.userId,
          channelId: data.channelId,
          selfMute: data.selfMute,
          selfDeaf: data.selfDeaf,
          serverMute: data.serverMute,
          serverDeaf: data.serverDeaf,
          speaking: data.speaking,
        });
      } else {
        // User left voice — remove from all channels
        const participants = Object.values(voiceStore.participants).filter(
          (p) => p.userId === data.userId
        );
        for (const p of participants) {
          voiceStore.removeParticipant(p.channelId, data.userId);
        }
      }
    });

    gw.on('voice_server_update', (data) => {
      console.debug('[Gateway] voice_server_update received', { endpoint: data.endpoint, hasToken: !!data.token });
      const voiceStore = useVoiceStore.getState();
      voiceStore.setLivekitCredentials(data.token, data.endpoint);
    });

    // --- Error ---
    gw.on('error', (code, message) => {
      console.error(`[Gateway] Error ${code}: ${message}`);
      if (code === 4999) {
        toastError('Unable to connect to server. Please refresh the page.');
      } else if (code !== 4004) {
        // 4004 is handled in the disconnected event
        toastError(`Connection error: ${message}`);
      }

      // If voice is in connecting state, reset it so the UI doesn't stay stuck
      const voiceState = useVoiceStore.getState();
      if (voiceState.connectionState === 'connecting') {
        voiceState.setError(message);
      }
    });

    // Connect
    setGatewayStatus('connecting');
    gw.connect(accessToken);

    return () => {
      bridged.current = false;
      gw.disconnect();
      gw.removeAllListeners();
      resetGateway();
    };
  }, [accessToken]);

  // Prune stale typing indicators
  useEffect(() => {
    const pruneStaleTyping = usePresenceStore.getState().pruneStaleTyping;
    const interval = setInterval(pruneStaleTyping, 3000);
    return () => clearInterval(interval);
  }, []);
}
