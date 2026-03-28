'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Phone, Video, UserPlus, Menu } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDMsStore } from '@/stores/dms.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useUIStore } from '@/stores/ui.store';
import { useMessagesStore } from '@/stores/messages.store';
import { editMessage as editMessageApi } from '@/lib/api/messages.api';
import { getDMChannel } from '@/lib/api/dms.api';
import { ChannelType, type MessagePayload } from '@constchat/protocol';

interface DMChatViewProps {
  conversationId: string;
}

export function DMChatView({ conversationId }: DMChatViewProps) {
  const conversations = useDMsStore((s) => s.conversations);
  const addConversation = useDMsStore((s) => s.addConversation);
  const currentUser = useAuthStore((s) => s.user);
  const setActiveDM = useUIStore((s) => s.setActiveDM);
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const presences = usePresenceStore((s) => s.users);

  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessagePayload | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const dm = conversations[conversationId];

  // Fetch DM if not in store
  useEffect(() => {
    if (!dm && !fetchError) {
      getDMChannel(conversationId)
        .then(addConversation)
        .catch((err) => {
          console.error(err);
          setFetchError(err?.message ?? 'Failed to load conversation');
        });
    }
  }, [conversationId, dm, addConversation, fetchError]);

  // Reset error state when conversation changes
  useEffect(() => {
    setFetchError(null);
  }, [conversationId]);

  // Sync active DM
  useEffect(() => {
    setActiveDM(conversationId);
  }, [conversationId, setActiveDM]);

  const otherUser = useMemo(() => {
    if (!dm) return null;
    return dm.recipients.find((r) => r.id !== currentUser?.id) ?? dm.recipients[0] ?? null;
  }, [dm, currentUser?.id]);

  const isGroup = dm?.type === ChannelType.GROUP_DM;
  const displayName = isGroup
    ? (dm?.name ?? dm?.recipients.map((r) => r.globalName ?? r.username).join(', '))
    : (otherUser?.globalName ?? otherUser?.username ?? 'Unknown');

  const status = otherUser && !isGroup
    ? (presences[otherUser.id]?.status ?? 'offline')
    : null;

  const handleReply = useCallback((message: MessagePayload) => {
    setReplyTo(message);
    setEditingMessage(null);
  }, []);

  const handleEditSubmit = useCallback(
    async (messageId: string, content: string) => {
      const updated = await editMessageApi(conversationId, messageId, { content });
      updateMessage(conversationId, messageId, updated);
    },
    [conversationId, updateMessage]
  );

  return (
    <div
      className="flex-1 flex flex-col min-w-0"
      style={{ background: 'var(--color-surface-base)' }}
    >
      {/* DM Header */}
      <div
        className="flex items-center justify-between px-4 h-12 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile hamburger */}
          <button
            onClick={toggleMobileNav}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast md:hidden"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Open channels menu"
          >
            <Menu size={18} />
          </button>
          {otherUser && !isGroup && (
            <Avatar
              src={otherUser.avatar}
              displayName={displayName}
              size="sm"
              status={status as any}
            />
          )}
          <span className="font-semibold text-sm truncate"
            style={{ color: 'var(--color-text-primary)' }}>
            {displayName}
          </span>
        </div>

        <div className="flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
          <Tooltip content="Start Voice Call" placement="bottom">
            <button className="p-2 rounded-md transition-colors">
              <Phone size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Start Video Call" placement="bottom">
            <button className="p-2 rounded-md transition-colors">
              <Video size={18} />
            </button>
          </Tooltip>
          {isGroup && (
            <Tooltip content="Add Members" placement="bottom">
              <button className="p-2 rounded-md transition-colors">
                <UserPlus size={18} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Messages + composer */}
      <div className="flex-1 flex flex-col min-h-0">
        <MessageList
          channelId={conversationId}
          onReply={handleReply}
        />

        <TypingIndicator channelId={conversationId} />

        <MessageComposer
          channelId={conversationId}
          channelName={displayName}
          replyTo={replyTo}
          editingMessage={editingMessage}
          onClearReply={() => setReplyTo(null)}
          onClearEdit={() => setEditingMessage(null)}
          onEditSubmit={handleEditSubmit}
          onStartEdit={setEditingMessage}
        />
      </div>
    </div>
  );
}
