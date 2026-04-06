'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle } from 'lucide-react';
import { MemberSidebar } from '@/components/layout/MemberSidebar';
import { MessageList } from '@/components/messaging/MessageList';
import { MessageComposer } from '@/components/messaging/MessageComposer';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import { DMChatView } from '@/components/messaging/DMChatView';
import { VoiceRoomView } from '@/components/voice/VoiceRoomView';
import { ThreadPanel } from '@/components/messaging/ThreadPanel';
import { WelcomeScreenModal } from '@/components/guild/WelcomeScreenModal';
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
  const activeThreadId = useUIStore((s) => s.activeThreadId);
  const isVoiceChatOpen = useUIStore((s) => s.isVoiceChatOpen);
  const setVoiceChatOpen = useUIStore((s) => s.setVoiceChatOpen);
  const updateMessage = useMessagesStore((s) => s.updateMessage);

  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessagePayload | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

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

  // Show welcome screen on first guild visit
  useEffect(() => {
    if (isDM) return;
    const key = `welcome_seen_${guildId}`;
    if (!localStorage.getItem(key)) {
      setShowWelcome(true);
      localStorage.setItem(key, '1');
    }
  }, [guildId, isDM]);

  // Close voice chat drawer on Escape
  useEffect(() => {
    if (!isVoiceChatOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVoiceChatOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isVoiceChatOpen, setVoiceChatOpen]);

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
      {showWelcome && (
        <WelcomeScreenModal guildId={guildId} onClose={() => setShowWelcome(false)} />
      )}
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

      {/* Thread panel */}
      {activeThreadId && <ThreadPanel />}

      {/* Voice chat drawer — slide-in from right */}
      <AnimatePresence>
        {isVoiceChannel && isVoiceChatOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={spring}
            className="absolute right-0 top-0 bottom-0 z-20 flex flex-col"
            style={{
              width: 'min(380px, 80vw)',
              background: 'rgba(10, 14, 16, 0.95)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              borderLeft: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Chat header */}
            <div
              className="flex items-center gap-2 px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <MessageCircle size={14} style={{ color: 'var(--color-text-tertiary)' }} />
              <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
                {channel?.name ?? 'Chat'}
              </span>
              <button
                onClick={() => setVoiceChatOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={14} />
              </button>
            </div>
            {/* Message list */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <MessageList
                channelId={channelId}
                onReply={handleReply}
              />
            </div>
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member sidebar — slide-over drawer (hidden when voice chat is open) */}
      <AnimatePresence>
        {isMemberSidebarOpen && !isVoiceChatOpen && (
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
