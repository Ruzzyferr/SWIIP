'use client';

import { useState, useCallback } from 'react';
import { X, Hash } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { useUIStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useMessagesStore } from '@/stores/messages.store';
import { editMessage as editMessageApi } from '@/lib/api/messages.api';
import type { MessagePayload } from '@constchat/protocol';

export function ThreadPanel() {
  const activeThreadId = useUIStore((s) => s.activeThreadId);
  const closeThread = useUIStore((s) => s.closeThread);
  const channel = useGuildsStore((s) => activeThreadId ? s.channels[activeThreadId] : null);
  const updateMessage = useMessagesStore((s) => s.updateMessage);

  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessagePayload | null>(null);

  const handleReply = useCallback((message: MessagePayload) => {
    setReplyTo(message);
    setEditingMessage(null);
  }, []);

  const handleEditSubmit = useCallback(
    async (messageId: string, content: string) => {
      if (!activeThreadId) return;
      const updated = await editMessageApi(activeThreadId, messageId, { content });
      updateMessage(activeThreadId, messageId, updated);
    },
    [activeThreadId, updateMessage],
  );

  if (!activeThreadId) return null;

  return (
    <div
      className="flex flex-col h-full fixed inset-0 z-40 w-full sm:relative sm:inset-auto sm:z-auto sm:w-[min(380px,100vw)] sm:max-w-[min(380px,46vw)] shrink-0 pb-[env(safe-area-inset-bottom)] sm:pb-0"
      style={{
        background: 'var(--color-surface-elevated)',
        borderLeft: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-xl)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Hash size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {channel?.name ?? 'Thread'}
          </span>
        </div>
        <button
          onClick={closeThread}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col min-h-0">
        <MessageList channelId={activeThreadId} onReply={handleReply} />
        <TypingIndicator channelId={activeThreadId} />
        <MessageComposer
          channelId={activeThreadId}
          channelName={channel?.name ?? 'thread'}
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
