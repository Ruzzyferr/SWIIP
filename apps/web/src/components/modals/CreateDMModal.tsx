'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useUIStore } from '@/stores/ui.store';
import { useFriendsStore } from '@/stores/friends.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useDMsStore } from '@/stores/dms.store';
import { openDM, createGroupDM } from '@/lib/api/dms.api';
import { toastError } from '@/lib/toast';

const MAX_GROUP_SELECTIONS = 9; // Creator is the 10th member

export function CreateDMModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const addConversation = useDMsStore((s) => s.addConversation);
  const relationships = useFriendsStore((s) => s.relationships);
  const getPresence = usePresenceStore((s) => s.getPresence);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const friends = relationships.filter((r) => r.type === 'FRIEND');
  const filtered = friends.filter((rel) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (rel.user.globalName ?? rel.user.username ?? '').toLowerCase();
    return name.includes(q) || (rel.user.username ?? '').toLowerCase().includes(q);
  });

  const toggleSelect = (userId: string) => {
    setSelected((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length >= MAX_GROUP_SELECTIONS) return prev;
      return [...prev, userId];
    });
  };

  const removeSelected = (userId: string) => {
    setSelected((prev) => prev.filter((id) => id !== userId));
  };

  const getSelectedFriend = (userId: string) =>
    friends.find((r) => r.user.id === userId)?.user;

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      let dm;
      if (selected.length === 1) {
        dm = await openDM(selected[0]!);
      } else {
        dm = await createGroupDM({ recipientIds: selected });
      }
      addConversation(dm);
      closeModal();
      router.push(`/channels/@me/${dm.id}`);
    } catch {
      toastError(selected.length === 1 ? 'Failed to open DM' : 'Failed to create group DM');
    } finally {
      setSubmitting(false);
    }
  };

  const isMaxed = selected.length >= MAX_GROUP_SELECTIONS;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          New Message
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          You can add up to {MAX_GROUP_SELECTIONS} friends.{' '}
          {selected.length > 0 && (
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {selected.length}/{MAX_GROUP_SELECTIONS} selected
            </span>
          )}
        </p>
      </div>

      {/* Selected friends as pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((userId) => {
            const friend = getSelectedFriend(userId);
            if (!friend) return null;
            return (
              <span
                key={userId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  background: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent-primary)',
                }}
              >
                {friend.globalName ?? friend.username}
                <button
                  onClick={() => removeSelected(userId)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--color-text-tertiary)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search friends..."
          autoFocus
          className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--color-surface-base)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-default)',
          }}
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
            {search ? 'No friends match your search' : 'Add some friends first!'}
          </p>
        ) : (
          filtered.map((rel) => {
            const friend = rel.user;
            const status = getPresence(friend.id);
            const isSelected = selected.includes(friend.id);
            const isDisabled = !isSelected && isMaxed;
            return (
              <button
                key={friend.id}
                onClick={() => toggleSelect(friend.id)}
                disabled={isDisabled}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                style={{
                  color: isDisabled ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
                  opacity: isDisabled ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="relative">
                  <Avatar
                    displayName={friend.globalName ?? friend.username ?? friend.id}
                    userId={friend.id}
                    src={friend.avatar}
                    size="md"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                    style={{
                      borderColor: 'var(--color-surface-overlay)',
                      background: status === 'online' ? '#3ba55c' :
                        status === 'idle' ? '#faa61a' :
                          status === 'dnd' ? 'var(--color-status-dnd)' : '#788682',
                    }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {friend.globalName ?? friend.username ?? friend.id}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    @{friend.username}
                  </span>
                </div>
                {/* Checkbox indicator */}
                <div
                  className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    borderColor: isSelected ? 'var(--color-accent-primary)' : 'var(--color-border-default)',
                    background: isSelected ? 'var(--color-accent-primary)' : 'transparent',
                  }}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={selected.length === 0 || submitting}
        className="w-full py-2 rounded-lg text-sm font-medium transition-colors text-white"
        style={{
          background: selected.length === 0
            ? 'var(--color-text-disabled)'
            : 'var(--color-accent-primary)',
          cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting
          ? 'Creating...'
          : selected.length <= 1
            ? 'Create DM'
            : `Create Group DM (${selected.length})`}
      </button>
    </div>
  );
}
