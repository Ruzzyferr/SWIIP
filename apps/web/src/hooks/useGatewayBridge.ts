'use client';

import { useEffect, useRef } from 'react';
import { OpCode } from '@constchat/protocol';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { setAccessToken } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { useGatewayStore } from '@/stores/gateway.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useMessagesStore } from '@/stores/messages.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useDMsStore } from '@/stores/dms.store';
import { useUIStore } from '@/stores/ui.store';
import { useFriendsStore } from '@/stores/friends.store';
import { getGuildMembers, getGuildMember, getGuild } from '@/lib/api/guilds.api';
import { toastError, toastInfo, toastSuccess } from '@/lib/toast';
import { playMessageSound, playMentionSound } from '@/lib/sounds';
import { getPlatformProvider } from '@/lib/platform';

/** Window focus — updated via PlatformProvider (Electron IPC on desktop). */
const notificationWindowFocused = { current: true };

function isViewingMessageChannel(channelId: string): boolean {
  const { activeChannelId, activeDMId, activeThreadId } = useUIStore.getState();
  return (
    activeChannelId === channelId ||
    activeDMId === channelId ||
    activeThreadId === channelId
  );
}

/** Determine if user should get audio/desktop alert for this channel. */
function shouldAlertIncomingMessage(channelId: string): boolean {
  if (typeof document === 'undefined') return true;
  const viewing = isViewingMessageChannel(channelId);
  const visible = !document.hidden;
  const focused = notificationWindowFocused.current;
  return !(viewing && visible && focused);
}

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
  const addReactionToMessage = useMessagesStore((s) => s.addReactionToMessage);
  const removeReactionFromMessage = useMessagesStore((s) => s.removeReactionFromMessage);

  const setPresence = usePresenceStore((s) => s.setPresence);
  const setPresences = usePresenceStore((s) => s.setPresences);
  const setTyping = usePresenceStore((s) => s.setTyping);

  const setConversations = useDMsStore((s) => s.setConversations);
  const addConversation = useDMsStore((s) => s.addConversation);
  const updateConversation = useDMsStore((s) => s.updateConversation);

  useEffect(() => {
    if (!accessToken || bridged.current) return;
    bridged.current = true;

    const gw = getGatewayClient();

    notificationWindowFocused.current =
      typeof document !== 'undefined' ? document.hasFocus() : true;
    const unsubWindowFocus = getPlatformProvider().onWindowFocusChange((focused) => {
      notificationWindowFocused.current = focused;
    });

    // Sync access token for API calls
    setAccessToken(accessToken);

    // Request notification permission for desktop notifications (standard browser pattern)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // --- Connection lifecycle ---
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

    let reconnectToastTimeout: ReturnType<typeof setTimeout> | null = null;

    gw.on('reconnecting', (attempt) => {
      setGatewayStatus('reconnecting');
      // Only show toast after 3+ seconds of sustained reconnecting (attempt > 1),
      // to avoid spamming on brief network blips that resolve in <1s.
      if (attempt >= 2 && !reconnectToastTimeout) {
        reconnectToastTimeout = setTimeout(() => {
          reconnectToastTimeout = null;
          // Check if still reconnecting before showing toast
          if (useGatewayStore.getState().status === 'reconnecting') {
            toastInfo('Reconnecting to server...');
          }
        }, 2000);
      }
    });

    // Clear reconnect toast timer when connection is restored
    gw.on('connected', () => {
      setGatewayStatus('connected');
      if (reconnectToastTimeout) {
        clearTimeout(reconnectToastTimeout);
        reconnectToastTimeout = null;
      }
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

      // Populate voice store with initial voice states from READY
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

      // Populate read states from READY
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

      // Populate friend presences from READY payload
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

      // Set own presence as online
      if (data.user?.id) {
        setPresence(data.user.id, { status: 'online' });
      }

      // Lazy load guild members — only fetch the active guild immediately,
      // defer others until the user navigates to them (Lazy-load pattern: avoids
      // request burst of N guilds on connect).
      const activeGuildId = useUIStore.getState().activeGuildId;
      for (const guild of data.guilds) {
        if (guild.id === activeGuildId) {
          getGuildMembers(guild.id)
            .then((members) => setMembers(guild.id, members))
            .catch(() => {});
        }
        // Other guilds' members will be loaded on-demand when user navigates to them
      }
    });

    gw.on('resumed', () => {
      setGatewayStatus('connected');

      // After gateway resume, re-sync voice state if we're in a voice channel.
      // The gateway may have lost track of our voice session during the disconnect.
      const voiceState = useVoiceStore.getState();
      if (voiceState.currentChannelId && voiceState.connectionState === 'connected') {
        console.debug('[Gateway] Resumed — re-syncing voice state');
        const gw = getGatewayClient();
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
      // Track lastMessageId on the channel for unread detection
      updateChannel(data.message.channelId, { lastMessageId: data.message.id } as any);

      // Move DM conversation to top of list by updating its timestamp
      const dmsState = useDMsStore.getState();
      if (dmsState.conversations[data.message.channelId]) {
        updateConversation(data.message.channelId, {
          updatedAt: new Date().toISOString(),
          lastMessageId: data.message.id,
        });
      }

      // Sound + desktop notification (Alert behavior: other channel / DM, unfocused, or background tab)
      const currentUserId = useAuthStore.getState().user?.id;
      const chId = data.message.channelId;
      if (data.message.author.id !== currentUserId && shouldAlertIncomingMessage(chId)) {
        const isMention = data.message.mentions?.some((m: any) => m.id === currentUserId || m === currentUserId);
        if (isMention) {
          playMentionSound();
        } else {
          playMessageSound();
        }
      }
      if (
        data.message.author.id !== currentUserId &&
        shouldAlertIncomingMessage(chId) &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        const displayName = data.message.author.globalName || data.message.author.username;
        const body = data.message.content.length > 100
          ? data.message.content.slice(0, 100) + '…'
          : data.message.content || '(attachment)';
        try {
          const n = new Notification(displayName, {
            body,
            silent: false,
            tag: `message-${data.message.id}`,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
          setTimeout(() => n.close(), 8000);
        } catch {
          // Notification API error — ignore
        }
      }
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

    // --- Presence (batched via microtask to coalesce rapid updates) ---
    let presenceBatch: Array<{ userId: string } & { status: any; customStatus?: string; activities?: any[] }> = [];
    let presenceFlushScheduled = false;
    gw.on('presence_update', (data) => {
      presenceBatch.push({
        userId: data.userId,
        status: data.status,
        ...(data.customStatus != null && { customStatus: data.customStatus }),
        ...((data as any).customStatusEmoji != null && { customStatusEmoji: (data as any).customStatusEmoji }),
        ...((data as any).customStatusExpiresAt != null && { customStatusExpiresAt: (data as any).customStatusExpiresAt }),
        ...(data.activities != null && { activities: data.activities }),
      });
      if (!presenceFlushScheduled) {
        presenceFlushScheduled = true;
        queueMicrotask(() => {
          const batch = presenceBatch;
          presenceBatch = [];
          presenceFlushScheduled = false;
          if (batch.length === 1) {
            setPresence(batch[0]!.userId, batch[0]!);
          } else if (batch.length > 1) {
            usePresenceStore.getState().setPresences(batch);
          }
        });
      }
    });

    // --- Guilds ---
    gw.on('guild_create', async (data) => {
      try {
        if (data.guild) {
          setGuild(data.guild);
        } else if ((data as any).guildId) {
          // Fallback: backend sent only guildId — fetch full guild via REST
          const guild = await getGuild((data as any).guildId);
          setGuild(guild);
        }
      } catch (err) {
        console.error('[Gateway] guild_create handler failed:', err);
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
      // DM channels go to DM store, guild channels go to guild store
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
      const localUserId = useAuthStore.getState().user?.id;
      if (data.channelId) {
        // For the local user, never override selfMute/selfDeaf from a gateway
        // broadcast — it arrives with network delay and can revert intentional
        // local changes, causing "random" muting.  Only accept serverMute/serverDeaf
        // (admin actions) from the server for the local user.
        if (data.userId === localUserId) {
          const existing = voiceStore.participants[`${data.channelId}:${data.userId}`];
          voiceStore.setParticipant({
            userId: data.userId,
            channelId: data.channelId,
            selfMute: existing?.selfMute ?? voiceStore.selfMuted,
            selfDeaf: existing?.selfDeaf ?? voiceStore.selfDeafened,
            serverMute: data.serverMute,
            serverDeaf: data.serverDeaf,
            speaking: existing?.speaking ?? false,
            selfVideo: existing?.selfVideo ?? false,
            screenSharing: existing?.screenSharing ?? false,
          });
        } else {
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
        }
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

    gw.on('screen_share_started', (data) => {
      const voiceStore = useVoiceStore.getState();
      if (data.channelId) {
        voiceStore.setParticipantScreenShare(data.channelId, data.userId, true);
      }
    });

    gw.on('screen_share_stopped', (data) => {
      const voiceStore = useVoiceStore.getState();
      if (data.channelId) {
        voiceStore.setParticipantScreenShare(data.channelId, data.userId, false);
      }
    });

    // --- Read State ---
    gw.on('read_state_update', (data: any) => {
      const currentUserId = useAuthStore.getState().user?.id;
      const messagesStore = useMessagesStore.getState();
      if (data.lastReadMessageId) {
        messagesStore.setLastRead(data.channelId, data.lastReadMessageId);
      }
      if (typeof data.mentionCount === 'number') {
        messagesStore.setMentionCount(data.channelId, data.mentionCount);
      }
      // Track recipient read state for DM read receipts
      if (data.userId && data.userId !== currentUserId && data.lastReadMessageId) {
        const dmsState = useDMsStore.getState();
        if (dmsState.conversations[data.channelId]) {
          dmsState.setRecipientRead(data.channelId, data.lastReadMessageId);
        }
      }
    });

    // --- Notification (friend requests, relationship updates) ---
    gw.on('notification', (data: any) => {
      if (data.type === 'relationship_update' && data.relationship) {
        const rel = data.relationship;
        useFriendsStore.getState().addRelationship({
          id: rel.user?.id ?? '',
          type: rel.type,
          user: rel.user,
          since: new Date().toISOString(),
        });

        // Toast for incoming friend request
        if (rel.type === 'PENDING_INCOMING') {
          const name = rel.user?.globalName ?? rel.user?.username ?? 'Someone';
          toastInfo(`${name} sent you a friend request!`);
        } else if (rel.type === 'FRIEND') {
          const name = rel.user?.globalName ?? rel.user?.username ?? 'Someone';
          toastSuccess(`You are now friends with ${name}!`);
        }
      } else if (data.type === 'relationship_remove' && data.targetUserId) {
        useFriendsStore.getState().removeRelationship(data.targetUserId);
      }
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
      unsubWindowFocus();
      if (reconnectToastTimeout) clearTimeout(reconnectToastTimeout);
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
