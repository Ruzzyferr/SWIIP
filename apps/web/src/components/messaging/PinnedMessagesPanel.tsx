'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pin, PinOff, X, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { getPinnedMessages, unpinMessage, type PinnedMessage } from '@/lib/api/channels.api';
import { toastError } from '@/lib/toast';

interface PinnedMessagesPanelProps {
  channelId: string;
  onClose: () => void;
}

export function PinnedMessagesPanel({ channelId, onClose }: PinnedMessagesPanelProps) {
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPinnedMessages(channelId)
      .then(setPins)
      .catch(() => toastError('Failed to load pinned messages'))
      .finally(() => setLoading(false));
  }, [channelId]);

  const handleUnpin = useCallback(async (messageId: string) => {
    try {
      await unpinMessage(channelId, messageId);
      setPins((prev) => prev.filter((p) => p.id !== messageId));
    } catch {
      toastError('Failed to unpin message');
    }
  }, [channelId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-2 top-12 z-30 rounded-xl overflow-hidden"
      style={{
        width: 420,
        maxHeight: 500,
        background: 'var(--color-surface-floating)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-xl)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Pin size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Pinned Messages
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto scroll-thin" style={{ maxHeight: 440 }}>
        {loading ? (
          <div className="py-8 text-center">
            <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span>
          </div>
        ) : pins.length === 0 ? (
          <div className="py-8 text-center px-6">
            <Pin size={32} className="mx-auto mb-3" style={{ color: 'var(--color-text-disabled)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              No pinned messages
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Pin important messages so they are easy to find.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {pins.map((pin) => (
              <PinnedMessageCard
                key={pin.id}
                pin={pin}
                onUnpin={() => handleUnpin(pin.id)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PinnedMessageCard({
  pin,
  onUnpin,
}: {
  pin: PinnedMessage;
  onUnpin: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const authorName = (pin as any).author?.globalName ?? (pin as any).author?.username ?? 'Unknown';
  const authorAvatar = (pin as any).author?.avatar;
  const authorId = (pin as any).author?.id ?? '';
  const timestamp = new Date((pin as any).timestamp ?? (pin as any).createdAt ?? Date.now());

  return (
    <div
      className="rounded-lg p-3 transition-colors"
      style={{
        background: hovered ? 'var(--color-surface-raised)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-2.5">
        <Avatar
          userId={authorId}
          src={authorAvatar}
          displayName={authorName}
          size="sm"
          className="mt-0.5 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {authorName}
            </span>
            <time className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
              {formatDistanceToNow(timestamp, { addSuffix: true })}
            </time>
          </div>
          <p
            className="text-sm mt-0.5 line-clamp-3"
            style={{ color: 'var(--color-text-secondary)', wordBreak: 'break-word' }}
          >
            {pin.content ?? ''}
          </p>
        </div>

        {/* Actions */}
        {hovered && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={onUnpin}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-danger-muted)';
                e.currentTarget.style.color = 'var(--color-danger-default)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-tertiary)';
              }}
              title="Unpin"
            >
              <PinOff size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
