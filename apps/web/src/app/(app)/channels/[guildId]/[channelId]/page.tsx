'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MemberSidebar } from '@/components/layout/MemberSidebar';
import { MessageList } from '@/components/messaging/MessageList';
import { MessageComposer } from '@/components/messaging/MessageComposer';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import { DMChatView } from '@/components/messaging/DMChatView';
import { VoiceRoomView } from '@/components/voice/VoiceRoomView';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useMessagesStore } from '@/stores/messages.store';
import { editMessage as editMessageApi } from '@/lib/api/messages.api';
import { acknowledgeChannel } from '@/lib/api/channels.api';
import { ChannelType, type MessagePayload } from '@constchat/protocol';

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

export default function ChannelPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const channelId = params.channelId as string;

  const isDM = guildId === 'me' || guildId === '@me';
  const channel = useGuildsStore((s) => s.channels[channelId]);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
  const updateMessage = useMessagesStore((s) => s.updateMessage);

  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessagePayload | null>(null);

  // Sync active state + lazy-load guild members on navigation
  useEffect(() => {
    setActiveGuild(guildId);
    setActiveChannel(channelId);

    // Lazy load members for this guild if not already loaded
    if (guildId && guildId !== '@me' && guildId !== 'me') {
      const members = useGuildsStore.getState().members[guildId];
      if (!members || Object.keys(members).length === 0) {
        import('@/lib/api/guilds.api').then(({ getGuildMembers }) => {
          getGuildMembers(guildId)
            .then((m) => useGuildsStore.getState().setMembers(guildId, m))
            .catch(() => {});
        });
      }
    }
  }, [guildId, channelId, setActiveGuild, setActiveChannel]);

  // Auto-acknowledge channel as read when viewing it
  useEffect(() => {
    const ch = useMessagesStore.getState().channels[channelId];
    const messages = ch?.messages;
    if (messages && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.id !== ch?.lastReadId) {
        useMessagesStore.getState().setLastRead(channelId, lastMsg.id);
        acknowledgeChannel(channelId, { lastReadMessageId: lastMsg.id }).catch(() => {});
      }
    }
    const unsub = useMessagesStore.subscribe((state) => {
      const channelData = state.channels[channelId];
      if (!channelData) return;
      const msgs = channelData.messages;
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (last && last.id !== channelData.lastReadId) {
          state.setLastRead(channelId, last.id);
          acknowledgeChannel(channelId, { lastReadMessageId: last.id }).catch(() => {});
        }
      }
    });
    return unsub;
  }, [channelId]);

  const handleReply = useCallback((message: MessagePayload) => {
    setReplyTo(message);
    setEditingMessage(null);
  }, []);

  const handleEditSubmit = useCallback(
    async (messageId: string, content: string) => {
      const updated = await editMessageApi(channelId, messageId, { content });
      updateMessage(channelId, messageId, updated);
    },
    [channelId, updateMessage]
  );

  // DM conversation — full-width chat
  if (isDM) {
    return (
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <DMChatView conversationId={channelId} />
      </div>
    );
  }

  const isVoiceChannel = channel?.type === ChannelType.VOICE;

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden relative">
      {/* Full-width content */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ background: 'transparent' }}
      >
        {isVoiceChannel ? (
          <VoiceRoomView channelId={channelId} guildId={guildId} />
        ) : (
          <>
            <MessageList
              channelId={channelId}
              onReply={handleReply}
            />
            <TypingIndicator channelId={channelId} guildId={guildId} />
            <MessageComposer
              channelId={channelId}
              channelName={channel?.name ?? 'channel'}
              replyTo={replyTo}
              editingMessage={editingMessage}
              onClearReply={() => setReplyTo(null)}
              onClearEdit={() => setEditingMessage(null)}
              onEditSubmit={handleEditSubmit}
              onStartEdit={setEditingMessage}
            />
          </>
        )}
      </div>

      {/* Member sidebar — slide-over drawer */}
      <AnimatePresence>
        {isMemberSidebarOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={spring}
            className="absolute right-0 top-0 bottom-0 z-30"
            style={{
              width: 'min(280px, 80vw)',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
            }}
          >
            <MemberSidebar guildId={guildId} channelId={isVoiceChannel ? channelId : undefined} isVoiceChannel={isVoiceChannel} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
