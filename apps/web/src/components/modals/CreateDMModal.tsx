'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useUIStore } from '@/stores/ui.store';
import { useFriendsStore } from '@/stores/friends.store';
import { usePresenceStore } from '@/stores/presence.store';
import { openDM } from '@/lib/api/dms.api';
import { toastError } from '@/lib/toast';

export function CreateDMModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const relationships = useFriendsStore((s) => s.relationships);
  const getPresence = usePresenceStore((s) => s.getPresence);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  // Only show actual friends
  const friends = relationships.filter((r) => r.type === 'FRIEND');
  const filtered = friends.filter((rel) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (rel.user.globalName ?? rel.user.username ?? '').toLowerCase();
    return name.includes(q) || (rel.user.username ?? '').toLowerCase().includes(q);
  });

  const handleSelect = async (userId: string) => {
    setLoading(userId);
    try {
      const dm = await openDM(userId);
      closeModal();
      router.push(`/channels/@me/${dm.id}`);
    } catch {
      toastError('Failed to open DM');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          New Direct Message
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          Select a friend to start a conversation
        </p>
      </div>

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
            return (
              <button
                key={friend.id}
                onClick={() => handleSelect(friend.id)}
                disabled={loading === friend.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                style={{ color: 'var(--color-text-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
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
                {loading === friend.id && (
                  <div className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-text-disabled)', borderTopColor: 'var(--color-accent-primary)' }} />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
