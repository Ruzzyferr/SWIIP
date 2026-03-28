'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import type { MemberPayload } from '@constchat/protocol';

interface MentionAutocompleteProps {
  query: string; // text after @ — empty string means no mention in progress
  onSelect: (userId: string, displayName: string) => void;
  onClose: () => void;
}

export function MentionAutocomplete({ query, onSelect, onClose }: MentionAutocompleteProps) {
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const members = useGuildsStore((s) => activeGuildId ? s.members[activeGuildId] : null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.toLowerCase();
    return Object.values(members)
      .filter((m) => {
        const name = m.nick ?? m.user?.globalName ?? m.user?.username ?? '';
        const uname = m.user?.username ?? '';
        return name.toLowerCase().includes(q) || uname.toLowerCase().includes(q);
      })
      .slice(0, 10);
  }, [members, query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length, query]);

  // Keyboard navigation — exposed via ref-like pattern
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const member = filtered[selectedIndex];
      if (member) {
        const name = member.nick ?? member.user?.globalName ?? member.user?.username ?? member.userId;
        onSelect(member.userId, name);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Register keyboard handler
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (filtered.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.1 }}
      className="absolute bottom-full left-0 right-0 mb-1 rounded-lg overflow-hidden z-10"
      style={{
        background: 'var(--color-surface-floating)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-lg)',
        maxHeight: 300,
        overflowY: 'auto',
      }}
    >
      <div className="py-1">
        <div className="px-3 py-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
            Members
          </span>
        </div>
        {filtered.map((member, i) => {
          const name = member.nick ?? member.user?.globalName ?? member.user?.username ?? member.userId;
          const username = member.user?.username ?? '';
          const isSelected = i === selectedIndex;

          return (
            <button
              key={member.userId}
              onClick={() => onSelect(member.userId, name)}
              onMouseEnter={() => setSelectedIndex(i)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors"
              style={{
                background: isSelected ? 'var(--color-accent-primary)' : 'transparent',
                color: isSelected ? '#fff' : 'var(--color-text-primary)',
              }}
            >
              <Avatar
                userId={member.userId}
                src={member.user?.avatar}
                displayName={name}
                size="sm"
              />
              <span className="font-medium truncate">{name}</span>
              {name !== username && username && (
                <span className="text-xs truncate" style={{ opacity: 0.7 }}>
                  {username}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
