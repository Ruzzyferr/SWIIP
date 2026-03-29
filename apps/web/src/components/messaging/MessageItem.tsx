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
  PinOff,
  Trash2,
  MoreHorizontal,
  Check,
  X,
  Copy,
  Link2,
  MessageSquare,
  Clock,
  CheckCheck,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { LazyImage } from '@/components/ui/LazyImage';
import { LinkPreview } from '@/components/messaging/LinkPreview';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { editMessage, deleteMessage, addReaction } from '@/lib/api/messages.api';
import { pinMessage, unpinMessage } from '@/lib/api/channels.api';
import { useMessagesStore } from '@/stores/messages.store';
import { toastError } from '@/lib/toast';
import { useTranslations } from 'next-intl';
import type { MessagePayload, ReactionPayload, EmojiRef } from '@constchat/protocol';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

// ---------------------------------------------------------------------------
// Markdown renderer (minimal, no extra deps)
// ---------------------------------------------------------------------------

function SpoilerText({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={() => setRevealed(true)}
      className="rounded px-0.5 cursor-pointer transition-all duration-200"
      style={{
        background: revealed ? 'rgba(255,255,255,0.06)' : 'var(--color-text-primary)',
        color: revealed ? 'inherit' : 'transparent',
        userSelect: revealed ? 'auto' : 'none',
      }}
    >
      {children}
    </span>
  );
}

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
      let highlightedHtml: string | null = null;
      if (lang && hljs.getLanguage(lang)) {
        try {
          highlightedHtml = hljs.highlight(code, { language: lang }).value;
        } catch { /* fallback to plain */ }
      }
      nodes.push(
        <pre
          key={key++}
          className="rounded-lg overflow-x-auto my-1 hljs"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-subtle)',
            padding: '12px 16px',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-primary)',
          }}
        >
          {lang && (
            <span className="text-xs block mb-1" style={{ color: 'var(--color-text-disabled)' }}>{lang}</span>
          )}
          {highlightedHtml ? (
            <code dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlightedHtml) }} />
          ) : (
            <code>{code}</code>
          )}
        </pre>
      );
      remaining = remaining.slice(codeBlock[0].length);
      continue;
    }

    // Blockquote (line starting with >)
    const blockquote = remaining.match(/^(?:^|\n)(?:> (.+?)(?:\n|$))+/);
    if (blockquote && (remaining === text || remaining.startsWith('\n'))) {
      const bqMatch = remaining.match(/^[\n]?((?:> .+?(?:\n|$))+)/);
      if (bqMatch) {
        const lines = bqMatch[1]!.split('\n').filter(l => l.startsWith('> ')).map(l => l.slice(2));
        nodes.push(
          <div
            key={key++}
            className="my-1 py-0.5 px-3"
            style={{
              borderLeft: '3px solid var(--color-text-disabled)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {lines.map((line, i) => <span key={i}>{renderContent(line)}{i < lines.length - 1 && <br />}</span>)}
          </div>
        );
        remaining = remaining.slice(bqMatch[0].length);
        continue;
      }
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

    // Spoiler ||text||
    const spoiler = remaining.match(/^\|\|(.+?)\|\|/);
    if (spoiler) {
      nodes.push(<SpoilerText key={key++}>{spoiler[1]}</SpoilerText>);
      remaining = remaining.slice(spoiler[0].length);
      continue;
    }

    // Strikethrough ~~text~~
    const strike = remaining.match(/^~~(.+?)~~/);
    if (strike) {
      nodes.push(<del key={key++} style={{ color: 'var(--color-text-secondary)' }}>{strike[1]}</del>);
      remaining = remaining.slice(strike[0].length);
      continue;
    }

    // Bold
    const bold = remaining.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      nodes.push(<strong key={key++} style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{bold[1]}</strong>);
      remaining = remaining.slice(bold[0].length);
      continue;
    }

    // Underline __text__
    const underline = remaining.match(/^__(.+?)__/);
    if (underline) {
      nodes.push(<u key={key++}>{underline[1]}</u>);
      remaining = remaining.slice(underline[0].length);
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
    const nextSpecial = remaining.search(/`|\*|<@|https?:\/\/|\|\||~~|__/);
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
  isPinned,
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
  isPinned?: boolean;
  showReactionPicker: boolean;
  onToggleReactionPicker: () => void;
  channelId: string;
  messageId: string;
}) {
  const t = useTranslations('messages');
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
      className="message-actions flex items-center gap-0.5 rounded-xl px-1 py-1"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-float)',
        position: 'absolute',
        right: 12,
        top: -18,
      }}
    >
      {/* Add Reaction button */}
      <Tooltip content={t('addReaction')} placement="top" disabled={showReactionPicker}>
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
          aria-label={t('addReaction')}
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
        { label: t('reply'), icon: <Reply size={15} />, onClick: onReply },
        ...(canEdit ? [{ label: t('edit'), icon: <Pencil size={15} />, onClick: onEdit! }] : []),
        { label: isPinned ? t('unpin') : t('pin'), icon: isPinned ? <PinOff size={15} /> : <Pin size={15} />, onClick: onPin },
        ...(canEdit ? [{ label: t('delete'), icon: <Trash2 size={15} />, onClick: onDelete!, danger: true }] : []),
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
  selectionMode?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onToggleSelect?: () => void;
}

export function MessageItem({
  message,
  channelId,
  isGrouped,
  onReply,
  showUnreadSeparator = false,
  selectionMode = false,
  isSelected = false,
  isHighlighted = false,
  onToggleSelect,
}: MessageItemProps) {
  const t = useTranslations('messages');
  const currentUser = useAuthStore((s) => s.user);
  const updateMsg = useMessagesStore((s) => s.updateMessage);
  const removeMsg = useMessagesStore((s) => s.removeMessage);
  const openModal = useUIStore((s) => s.openModal);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content ?? '');
  const [hovered, setHovered] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const authorId = message.author?.id ?? (message as unknown as { authorId?: string }).authorId ?? '';
  const authorName = message.author?.globalName ?? message.author?.username ?? authorId;
  // Discord-style: show author name in their highest role color
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const memberRoles = useGuildsStore(
    (s) => activeGuildId ? s.members[activeGuildId]?.[authorId]?.roles : undefined
  );
  const allRoles = useGuildsStore((s) => s.roles);
  const authorNameColor = (() => {
    if (!memberRoles) return undefined;
    const topColorRole = memberRoles
      .map((rid) => allRoles[rid])
      .filter((r) => r != null && r.color > 0)
      .sort((a, b) => b!.position - a!.position)[0];
    return topColorRole ? '#' + topColorRole.color.toString(16).padStart(6, '0') : undefined;
  })();
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
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : t('failedToEdit'));
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
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await deleteMessage(channelId, message.id);
      removeMsg(channelId, message.id);
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : t('failedToDelete'));
    }
  };

  const isPinned = !!(message as any).pinned;

  const handlePin = async () => {
    try {
      if (isPinned) {
        await unpinMessage(channelId, message.id);
        updateMsg(channelId, message.id, { ...message, pinned: false } as any);
      } else {
        await pinMessage(channelId, message.id);
        updateMsg(channelId, message.id, { ...message, pinned: true } as any);
      }
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : t('failedToPin'));
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(message.content ?? '').catch(() => {});
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}/${message.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  const contextMenuItems: ContextMenuItem[] = [
    { type: 'item', label: t('copyText'), icon: <Copy size={14} />, onClick: handleCopyText },
    { type: 'item', label: t('reply'), icon: <Reply size={14} />, onClick: () => onReply(message) },
    ...(canEdit ? [{ type: 'item' as const, label: t('edit'), icon: <Pencil size={14} />, onClick: () => {
      setEditing(true);
      setEditContent(message.content ?? '');
      setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 10);
    }}] : []),
    { type: 'separator' as const },
    { type: 'item', label: isPinned ? t('unpin') : t('pin'), icon: isPinned ? <PinOff size={14} /> : <Pin size={14} />, onClick: handlePin },
    { type: 'item', label: t('copyMessageLink'), icon: <Link2 size={14} />, onClick: handleCopyLink },
    ...(canEdit ? [{ type: 'separator' as const }, { type: 'item' as const, label: t('delete'), icon: <Trash2 size={14} />, danger: true, onClick: handleDelete }] : []),
  ];

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
            {t('newMessages')}
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-danger-default)' }} />
        </div>
      )}

      {/* Message row */}
      <ContextMenu items={contextMenuItems}>
      <div
        className="message-row relative group px-4 py-0.5"
        style={{
          paddingTop: isGrouped ? '1px' : '8px',
          background: isHighlighted ? 'rgba(250, 166, 26, 0.12)' : isSelected ? 'rgba(88, 101, 242, 0.1)' : hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
          transition: 'background 600ms ease',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          if (e.shiftKey && onToggleSelect) {
            e.preventDefault();
            onToggleSelect();
          } else if (selectionMode && onToggleSelect) {
            e.preventDefault();
            onToggleSelect();
          }
        }}
        role="article"
        aria-label={t('messageFrom', { author: authorName })}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
              className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
              style={{
                borderColor: isSelected ? 'var(--color-accent-primary)' : 'var(--color-border-default)',
                background: isSelected ? 'var(--color-accent-primary)' : 'transparent',
              }}
            >
              {isSelected && <Check size={12} className="text-white" />}
            </button>
          </div>
        )}
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
            isPinned={isPinned}
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
              <button onClick={() => openModal('user-profile', { userId: authorId })} className="cursor-pointer">
              <Avatar
                userId={authorId}
                src={message.author?.avatar}
                displayName={authorName}
                size="md"
                className="mt-0.5"
              />
              </button>
            )}
          </div>

          {/* Content column */}
          <div className="flex-1 min-w-0">
            {/* Header row (non-grouped) */}
            {!isGrouped && (
              <div className="flex items-baseline gap-2 mb-0.5">
                <button
                  onClick={() => openModal('user-profile', { userId: authorId })}
                  className="text-sm font-semibold cursor-pointer hover:underline"
                  style={{ color: authorNameColor ?? 'var(--color-text-primary)' }}
                >
                  {authorName}
                </button>
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
                {/* Delivery status for own messages */}
                {canEdit && (
                  message.id.startsWith('pending-') ? (
                    <Tooltip content={t('sending')} placement="top">
                      <Clock size={11} style={{ color: 'var(--color-text-disabled)' }} />
                    </Tooltip>
                  ) : (
                    <Tooltip content={t('delivered')} placement="top">
                      <CheckCheck size={11} style={{ color: 'var(--color-success-default)' }} />
                    </Tooltip>
                  )
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
                {typeof replyRef === 'object' && replyRef !== null && 'author' in replyRef ? (
                  <>
                    <span className="font-semibold flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                      {(replyRef as any).author?.globalName ?? (replyRef as any).author?.username ?? 'Unknown'}
                    </span>
                    <span className="truncate">{(replyRef as any).content}</span>
                  </>
                ) : (
                  <span className="truncate">{t('replyToMessage')}</span>
                )}
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
                    {t('editHint')}
                  </span>
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditContent(message.content ?? '');
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center transition-colors duration-fast"
                      style={{ color: 'var(--color-danger-default)', background: 'var(--color-danger-muted)' }}
                      aria-label={t('cancelEdit')}
                    >
                      <X size={13} />
                    </button>
                    <button
                      onClick={handleEditSubmit}
                      className="w-6 h-6 rounded flex items-center justify-center transition-colors duration-fast"
                      style={{ color: 'var(--color-success-default)', background: 'var(--color-success-muted)' }}
                      aria-label={t('saveEdit')}
                    >
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {message.content ? (
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--color-text-primary)', wordBreak: 'break-word' }}
                  >
                    {renderContent(message.content)}
                    {editedAt && (
                      <Tooltip
                        content={`${t('editedAt')} ${new Date(editedAt).toLocaleString()}`}
                        placement="top"
                      >
                        <span
                          className="text-xs ml-1 cursor-default"
                          style={{ color: 'var(--color-text-disabled)' }}
                        >
                          {t('edited')}
                        </span>
                      </Tooltip>
                    )}
                  </p>
                ) : editedAt ? (
                  <Tooltip
                    content={`${t('editedAt')} ${new Date(editedAt).toLocaleString()}`}
                    placement="top"
                  >
                    <span
                      className="text-xs cursor-default"
                      style={{ color: 'var(--color-text-disabled)' }}
                    >
                      {t('edited')}
                    </span>
                  </Tooltip>
                ) : null}
              </>
            )}

            {/* Link preview */}
            {!editing && message.content && <LinkPreview content={message.content} />}

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {message.attachments.map((att, i) => {
                  const attUrl = (att as any).cdnUrl ?? att.url ?? att.proxyUrl ?? '';
                  const displayName = (att as any).originalFilename ?? att.filename;
                  const sizeKB = Number(att.size) / 1024;
                  const sizeStr = sizeKB >= 1024
                    ? `${(sizeKB / 1024).toFixed(1)} MB`
                    : `${sizeKB.toFixed(1)} KB`;

                  return (
                    <div
                      key={att.id ?? i}
                      className="rounded-lg overflow-hidden"
                      style={{
                        maxWidth: '400px',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      {att.contentType?.startsWith('image/') ? (
                        <LazyImage
                          src={attUrl}
                          alt={displayName}
                          className="max-w-full rounded-lg hover:opacity-90 transition-opacity"
                          style={{ maxHeight: '300px', minHeight: '80px', minWidth: '120px' }}
                          onClick={() => {
                            const imageAtts = (message.attachments ?? [])
                              .map((a, idx) => ({ a, idx }))
                              .filter(({ a }) => a.contentType?.startsWith('image/'));
                            const lightboxIdx = imageAtts.findIndex(({ idx: aIdx }) => aIdx === i);
                            setLightboxIndex(lightboxIdx >= 0 ? lightboxIdx : 0);
                          }}
                        />
                      ) : att.contentType?.startsWith('video/') ? (
                        <video
                          src={attUrl}
                          controls
                          preload="metadata"
                          className="max-w-full rounded-lg"
                          style={{ maxHeight: '300px' }}
                        />
                      ) : att.contentType?.startsWith('audio/') ? (
                        <div className="p-3" style={{ background: 'var(--color-surface-raised)' }}>
                          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            {displayName}
                          </p>
                          <audio src={attUrl} controls preload="metadata" className="w-full" style={{ height: 32 }} />
                        </div>
                      ) : (
                        <a
                          href={attUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg hover:brightness-110 transition-all"
                          style={{ background: 'var(--color-surface-raised)' }}
                        >
                          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-accent-muted)' }}>
                            <span style={{ fontSize: 16 }}>📎</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-accent-primary)' }}>
                              {displayName}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                              {sizeStr}
                            </p>
                          </div>
                        </a>
                      )}
                    </div>
                  );
                })}
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

            {/* Thread indicator */}
            {message.thread && (
              <button
                onClick={() => openModal('thread', { threadId: message.thread!.id })}
                className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  color: 'var(--color-accent-primary)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent-muted)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <MessageSquare size={12} />
                <span>{t('viewThread')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      </ContextMenu>

      {/* Image lightbox */}
      {lightboxIndex !== null && (() => {
        const imageAtts = (message.attachments ?? [])
          .filter((a) => a.contentType?.startsWith('image/'))
          .map((a) => ({
            url: (a as any).cdnUrl ?? a.url ?? a.proxyUrl ?? '',
            name: (a as any).originalFilename ?? a.filename,
          }));
        return imageAtts.length > 0 ? (
          <ImageLightbox
            images={imageAtts}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        ) : null;
      })()}
    </>
  );
}
