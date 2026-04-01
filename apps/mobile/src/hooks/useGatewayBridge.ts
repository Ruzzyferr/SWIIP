import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { OpCode } from '@constchat/protocol';
import { getGatewayClient } from '@/lib/gateway';
import {
  useAuthStore,
  useGatewayStore,
  useGuildsStore,
  useMessagesStore,
  usePresenceStore,
  useVoiceStore,
  useDMsStore,
  useFriendsStore,
} from '@/lib/stores';

/**
 * Wires the GatewayClient events into Zustand stores.
 * Mount once in the authenticated app shell.
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
  const updateGuild = useGuildsStore((s) => s.updateGuild);
  const removeGuild = useGuildsStore((s) => s.removeGuild);
  const setGuild = useGuildsStore((s) => s.setGuild);
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
  const addReactionToMessage = useMessagesStore((s) => s.addReactionToMessage);
  const removeReactionFromMessage = useMessagesStore((s) => s.removeReactionFromMessage);

  const setPresence = usePresenceStore((s) => s.setPresence);
  const setPresences = usePresenceStore((s) => s.setPresences);
  const setTyping = usePresenceStore((s) => s.setTyping);

  const setConversations = useDMsStore((s) => s.setConversations);
  const addConversation = useDMsStore((s) => s.addConversation);

  useEffect(() => {
    if (!accessToken || bridged.current) return;
    bridged.current = true;

    const gw = getGatewayClient();

    // --- Connection lifecycle ---
    gw.on('disconnected', (code) => {
      setGatewayStatus('disconnected');

      if (code === 4009 || code === 4007) {
        setGatewaySessionId(null);
      }

      // Auth failure — force logout
      if (code === 4004) {
        logout();
      }
    });

    gw.on('reconnecting', () => {
      setGatewayStatus('reconnecting');
    });

    gw.on('connected', () => {
      setGatewayStatus('connected');
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

      // Voice states
      if (data.voiceStates && Array.isArray(data.voiceStates)) {
        const voiceStore = useVoiceStore.getState();
        for (const vs of data.voiceStates) {
          if (vs.channelId) {
            voiceStore.setParticipant({
              userId: vs.userId,
              channelId: vs.channelId,
              selfMute: vs.selfMute,
              selfDeaf: vs.selfDeaf,
              serverMute: vs.serverMute,
              serverDeaf: vs.serverDeaf,
              speaking: vs.speaking,
              selfVideo: vs.selfVideo ?? false,
              screenSharing: vs.screenShare ?? false,
            });
          }
        }
      }

      // Read states
      if (data.readStates && Array.isArray(data.readStates)) {
        const messagesStore = useMessagesStore.getState();
        for (const rs of data.readStates) {
          if (rs.lastReadMessageId) {
            messagesStore.setLastRead(rs.channelId, rs.lastReadMessageId);
          }
          if (rs.mentionCount > 0) {
            messagesStore.setMentionCount(rs.channelId, rs.mentionCount);
          }
        }
      }

      // Friend presences
      if (data.friendPresences && Array.isArray(data.friendPresences)) {
        setPresences(
          data.friendPresences
            .filter((fp: any) => fp.userId && fp.status)
            .map((fp: any) => ({
              userId: fp.userId,
              status: fp.status,
            })),
        );
      }

      if (data.user?.id) {
        setPresence(data.user.id, { status: 'online' });
      }
    });

    gw.on('resumed', () => {
      setGatewayStatus('connected');

      const voiceState = useVoiceStore.getState();
      if (voiceState.currentChannelId && voiceState.connectionState === 'connected') {
        gw.send(OpCode.VOICE_STATE_UPDATE, {
          selfMute: voiceState.selfMuted,
          selfDeaf: voiceState.selfDeafened,
          selfVideo: voiceState.cameraEnabled,
        });
      }
    });

    gw.on('invalid_session', (resumable) => {
      if (!resumable) {
        resetGateway();
      }
    });

    // --- Messages ---
    gw.on('message_create', (data) => {
      addMessage(data.message.channelId, data.message);
      updateChannel(data.message.channelId, { lastMessageId: data.message.id } as any);
    });

    gw.on('message_update', (data) => {
      updateMessage(data.channelId, data.id, data);
    });

    gw.on('message_delete', (data) => {
      removeMessage(data.channelId, data.messageId);
    });

    // --- Reactions ---
    gw.on('reaction_add', (data) => {
      const currentUserId = useAuthStore.getState().user?.id;
      addReactionToMessage(data.channelId, data.messageId, data.emoji, data.userId, currentUserId);
    });

    gw.on('reaction_remove', (data) => {
      const currentUserId = useAuthStore.getState().user?.id;
      removeReactionFromMessage(data.channelId, data.messageId, data.emoji, data.userId, currentUserId);
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
      if (data.guild) {
        setGuild(data.guild);
      }
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
      }
    });

    gw.on('member_update', (data) => {
      updateMember(data.guildId, data.member.userId, data.member);
    });

    gw.on('member_remove', (data) => {
      removeMember(data.guildId, data.userId);
    });

    // --- Channels ---
    gw.on('channel_create', (data) => {
      const ch = data.channel ?? data;
      if (ch.type === 'DM' || ch.type === 'GROUP_DM') {
        addConversation(ch as any);
      } else {
        setChannel(ch);
      }
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
          selfVideo: data.selfVideo ?? false,
          screenSharing: data.screenShare ?? false,
        });
      } else {
        const participants = Object.values(voiceStore.participants).filter(
          (p) => p.userId === data.userId
        );
        for (const p of participants) {
          voiceStore.removeParticipant(p.channelId, data.userId);
        }
      }
    });

    gw.on('voice_server_update', (data) => {
      const voiceStore = useVoiceStore.getState();
      voiceStore.setLivekitCredentials(data.token, data.endpoint);
    });

    gw.on('screen_share_started', (data) => {
      if (data.channelId) {
        useVoiceStore.getState().setParticipantScreenShare(data.channelId, data.userId, true);
      }
    });

    gw.on('screen_share_stopped', (data) => {
      if (data.channelId) {
        useVoiceStore.getState().setParticipantScreenShare(data.channelId, data.userId, false);
      }
    });

    // --- Read State ---
    gw.on('read_state_update', (data: any) => {
      const messagesStore = useMessagesStore.getState();
      if (data.lastReadMessageId) {
        messagesStore.setLastRead(data.channelId, data.lastReadMessageId);
      }
      if (typeof data.mentionCount === 'number') {
        messagesStore.setMentionCount(data.channelId, data.mentionCount);
      }
    });

    // --- Notifications (friend requests etc.) ---
    gw.on('notification', (data: any) => {
      if (data.type === 'relationship_update' && data.relationship) {
        const rel = data.relationship;
        useFriendsStore.getState().addRelationship({
          id: rel.user?.id ?? '',
          type: rel.type,
          user: rel.user,
          since: new Date().toISOString(),
        });
      } else if (data.type === 'relationship_remove' && data.targetUserId) {
        useFriendsStore.getState().removeRelationship(data.targetUserId);
      }
    });

    // --- Error ---
    gw.on('error', (code, message) => {
      console.error(`[Gateway] Error ${code}: ${message}`);
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
