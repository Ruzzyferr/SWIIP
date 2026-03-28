'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { ChannelHeader } from '@/components/layout/ChannelHeader';
import { MemberSidebar } from '@/components/layout/MemberSidebar';
import { MessageList } from '@/components/messaging/MessageList';
import { MessageComposer } from '@/components/messaging/MessageComposer';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import { DMChatView } from '@/components/messaging/DMChatView';
import { VoiceRoomView } from '@/components/voice/VoiceRoomView';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { editMessage as editMessageApi } from '@/lib/api/messages.api';
import { acknowledgeChannel } from '@/lib/api/channels.api';
import { ChannelType, type MessagePayload } from '@constchat/protocol';

export default function ChannelPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const channelId = params.channelId as string;

  const isDM = guildId === '@me';
  const channel = useGuildsStore((s) => s.channels[channelId]);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const [isMobile, setIsMobile] = useState(false);

  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessagePayload | null>(null);

  // Sync active state + lazy-load guild members on navigation (Discord pattern)
  useEffect(() => {
    setActiveGuild(guildId);
    setActiveChannel(channelId);
    setMobileNavOpen(false);

    // Lazy load members for this guild if not already loaded
    if (guildId && guildId !== '@me') {
      const members = useGuildsStore.getState().members[guildId];
      if (!members || Object.keys(members).length === 0) {
        import('@/lib/api/guilds.api').then(({ getGuildMembers }) => {
          getGuildMembers(guildId)
            .then((m) => useGuildsStore.getState().setMembers(guildId, m))
            .catch(() => {});
        });
      }
    }
  }, [guildId, channelId, setActiveGuild, setActiveChannel, setMobileNavOpen]);

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
    // Also ack when new messages arrive while viewing this channel
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  // Swipe gestures for mobile sidebar toggle
  const swipeHandlers = useSwipeGesture({
    onSwipeRight: () => { if (isMobile && !isMobileNavOpen) setMobileNavOpen(true); },
    onSwipeLeft: () => { if (isMobile && isMobileNavOpen) setMobileNavOpen(false); },
    enabled: isMobile,
  });

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

  // DM conversation — render DM-specific view
  if (isDM) {
    if (isMobile && isMobileNavOpen) {
      return <div {...swipeHandlers}><ChannelSidebar /></div>;
    }

    return (
      <div className="flex flex-1 min-w-0 overflow-hidden" {...swipeHandlers}>
        {!isMobile && <ChannelSidebar />}
        <DMChatView conversationId={channelId} />
      </div>
    );
  }

  const isVoiceChannel = channel?.type === ChannelType.VOICE;

  return (
    <div className="flex flex-1 min-w-0 overflow-hidden" {...swipeHandlers}>
      {/* Mobile: show menu panel OR content panel, not both */}
      {(!isMobile || isMobileNavOpen) && <ChannelSidebar guildId={guildId} />}

      {(!isMobile || !isMobileNavOpen) && (
        <div
          className="flex-1 flex flex-col min-w-0"
          style={{ background: 'var(--color-surface-base)' }}
        >
          {/* Header */}
          <ChannelHeader
            channelId={channelId}
            showMobileNavToggle={isMobile}
            onToggleMobileNav={toggleMobileNav}
          />

          {isVoiceChannel ? (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <VoiceRoomView channelId={channelId} guildId={guildId} />
              {!isMobile && isMemberSidebarOpen && <MemberSidebar guildId={guildId} />}
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0">
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
              </div>
              {!isMobile && isMemberSidebarOpen && <MemberSidebar guildId={guildId} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
