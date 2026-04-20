'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paperclip,
  Smile,
  Plus,
  Send,
  X,
  Reply,
  Pencil,
  Bold,
  Italic,
  Code,
  Check,
  Loader2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@/components/ui/Tooltip';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { MentionAutocomplete } from './MentionAutocomplete';
import { sendMessage, requestAttachmentUpload, uploadFileToPresignedUrl } from '@/lib/api/messages.api';
import { triggerTyping } from '@/lib/api/channels.api';
import { useMessagesStore } from '@/stores/messages.store';
import { useAuthStore } from '@/stores/auth.store';
import { formatFileSize } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import type { MessagePayload, AttachmentRef } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Attachment preview item
// ---------------------------------------------------------------------------

function AttachmentPreview({
  file,
  progress,
  uploading,
  onRemove,
}: {
  file: File;
  /** 0–100. When uploading, drives a conic ring overlay. */
  progress?: number;
  uploading?: boolean;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith('image/');
  const previewUrl = isImage ? URL.createObjectURL(file) : null;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0;
  const showRing = uploading || (pct > 0 && pct < 100);
  const completed = pct >= 100;

  return (
    <div
      className="relative flex-shrink-0 rounded-lg overflow-hidden group"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-default)',
      }}
    >
      {isImage && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="h-20 w-20 object-cover rounded-lg"
        />
      ) : (
        <div className="w-32 h-16 flex items-center justify-center gap-2 p-2">
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-accent-muted)' }}
          >
            <Paperclip size={14} style={{ color: 'var(--color-accent-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-medium truncate"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {file.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
      )}

      {/* Conic-gradient upload ring — shows during upload and briefly on completion */}
      <AnimatePresence>
        {showRing && (
          <motion.div
            key="ring"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            aria-hidden="true"
          >
            <div
              className="absolute inset-0"
              style={{
                background: `conic-gradient(var(--color-accent-primary) ${pct * 3.6}deg, rgba(0,0,0,0.35) 0deg)`,
                WebkitMask:
                  'radial-gradient(circle, transparent 36%, #000 37%, #000 44%, transparent 45%)',
                mask:
                  'radial-gradient(circle, transparent 36%, #000 37%, #000 44%, transparent 45%)',
              }}
            />
            <span
              className="relative z-10 text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-md"
              style={{
                background: 'var(--color-surface-floating)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              {pct}%
            </span>
          </motion.div>
        )}
        {completed && !uploading && (
          <motion.div
            key="checkmark"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{
                background: 'var(--color-accent-primary)',
                color: '#0A0C11',
                boxShadow: '0 0 0 6px var(--color-accent-subtle)',
              }}
            >
              <Check size={14} strokeWidth={3} />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-fast"
        style={{
          background: 'var(--color-surface-floating)',
          border: '1px solid var(--color-border-strong)',
          color: 'var(--color-text-primary)',
        }}
        aria-label={`Remove ${file.name}`}
      >
        <X size={10} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reply / Edit indicator
// ---------------------------------------------------------------------------

function ComposerHeader({
  type,
  label,
  onClose,
}: {
  type: 'reply' | 'edit';
  label: string;
  onClose: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 rounded-t-lg"
      style={{
        background: 'var(--color-surface-raised)',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
        {type === 'reply' ? <Reply size={13} /> : <Pencil size={13} />}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <button
        onClick={onClose}
        className="w-5 h-5 rounded flex items-center justify-center transition-colors duration-fast"
        style={{ color: 'var(--color-text-tertiary)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)';
          e.currentTarget.style.background = 'var(--color-surface-overlay)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-tertiary)';
          e.currentTarget.style.background = 'transparent';
        }}
        aria-label="Close"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main MessageComposer
// ---------------------------------------------------------------------------

const MAX_CHARS = 4000;
const TYPING_DEBOUNCE_MS = 2000;
const DRAFT_KEY = (channelId: string) => `constchat-draft-${channelId}`;

interface MessageComposerProps {
  channelId: string;
  channelName: string;
  replyTo?: MessagePayload | null;
  editingMessage?: MessagePayload | null;
  onClearReply: () => void;
  onClearEdit: () => void;
  onEditSubmit: (messageId: string, content: string) => Promise<void>;
  onStartEdit?: (message: MessagePayload) => void;
  slowmodeSeconds?: number;
}

export function MessageComposer({
  channelId,
  channelName,
  replyTo,
  editingMessage,
  onClearReply,
  onClearEdit,
  onEditSubmit,
  onStartEdit,
  slowmodeSeconds = 0,
}: MessageComposerProps) {
  const t = useTranslations('messages');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [isFocused, setIsFocused] = useState(false);
  const [slowmodeCooldown, setSlowmodeCooldown] = useState(0);

  // Slowmode countdown timer
  useEffect(() => {
    if (slowmodeCooldown <= 0) return;
    const timer = setInterval(() => {
      setSlowmodeCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [slowmodeCooldown]);
  const [fileProgress, setFileProgress] = useState<number[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartPos, setMentionStartPos] = useState<number>(0);
  const [pasteToast, setPasteToast] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const addMessage = useMessagesStore((s) => s.addMessage);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const getChannelMessages = useMessagesStore((s) => s.getChannelMessages);

  // Restore draft
  useEffect(() => {
    if (!editingMessage) {
      const draft = typeof window !== 'undefined'
        ? localStorage.getItem(DRAFT_KEY(channelId))
        : null;
      if (draft) setContent(draft);
    }
  }, [channelId, editingMessage]);

  // Pre-fill editing content
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content ?? '');
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // Save draft on content change
  useEffect(() => {
    if (editingMessage) return;
    if (typeof window !== 'undefined') {
      if (content) {
        localStorage.setItem(DRAFT_KEY(channelId), content);
      } else {
        localStorage.removeItem(DRAFT_KEY(channelId));
      }
    }
  }, [content, channelId, editingMessage]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, window.innerHeight * 0.5)}px`;
  }, [content]);

  // Typing indicator: fire immediately on first keystroke, then debounce
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canFireRef = useRef(true);
  const emitTyping = useCallback(() => {
    if (canFireRef.current) {
      canFireRef.current = false;
      triggerTyping(channelId).catch(() => {});
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      canFireRef.current = true;
    }, TYPING_DEBOUNCE_MS);
  }, [channelId]);

  // Clear typing debounce timer when channel changes
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      canFireRef.current = true;
    };
  }, [channelId]);

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setContent(val);
      if (val) emitTyping();

      // Detect @mention
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');
      if (atIndex >= 0) {
        const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
        const queryText = textBeforeCursor.slice(atIndex + 1);
        if ((charBefore === ' ' || charBefore === '\n' || atIndex === 0) && !queryText.includes(' ')) {
          setMentionQuery(queryText);
          setMentionStartPos(atIndex);
          return;
        }
      }
      setMentionQuery(null);
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if ((!trimmed && files.length === 0) || sending) return;

    if (editingMessage) {
      await onEditSubmit(editingMessage.id, trimmed);
      setContent('');
      onClearEdit();
      return;
    }

    setSending(true);

    // Optimistic send: add a pending message immediately (optimistic update pattern)
    const user = useAuthStore.getState().user;
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const removeMessage = useMessagesStore.getState().removeMessage;

    if (trimmed && files.length === 0 && user) {
      const optimisticMsg: MessagePayload = {
        id: pendingId,
        channelId,
        author: {
          id: user.id,
          username: user.username,
          discriminator: user.discriminator ?? '0',
          avatar: user.avatar ?? null,
          globalName: user.globalName ?? null,
          createdAt: user.createdAt,
          flags: 0,
        },
        content: trimmed,
        timestamp: new Date().toISOString(),
        pinned: false,
        flags: 0,
        nonce: pendingId,
      };
      addMessage(channelId, optimisticMsg);
    }

    try {
      let attachmentIds: string[] | undefined;

      // Upload files via presigned URLs
      if (files.length > 0) {
        setFileProgress(new Array(files.length).fill(0));
        const presignResponse = await requestAttachmentUpload(
          channelId,
          files.map((f) => ({
            filename: f.name,
            fileSize: f.size,
            contentType: f.type || 'application/octet-stream',
          })),
        );

        // Upload each file directly to S3 with per-file progress tracking
        await Promise.all(
          presignResponse.map((presigned, i) =>
            uploadFileToPresignedUrl(presigned.uploadUrl, files[i]!, (pct) => {
              setFileProgress((prev) => {
                const next = [...prev];
                next[i] = Math.round(pct);
                return next;
              });
            }),
          ),
        );

        attachmentIds = presignResponse.map((p) => p.uploadId);
        setFileProgress((prev) => prev.map(() => 100));
      }

      const msg = await sendMessage(channelId, {
        content: trimmed || undefined,
        replyToId: replyTo?.id,
        attachmentIds,
      });

      // Replace optimistic message with real one
      if (trimmed && files.length === 0) {
        removeMessage(channelId, pendingId);
      }
      addMessage(channelId, msg);

      setContent('');
      setFiles([]);
      setFileProgress([]);
      onClearReply();
      localStorage.removeItem(DRAFT_KEY(channelId));
      if (slowmodeSeconds > 0) setSlowmodeCooldown(slowmodeSeconds);
    } catch (err: unknown) {
      // Remove failed optimistic message
      if (trimmed && files.length === 0) {
        removeMessage(channelId, pendingId);
      }
      toastError(err instanceof Error ? err.message : t('sendFailed'));
    } finally {
      setSending(false);
    }
  }, [
    content,
    files,
    sending,
    channelId,
    replyTo,
    editingMessage,
    onClearReply,
    onClearEdit,
    onEditSubmit,
    addMessage,
  ]);

  const handleMentionSelect = useCallback((userId: string, displayName: string) => {
    const before = content.slice(0, mentionStartPos);
    const after = content.slice(textareaRef.current?.selectionStart ?? mentionStartPos + (mentionQuery?.length ?? 0) + 1);
    const newContent = `${before}<@${userId}> ${after}`;
    setContent(newContent);
    setMentionQuery(null);
    setTimeout(() => {
      const newPos = before.length + `<@${userId}> `.length;
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    }, 0);
  }, [content, mentionStartPos, mentionQuery]);

  // Wrap selected text (or insert at cursor) with markdown formatting
  const wrapSelection = useCallback((wrapper: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + wrapper + selected + wrapper + content.slice(end);
    setContent(newContent);
    // Move cursor inside the wrappers if no selection, or after wrapped text
    setTimeout(() => {
      ta.focus();
      if (selected) {
        ta.selectionStart = start;
        ta.selectionEnd = end + wrapper.length * 2;
      } else {
        ta.selectionStart = ta.selectionEnd = start + wrapper.length;
      }
    }, 0);
  }, [content]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // If mention autocomplete is open, let it handle keyboard events
    if (mentionQuery !== null) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
        return; // handled by MentionAutocomplete's global listener
      }
      if (e.key === 'Enter') {
        return; // handled by MentionAutocomplete
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    // Ctrl+B — Bold, Ctrl+I — Italic, Ctrl+` — Code
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        wrapSelection('**');
        return;
      }
      if (e.key === 'i') {
        e.preventDefault();
        wrapSelection('*');
        return;
      }
      if (e.key === '`') {
        e.preventDefault();
        wrapSelection('`');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (editingMessage) onClearEdit();
      if (replyTo) onClearReply();
    }
    // Up Arrow with empty input → edit last own message
    if (e.key === 'ArrowUp' && content.trim() === '' && !editingMessage && onStartEdit && currentUserId) {
      const messages = getChannelMessages(channelId);
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]!.author.id === currentUserId) {
          e.preventDefault();
          onStartEdit(messages[i]!);
          break;
        }
      }
    }
  };

  // Paste images from clipboard (Ctrl+V with image data)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // Give pasted images a readable name
          const ext = file.type.split('/')[1] ?? 'png';
          const named = new File(
            [file],
            `pasted-image-${Date.now()}.${ext}`,
            { type: file.type },
          );
          pastedFiles.push(named);
        }
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      setFiles((prev) => [...prev, ...pastedFiles].slice(0, 10));
      setPasteToast(true);
    }
  }, []);

  // Auto-dismiss paste toast
  useEffect(() => {
    if (!pasteToast) return;
    const t = setTimeout(() => setPasteToast(false), 2000);
    return () => clearTimeout(t);
  }, [pasteToast]);

  // Dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setFiles((prev) => [...prev, ...acceptedFiles].slice(0, 10));
      setIsDragOver(false);
    },
    noClick: true,
    noKeyboard: true,
    maxSize: 25 * 1024 * 1024, // 25MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      if (newContent.length <= MAX_CHARS) {
        setContent(newContent);
        // Restore cursor after emoji
        requestAnimationFrame(() => {
          const newPos = start + emoji.length;
          ta.selectionStart = newPos;
          ta.selectionEnd = newPos;
          ta.focus();
        });
      }
    } else {
      const newContent = content + emoji;
      if (newContent.length <= MAX_CHARS) setContent(newContent);
    }
    setShowEmojiPicker(false);
  }, [content]);

  const remaining = MAX_CHARS - content.length;
  const isNearLimit = remaining <= 200;
  const canSend = (content.trim().length > 0 || files.length > 0) && !sending && slowmodeCooldown === 0;

  return (
    <div
      className="px-2 sm:px-4 pt-2 flex-shrink-0 min-w-0 relative"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      {...getRootProps()}
    >
      <input {...getInputProps()} />

      <motion.div
        className="rounded-2xl overflow-hidden relative"
        animate={{
          boxShadow: isDragActive
            ? 'var(--shadow-glow)'
            : isFocused
            ? '0 0 0 1px var(--color-border-focus), 0 10px 28px -12px rgba(0,0,0,0.55)'
            : '0 2px 10px rgba(0,0,0,0.2)',
        }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        style={{
          background: 'var(--color-surface-elevated)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: isDragActive || isDragOver
            ? '1px solid var(--color-accent-primary)'
            : isFocused
            ? '1px solid var(--color-border-focus)'
            : '1px solid var(--color-border-subtle)',
          transition: 'border-color 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {/* Reply / Edit header */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            >
              <ComposerHeader
                type="reply"
                label={t('replyingTo', { user: replyTo.author.globalName ?? replyTo.author.username ?? replyTo.author.id })}
                onClose={onClearReply}
              />
            </motion.div>
          )}
          {editingMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            >
              <ComposerHeader
                type="edit"
                label={t('editingMessage')}
                onClose={() => {
                  onClearEdit();
                  setContent('');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* File previews */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="flex flex-wrap gap-2 p-3 pb-0"
            >
              {files.map((file, i) => (
                <AttachmentPreview
                  key={`${file.name}-${i}`}
                  file={file}
                  progress={fileProgress[i] ?? 0}
                  uploading={sending && (fileProgress[i] ?? 0) < 100}
                  onRemove={() => removeFile(i)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drop overlay */}
        {isDragActive && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl"
            style={{
              background: 'var(--color-accent-muted)',
              zIndex: 10,
            }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--color-accent-primary)' }}>
              {t('upload.dragDrop')}
            </p>
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-1 px-2 py-2">
          {/* Attach button */}
          <Tooltip content={t('uploadFile')} placement="top">
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files;
                  if (f) setFiles((prev) => [...prev, ...Array.from(f)].slice(0, 10));
                };
                input.click();
              }}
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-fast"
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-overlay)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-tertiary)';
              }}
              aria-label={t('uploadFile')}
            >
              <Plus size={18} />
            </button>
          </Tooltip>

          {/* Textarea + mention autocomplete */}
          <div className="flex-1 min-w-0 relative">
            <AnimatePresence>
              {mentionQuery !== null && (
                <MentionAutocomplete
                  query={mentionQuery}
                  onSelect={handleMentionSelect}
                  onClose={() => setMentionQuery(null)}
                />
              )}
            </AnimatePresence>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t('placeholder', { channel: channelName })}
              rows={1}
              className="w-full bg-transparent resize-none outline-none text-sm py-2 px-1 max-h-[50vh]"
              style={{
                color: 'var(--color-text-primary)',
                maxHeight: 'min(var(--layout-message-input-max-height, 50vh), 50vh)',
                minHeight: 'var(--layout-message-input-min-height)',
                lineHeight: '1.5',
                overflow: 'auto',
              }}
              aria-label={t('placeholder', { channel: channelName })}
              aria-multiline
            />
          </div>

          {/* Right-side controls */}
          <div className="flex items-center gap-0.5 flex-shrink-0 pb-1">
            {/* Char counter (near limit) */}
            {isNearLimit && (
              <span
                className="text-xs font-medium mr-1"
                style={{
                  color: remaining < 0
                    ? 'var(--color-danger-default)'
                    : remaining < 100
                    ? 'var(--color-warning-default)'
                    : 'var(--color-text-tertiary)',
                }}
              >
                {remaining}
              </span>
            )}

            {/* Emoji */}
            <Tooltip content={t('emoji')} placement="top" disabled={showEmojiPicker}>
              <button
                ref={emojiButtonRef}
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-fast"
                style={{
                  color: showEmojiPicker
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-tertiary)',
                  background: showEmojiPicker
                    ? 'var(--color-surface-overlay)'
                    : 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-overlay)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  if (!showEmojiPicker) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  }
                }}
                aria-label={t('openEmojiPicker')}
                aria-expanded={showEmojiPicker}
              >
                <Smile size={18} />
              </button>
            </Tooltip>
            {showEmojiPicker && (
              <EmojiPicker
                triggerRef={emojiButtonRef}
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}

            {/* Send button — Gravitas morph + platinum glow ring on success */}
            <Tooltip content={editingMessage ? t('saveEdit') : t('sendMessage')} placement="top">
              <div className="relative">
                <AnimatePresence>
                  {sendState === 'sent' && (
                    <motion.span
                      key="glow-ring"
                      initial={{ opacity: 0.9, scale: 0.9 }}
                      animate={{ opacity: 0, scale: 2.4 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        boxShadow: '0 0 0 2px var(--color-accent-primary), 0 0 20px 4px var(--color-accent-subtle)',
                      }}
                      aria-hidden="true"
                    />
                  )}
                </AnimatePresence>
                <motion.button
                  onClick={() => {
                    if (!canSend) return;
                    setSendState('sending');
                    handleSend().finally(() => {
                      setSendState('sent');
                      setTimeout(() => setSendState('idle'), 1200);
                    });
                  }}
                  disabled={!canSend}
                  whileHover={canSend ? { y: -1 } : undefined}
                  whileTap={canSend ? { y: 0, scale: 0.97 } : undefined}
                  transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center relative"
                  style={{
                    background: sendState === 'sent'
                      ? 'var(--color-success-default)'
                      : canSend
                      ? 'var(--color-accent-primary)'
                      : 'transparent',
                    color: canSend || sendState === 'sent' ? '#0A0C11' : 'var(--color-text-disabled)',
                    transition: 'background 220ms cubic-bezier(0.2,0.8,0.2,1), color 220ms cubic-bezier(0.2,0.8,0.2,1)',
                  }}
                  aria-label={editingMessage ? t('saveEdit') : t('sendMessage')}
                >
                  <AnimatePresence mode="wait">
                    {sendState === 'sending' ? (
                      <motion.div
                        key="spinner"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
                      >
                        <Loader2 size={15} className="animate-spin" />
                      </motion.div>
                    ) : sendState === 'sent' ? (
                      <motion.div
                        key="check"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                      >
                        <Check size={15} strokeWidth={3} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="send"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                      >
                        <Send size={15} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Slowmode indicator */}
        {slowmodeCooldown > 0 && (
          <div className="flex items-center gap-2 px-3 py-1">
            <div
              className="h-1 flex-1 rounded-full overflow-hidden"
              style={{ background: 'var(--color-surface-overlay)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000 linear"
                style={{
                  width: `${(slowmodeCooldown / slowmodeSeconds) * 100}%`,
                  background: 'var(--color-warning-default, #f0a020)',
                }}
              />
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--color-warning-default, #f0a020)' }}>
              {slowmodeCooldown}s
            </span>
          </div>
        )}

        {/* Formatting toolbar — always visible, 16px icons, inline toolbar row */}
        <div
          className="flex items-center gap-1 px-2 sm:px-3 pb-1.5 border-t"
          style={{
            borderColor: 'var(--color-border-subtle)',
            paddingTop: '6px',
          }}
        >
          <div className="flex items-center gap-0.5">
            <Tooltip content={t('formatting.bold')} placement="top">
              <button
                onClick={() => wrapSelection('**')}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-fast"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.background = 'var(--color-surface-overlay)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  e.currentTarget.style.background = 'transparent';
                }}
                aria-label={t('formatting.bold')}
              >
                <Bold size={14} strokeWidth={2.25} />
              </button>
            </Tooltip>
            <Tooltip content={t('formatting.italic')} placement="top">
              <button
                onClick={() => wrapSelection('*')}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-fast"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.background = 'var(--color-surface-overlay)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  e.currentTarget.style.background = 'transparent';
                }}
                aria-label={t('formatting.italic')}
              >
                <Italic size={14} strokeWidth={2.25} />
              </button>
            </Tooltip>
            <Tooltip content={t('formatting.code')} placement="top">
              <button
                onClick={() => wrapSelection('`')}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-fast"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                  e.currentTarget.style.background = 'var(--color-surface-overlay)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                  e.currentTarget.style.background = 'transparent';
                }}
                aria-label={t('formatting.code')}
              >
                <Code size={14} strokeWidth={2.25} />
              </button>
            </Tooltip>
          </div>
          <span
            className="ml-auto text-[11px] hidden sm:inline tabular-nums"
            style={{ color: 'var(--color-text-disabled)' }}
          >
            <kbd
              className="inline-block px-1.5 py-0.5 rounded border text-[10px] font-sans"
              style={{
                background: 'var(--color-surface-raised)',
                borderColor: 'var(--color-border-subtle)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Enter
            </kbd>{' '}
            {t('hints.send')}
            <span className="mx-1.5" style={{ opacity: 0.5 }}>·</span>
            <kbd
              className="inline-block px-1.5 py-0.5 rounded border text-[10px] font-sans"
              style={{
                background: 'var(--color-surface-raised)',
                borderColor: 'var(--color-border-subtle)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Shift+Enter
            </kbd>{' '}
            {t('hints.newLine')}
          </span>
        </div>
      </motion.div>

      {/* Paste toast — appears briefly after pasting from clipboard */}
      <AnimatePresence>
        {pasteToast && (
          <motion.div
            key="paste-toast"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute left-4 bottom-full mb-2 pointer-events-none italic"
            style={{
              background: 'var(--color-surface-floating)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
              fontFeatureSettings: '"opsz" auto',
              fontSize: '13px',
              letterSpacing: '-0.005em',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
            }}
            aria-live="polite"
          >
            Pasted from clipboard.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
