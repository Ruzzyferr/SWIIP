'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserMinus, Ban, Edit3, X } from 'lucide-react';
import { kickMember, banMember, updateMember } from '@/lib/api/guilds.api';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';
import type { MemberPayload } from '@constchat/protocol';

interface MemberContextMenuProps {
  guildId: string;
  member: MemberPayload;
  position: { x: number; y: number };
  isOwner: boolean;
  onClose: () => void;
}

export function MemberContextMenu({
  guildId,
  member,
  position,
  isOwner,
  onClose,
}: MemberContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const removeMember = useGuildsStore((s) => s.removeMember);
  const [confirmAction, setConfirmAction] = useState<'kick' | 'ban' | null>(null);
  const [banReason, setBanReason] = useState('');
  const [editNick, setEditNick] = useState(false);
  const [nickValue, setNickValue] = useState(member.nick || '');
  const [loading, setLoading] = useState(false);

  const isSelf = currentUserId === member.user?.id;
  const canManage = isOwner && !isSelf;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!member.user) return null;

  // Adjust position to stay in viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 250),
    left: Math.min(position.x, window.innerWidth - 220),
    zIndex: 9999,
  };

  const handleKick = async () => {
    setLoading(true);
    try {
      await kickMember(guildId, member.user!.id);
      removeMember(guildId, member.user!.id);
      onClose();
    } catch {
      setLoading(false);
    }
  };

  const handleBan = async () => {
    setLoading(true);
    try {
      await banMember(guildId, member.user!.id, banReason || undefined);
      removeMember(guildId, member.user!.id);
      onClose();
    } catch {
      setLoading(false);
    }
  };

  const handleNickSave = async () => {
    setLoading(true);
    try {
      await updateMember(guildId, member.user!.id, { nick: nickValue || undefined });
      onClose();
    } catch {
      setLoading(false);
    }
  };

  const menuItemClass =
    'w-full px-3 py-2 text-sm text-left rounded flex items-center gap-2 transition-colors duration-fast';

  const content = (
    <div
      ref={ref}
      style={menuStyle}
      className="w-[210px] rounded-lg p-1.5 shadow-xl"
    >
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'var(--color-surface-overlay)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {member.nick || member.user?.globalName || member.user?.username}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
            @{member.user?.username}
          </p>
        </div>

        <div className="p-1">
          {/* Edit Nickname */}
          {canManage && !confirmAction && !editNick && (
            <button
              className={menuItemClass}
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-raised)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
              onClick={() => setEditNick(true)}
            >
              <Edit3 size={14} />
              Change Nickname
            </button>
          )}

          {/* Nickname edit inline */}
          {editNick && (
            <div className="px-2 py-1.5 space-y-2">
              <input
                autoFocus
                value={nickValue}
                onChange={(e) => setNickValue(e.target.value)}
                placeholder="Nickname"
                className="w-full px-2 py-1.5 rounded text-sm outline-none"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNickSave();
                  if (e.key === 'Escape') setEditNick(false);
                }}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleNickSave}
                  disabled={loading}
                  className="flex-1 py-1 rounded text-xs font-medium text-white"
                  style={{ background: 'var(--color-accent-primary)' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditNick(false)}
                  className="flex-1 py-1 rounded text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-raised)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Separator */}
          {canManage && !editNick && !confirmAction && (
            <div className="my-1 border-t" style={{ borderColor: 'var(--color-border-subtle)' }} />
          )}

          {/* Kick */}
          {canManage && !confirmAction && !editNick && (
            <button
              className={menuItemClass}
              style={{ color: 'var(--color-danger-default)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-danger-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => setConfirmAction('kick')}
            >
              <UserMinus size={14} />
              Kick {member.user?.username}
            </button>
          )}

          {/* Ban */}
          {canManage && !confirmAction && !editNick && (
            <button
              className={menuItemClass}
              style={{ color: 'var(--color-danger-default)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-danger-muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => setConfirmAction('ban')}
            >
              <Ban size={14} />
              Ban {member.user?.username}
            </button>
          )}

          {/* Confirm dialogs */}
          {confirmAction === 'kick' && (
            <div className="px-2 py-2 space-y-2">
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Kick <strong>{member.user?.username}</strong> from the server?
              </p>
              <div className="flex gap-1">
                <button
                  onClick={handleKick}
                  disabled={loading}
                  className="flex-1 py-1.5 rounded text-xs font-medium text-white"
                  style={{ background: 'var(--color-danger-default)' }}
                >
                  {loading ? 'Kicking...' : 'Kick'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-1.5 rounded text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-raised)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {confirmAction === 'ban' && (
            <div className="px-2 py-2 space-y-2">
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Ban <strong>{member.user?.username}</strong> from the server?
              </p>
              <input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full px-2 py-1.5 rounded text-xs outline-none"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleBan}
                  disabled={loading}
                  className="flex-1 py-1.5 rounded text-xs font-medium text-white"
                  style={{ background: 'var(--color-danger-default)' }}
                >
                  {loading ? 'Banning...' : 'Ban'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-1.5 rounded text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-raised)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* If not owner, show nothing actionable */}
          {!canManage && !editNick && !confirmAction && (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              No actions available
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
