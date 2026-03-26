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
import { editMessage as editMessageApi } from '@/lib/api/messages.api';
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
  const updateMessage = useMessagesStore((s) => s.updateMessage);

  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessagePayload | null>(null);

  // Sync active state
  useEffect(() => {
    setActiveGuild(guildId);
    setActiveChannel(channelId);
  }, [guildId, channelId, setActiveGuild, setActiveChannel]);

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
    return (
      <>
        <ChannelSidebar />
        <DMChatView conversationId={channelId} />
      </>
    );
  }

  const isVoiceChannel = channel?.type === ChannelType.VOICE;

  return (
    <>
      {/* Channel sidebar */}
      <ChannelSidebar guildId={guildId} />

      {/* Content area */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ background: 'var(--color-surface-base)' }}
      >
        {/* Header */}
        <ChannelHeader channelId={channelId} />

        {isVoiceChannel ? (
          /* Voice channel view */
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <VoiceRoomView channelId={channelId} guildId={guildId} />
            {isMemberSidebarOpen && <MemberSidebar guildId={guildId} />}
          </div>
        ) : (
          /* Text channel — Messages + composer */
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
              />
            </div>
            {isMemberSidebarOpen && <MemberSidebar guildId={guildId} />}
          </div>
        )}
      </div>
    </>
  );
}
