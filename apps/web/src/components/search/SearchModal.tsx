'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Hash, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/Avatar';
import { searchMessages, searchChannelMessages, parseSearchQuery } from '@/lib/api/messages.api';
import { useUIStore } from '@/stores/ui.store';
import type { MessagePayload } from '@constchat/protocol';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const activeChannelId = useUIStore((s) => s.activeChannelId);
  const isDMMode = !activeGuildId || activeGuildId === '@me' || activeGuildId === 'me';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MessagePayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Global Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
        else if (activeGuildId && activeGuildId !== '@me' && activeGuildId !== 'me') {
          // We can't open directly, so this needs external wiring
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, activeGuildId]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Need either a guild or a DM channel to search in
    if (!isDMMode && !activeGuildId) {
      setResults([]);
      return;
    }
    if (isDMMode && !activeChannelId) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { text, authorId, before, after, has, channelId } = parseSearchQuery(query.trim());
        let res: MessagePayload[];
        if (isDMMode && activeChannelId) {
          res = await searchChannelMessages(activeChannelId, text || query.trim(), {
            authorId,
            before,
            after,
            has,
          });
        } else {
          res = await searchMessages(activeGuildId!, text || query.trim(), channelId, {
            authorId,
            before,
            after,
            has,
          });
        }
        setResults(res);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, activeGuildId, activeChannelId, isDMMode]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        const msg = results[selectedIndex];
        const channelId = (msg as any).channelId ?? '';
        if (channelId) {
          const base = isDMMode ? '/channels/@me' : `/channels/${activeGuildId}`;
          router.push(`${base}/${channelId}`);
          onClose();
        }
      }
    },
    [results, selectedIndex, activeGuildId, router, onClose],
  );

  if (typeof window === 'undefined' || !open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
        style={{ background: 'rgba(0, 0, 0, 0.6)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-lg rounded-xl overflow-hidden"
          style={{
            background: 'var(--color-surface-floating)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-xl)',
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            <Search size={18} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isDMMode ? 'Search in conversation...' : 'Search messages...'}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
              autoFocus
            />
            {loading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />}
            <button
              onClick={onClose}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-tertiary)' }}
            >
              ESC
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto scroll-thin">
            {query.trim() && !loading && results.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  No results found
                </p>
              </div>
            )}

            {results.map((msg, i) => {
              const authorName = msg.author?.globalName ?? msg.author?.username ?? 'Unknown';
              const timestamp = new Date(msg.timestamp ?? (msg as any).createdAt ?? Date.now());
              const isSelected = i === selectedIndex;

              return (
                <button
                  key={msg.id}
                  onClick={() => {
                    const channelId = (msg as any).channelId ?? '';
                    if (channelId) {
                      const base = isDMMode ? '/channels/@me' : `/channels/${activeGuildId}`;
                      router.push(`${base}/${channelId}`);
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{
                    background: isSelected ? 'var(--color-surface-raised)' : 'transparent',
                  }}
                >
                  <Avatar
                    userId={msg.author?.id ?? ''}
                    src={msg.author?.avatar}
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
                      className="text-sm line-clamp-2 mt-0.5"
                      style={{ color: 'var(--color-text-secondary)', wordBreak: 'break-word' }}
                    >
                      {msg.content}
                    </p>
                  </div>
                </button>
              );
            })}

            {!query.trim() && (
              <div className="py-6 px-6">
                <div className="text-center mb-4">
                  <Search size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-disabled)' }} />
                  <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                    {isDMMode ? 'Search for messages in this conversation' : 'Search for messages in this server'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
                    Search Filters
                  </p>
                  {[
                    { filter: 'from:', desc: 'user', example: 'from:username' },
                    { filter: 'in:', desc: 'channel', example: 'in:general' },
                    { filter: 'has:', desc: 'file, image, link', example: 'has:image' },
                    { filter: 'before:', desc: 'date', example: 'before:2025-01-01' },
                    { filter: 'after:', desc: 'date', example: 'after:2025-01-01' },
                  ].map(({ filter, desc, example }) => (
                    <div key={filter} className="flex items-center gap-2 text-xs">
                      <code
                        className="px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'var(--color-surface-raised)', color: 'var(--color-accent-primary)' }}
                      >
                        {filter}
                      </code>
                      <span style={{ color: 'var(--color-text-tertiary)' }}>{desc}</span>
                      <span className="ml-auto font-mono" style={{ color: 'var(--color-text-disabled)' }}>
                        {example}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3 text-center" style={{ color: 'var(--color-text-disabled)' }}>
                  Tip: Use <kbd className="font-mono">Ctrl+K</kbd> to open search anytime
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
