'use client';

import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  SmilePlus,
  Reply,
  Pencil,
  Pin,
  Trash2,
  MoreHorizontal,
  Check,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { useAuthStore } from '@/stores/auth.store';
import { editMessage, deleteMessage, addReaction } from '@/lib/api/messages.api';
import { useMessagesStore } from '@/stores/messages.store';
import type { MessagePayload, ReactionPayload, EmojiRef } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Markdown renderer (minimal, no extra deps)
// ---------------------------------------------------------------------------

function renderContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code block
    const codeBlock = remaining.match(/^```(\w+)?\n?([\s\S]*?)```/);
    if (codeBlock) {
      const lang = codeBlock[1] ?? '';
      const code = codeBlock[2] ?? '';
      nodes.push(
        <pre
          key={key++}
          className="rounded-lg overflow-x-auto my-1"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            padding: '12px 16px',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-primary)',
          }}
        >
          <code>{code}</code>
        </pre>
      );
      remaining = remaining.slice(codeBlock[0].length);
      continue;
    }

    // Inline code
    const inlineCode = remaining.match(/^`([^`]+)`/);
    if (inlineCode) {
      nodes.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded text-xs mx-0.5"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-primary)',
          }}
        >
          {inlineCode[1]}
        </code>
      );
      remaining = remaining.slice(inlineCode[0].length);
      continue;
    }

    // Bold
    const bold = remaining.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      nodes.push(<strong key={key++} style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{bold[1]}</strong>);
      remaining = remaining.slice(bold[0].length);
      continue;
    }

    // Italic
    const italic = remaining.match(/^\*(.+?)\*/);
    if (italic) {
      nodes.push(<em key={key++}>{italic[1]}</em>);
      remaining = remaining.slice(italic[0].length);
      continue;
    }

    // Mention
    const mention = remaining.match(/^<@(\w+)>/);
    if (mention) {
      nodes.push(
        <span
          key={key++}
          className="px-1 rounded-sm font-medium cursor-pointer transition-colors duration-fast"
          style={{
            background: 'var(--color-mention-bg)',
            color: 'var(--color-mention-text)',
            border: '1px solid transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-mention-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-mention-bg)';
          }}
        >
          @{mention[1]}
        </span>
      );
      remaining = remaining.slice(mention[0].length);
      continue;
    }

    // URL
    const url = remaining.match(/^(https?:\/\/[^\s]+)/);
    if (url) {
      nodes.push(
        <a
          key={key++}
          href={url[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-colors duration-fast"
          style={{ color: 'var(--color-text-accent)' }}
        >
          {url[1]}
        </a>
      );
      remaining = remaining.slice(url[0].length);
      continue;
    }

    // Regular text — collect until a special char
    const nextSpecial = remaining.search(/`|\*|<@|https?:\/\//);
    if (nextSpecial === -1) {
      nodes.push(<span key={key++}>{remaining}</span>);
      remaining = '';
    } else if (nextSpecial === 0) {
      // Unmatched special char — emit one char
      nodes.push(<span key={key++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    } else {
      nodes.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>);
      remaining = remaining.slice(nextSpecial);
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Reaction pill
// ---------------------------------------------------------------------------

function ReactionPill({
  reaction,
  channelId,
  messageId,
  currentUserId,
}: {
  reaction: ReactionPayload;
  channelId: string;
  messageId: string;
  currentUserId: string | undefined;
}) {
  const hasReacted = reaction.me ?? (reaction as unknown as { userIds?: string[] }).userIds?.includes(currentUserId ?? '') ?? false;

  const handleClick = async () => {
    const emoji: EmojiRef = reaction.emoji;
    try {
      if (hasReacted) {
        const { removeReaction } = await import('@/lib/api/messages.api');
        await removeReaction(channelId, messageId, emoji);
      } else {
        await addReaction(channelId, messageId, emoji);
      }
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={handleClick}
      className="reaction-pill"
      style={{
        background: hasReacted
          ? 'var(--color-accent-muted)'
          : 'var(--color-surface-raised)',
        borderColor: hasReacted
          ? 'var(--color-accent-strong)'
          : 'var(--color-border-subtle)',
      }}
      aria-label={`${reaction.emoji.name} — ${reaction.count} reactions`}
      aria-pressed={hasReacted}
    >
      <span>{reaction.emoji.id ? '' : reaction.emoji.name}</span>
      <span
        className="text-xs font-medium"
        style={{
          color: hasReacted ? 'var(--color-text-accent)' : 'var(--color-text-secondary)',
        }}
      >
        {reaction.count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Message actions toolbar
// ---------------------------------------------------------------------------

function MessageActions({
  onReact,
  onReply,
  onEdit,
  onPin,
  onDelete,
  canEdit,
  showReactionPicker,
  onToggleReactionPicker,
  channelId,
  messageId,
}: {
  onReact: () => void;
  onReply: () => void;
  onEdit?: () => void;
  onPin: () => void;
  onDelete?: () => void;
  canEdit: boolean;
  showReactionPicker: boolean;
  onToggleReactionPicker: () => void;
  channelId: string;
  messageId: string;
}) {
  const reactButtonRef = useRef<HTMLButtonElement>(null);

  const handleReactionSelect = useCallback(async (emoji: string) => {
    try {
      await addReaction(channelId, messageId, { name: emoji });
    } catch {
      // ignore
    }
    onToggleReactionPicker();
  }, [channelId, messageId, onToggleReactionPicker]);

  return (
    <div
      className="message-actions flex items-center gap-0.5 rounded-lg px-1 py-1"
      style={{
        background: 'var(--color-surface-floating)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-md)',
        position: 'absolute',
        right: 12,
        top: -18,
      }}
    >
      {/* Add Reaction button */}
      <Tooltip content="Add Reaction" placement="top" disabled={showReactionPicker}>
        <button
          ref={reactButtonRef}
          onClick={onToggleReactionPicker}
          className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-fast"
          style={{
            color: showReactionPicker
              ? 'var(--color-text-primary)'
              : 'var(--color-text-secondary)',
            background: showReactionPicker
              ? 'var(--color-surface-raised)'
              : 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-raised)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            if (!showReactionPicker) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
          aria-label="Add Reaction"
        >
          <SmilePlus size={15} />
        </button>
      </Tooltip>

      {showReactionPicker && (
        <EmojiPicker
          triggerRef={reactButtonRef}
          onSelect={handleReactionSelect}
          onClose={onToggleReactionPicker}
        />
      )}

      {/* Other action buttons */}
      {[
        { label: 'Reply', icon: <Reply size={15} />, onClick: onReply },
        ...(canEdit ? [{ label: 'Edit', icon: <Pencil size={15} />, onClick: onEdit! }] : []),
        { label: 'Pin', icon: <Pin size={15} />, onClick: onPin },
        ...(canEdit ? [{ label: 'Delete', icon: <Trash2 size={15} />, onClick: onDelete!, danger: true }] : []),
      ].map(({ label, icon, onClick, danger }) => (
        <Tooltip key={label} content={label} placement="top">
          <button
            onClick={onClick}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-all duration-fast"
            style={{
              color: (danger as boolean | undefined)
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = (danger as boolean | undefined)
                ? 'var(--color-danger-muted)'
                : 'var(--color-surface-raised)';
              e.currentTarget.style.color = (danger as boolean | undefined)
                ? 'var(--color-danger-default)'
                : 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = (danger as boolean | undefined)
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)';
            }}
            aria-label={label}
          >
            {icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main MessageItem
// ---------------------------------------------------------------------------

interface MessageItemProps {
  message: MessagePayload;
  channelId: string;
  isGrouped: boolean;
  onReply: (message: MessagePayload) => void;
  showUnreadSeparator?: boolean;
}

export function MessageItem({
  message,
  channelId,
  isGrouped,
  onReply,
  showUnreadSeparator = false,
}: MessageItemProps) {
  const currentUser = useAuthStore((s) => s.user);
  const updateMsg = useMessagesStore((s) => s.updateMessage);
  const removeMsg = useMessagesStore((s) => s.removeMessage);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content ?? '');
  const [hovered, setHovered] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const authorId = message.author?.id ?? (message as unknown as { authorId?: string }).authorId ?? '';
  const authorName = message.author?.globalName ?? message.author?.username ?? authorId;
  const canEdit = currentUser?.id === authorId;
  const timestamp = new Date(message.timestamp ?? (message as unknown as { createdAt?: string }).createdAt ?? Date.now());
  const editedAt = message.editedTimestamp ?? (message as unknown as { editedAt?: string }).editedAt;
  const replyRef = message.referencedMessage ?? ((message as unknown as { replyToId?: string }).replyToId ? true : null);

  const handleEditSubmit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setEditing(false);
      return;
    }
    try {
      const updated = await editMessage(channelId, message.id, {
        content: editContent.trim(),
      });
      updateMsg(channelId, message.id, updated);
      setEditing(false);
    } catch {
      // ignore
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setEditContent(message.content ?? '');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await deleteMessage(channelId, message.id);
      removeMsg(channelId, message.id);
    } catch {
      // ignore
    }
  };

  const handlePin = async () => {
    // TODO: pin via API
  };

  return (
    <>
      {/* Unread separator */}
      {showUnreadSeparator && (
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex-1 h-px" style={{ background: 'var(--color-danger-default)' }} />
          <span
            className="text-xs font-semibold flex-shrink-0"
            style={{ color: 'var(--color-danger-default)' }}
          >
            New Messages
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-danger-default)' }} />
        </div>
      )}

      {/* Message row */}
      <div
        className="message-row relative group px-4 py-0.5"
        style={{
          paddingTop: isGrouped ? '1px' : '8px',
          background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
          transition: 'background 80ms ease',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="article"
        aria-label={`Message from ${authorId}`}
      >
        {/* Actions toolbar */}
        {(hovered || showReactionPicker) && !editing && (
          <MessageActions
            onReact={() => setShowReactionPicker(true)}
            onReply={() => onReply(message)}
            onEdit={canEdit ? () => {
              setEditing(true);
              setEditContent(message.content ?? '');
              setTimeout(() => {
                editRef.current?.focus();
                editRef.current?.select();
              }, 10);
            } : undefined}
            onPin={handlePin}
            onDelete={canEdit ? handleDelete : undefined}
            canEdit={canEdit}
            showReactionPicker={showReactionPicker}
            onToggleReactionPicker={() => setShowReactionPicker((v) => !v)}
            channelId={channelId}
            messageId={message.id}
          />
        )}

        <div className="flex gap-3">
          {/* Avatar column */}
          <div className="w-10 flex-shrink-0 flex justify-center">
            {isGrouped ? (
              /* Timestamp on hover for grouped */
              hovered ? (
                <span
                  className="text-xs leading-5 mt-0.5 select-none"
                  style={{ color: 'var(--color-text-disabled)' }}
                  title={timestamp.toLocaleString()}
                >
                  {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <div className="w-10" />
              )
            ) : (
              <Avatar
                userId={authorId}
                src={message.author?.avatar}
                displayName={authorName}
                size="md"
                className="mt-0.5"
              />
            )}
          </div>

          {/* Content column */}
          <div className="flex-1 min-w-0">
            {/* Header row (non-grouped) */}
            {!isGrouped && (
              <div className="flex items-baseline gap-2 mb-0.5">
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {authorName}
                </span>
                <Tooltip
                  content={timestamp.toLocaleString()}
                  placement="top"
                >
                  <time
                    className="text-xs cursor-default"
                    style={{ color: 'var(--color-text-disabled)' }}
                    dateTime={timestamp.toISOString()}
                  >
                    {formatDistanceToNow(timestamp, { addSuffix: true })}
                  </time>
                </Tooltip>
                {editedAt && (
                  <Tooltip
                    content={`Edited ${new Date(editedAt).toLocaleString()}`}
                    placement="top"
                  >
                    <span
                      className="text-xs cursor-default"
                      style={{ color: 'var(--color-text-disabled)' }}
                    >
                      (edited)
                    </span>
                  </Tooltip>
                )}
              </div>
            )}

            {/* Reply reference */}
            {replyRef && (
              <div
                className="flex items-center gap-1.5 mb-1.5 text-xs cursor-pointer rounded px-2 py-1"
                style={{
                  background: 'var(--color-surface-raised)',
                  borderLeft: '2px solid var(--color-border-strong)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Reply size={11} />
                <span className="truncate">Reply to message</span>
              </div>
            )}

            {/* Message content */}
            {editing ? (
              <div className="mt-1">
                <textarea
                  ref={editRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border-focus)',
                    color: 'var(--color-text-primary)',
                    maxHeight: '200px',
                    minHeight: '60px',
                  }}
                  rows={2}
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    Enter to save · Esc to cancel
                  </span>
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditContent(message.content ?? '');
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center transition-colors duration-fast"
                      style={{ color: 'var(--color-danger-default)', background: 'var(--color-danger-muted)' }}
                      aria-label="Cancel edit"
                    >
                      <X size={13} />
                    </button>
                    <button
                      onClick={handleEditSubmit}
                      className="w-6 h-6 rounded flex items-center justify-center transition-colors duration-fast"
                      style={{ color: 'var(--color-success-default)', background: 'var(--color-success-muted)' }}
                      aria-label="Save edit"
                    >
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-primary)', wordBreak: 'break-word' }}
              >
                {renderContent(message.content ?? '')}
                {editedAt && !isGrouped && (
                  <span
                    className="text-xs ml-1"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    (edited)
                  </span>
                )}
              </p>
            )}

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {message.attachments.map((att, i) => (
                  <div
                    key={i}
                    className="rounded-lg overflow-hidden"
                    style={{
                      maxWidth: '400px',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    {att.contentType?.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.filename}
                        alt={att.filename}
                        className="max-w-full rounded-lg"
                        style={{ maxHeight: '300px', objectFit: 'contain' }}
                      />
                    ) : (
                      <div
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: 'var(--color-surface-raised)' }}
                      >
                        <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--color-accent-muted)' }}>
                          <span style={{ fontSize: 16 }}>📎</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {att.filename}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            {(att.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {message.reactions.map((reaction, i) => (
                  <ReactionPill
                    key={i}
                    reaction={reaction}
                    channelId={channelId}
                    messageId={message.id}
                    currentUserId={currentUser?.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
