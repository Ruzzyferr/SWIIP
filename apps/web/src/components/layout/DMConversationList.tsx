'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Users, Plus, X, MessageSquare } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDMsStore } from '@/stores/dms.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useFriendsStore } from '@/stores/friends.store';
import { useUIStore } from '@/stores/ui.store';
import { getDMConversations } from '@/lib/api/dms.api';
import { ChannelType, type DMChannelPayload } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// DM conversation item
// ---------------------------------------------------------------------------

function DMItem({
  dm,
  isActive,
  currentUserId,
  onClick,
  onClose,
}: {
  dm: DMChannelPayload;
  isActive: boolean;
  currentUserId: string;
  onClick: () => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const otherUser = dm.recipients?.find((r) => r.id !== currentUserId) ?? dm.recipients?.[0];
  const isGroup = dm.type === ChannelType.GROUP_DM;

  const displayName = isGroup
    ? (dm.name ?? dm.recipients?.map((r) => r.globalName ?? r.username).join(', ') ?? 'Group')
    : (otherUser?.globalName ?? otherUser?.username ?? 'Unknown');

  const otherUserId = otherUser?.id;
  const status = usePresenceStore((s) =>
    otherUserId && !isGroup ? (s.users[otherUserId]?.status ?? 'offline') : null
  );

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left"
      style={{
        background: isActive
          ? 'var(--color-accent-subtle)'
          : hovered
          ? 'var(--color-surface-raised)'
          : 'transparent',
        color: isActive || hovered
          ? 'var(--color-text-primary)'
          : 'var(--color-text-secondary)',
      }}
    >
      {isGroup ? (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--color-surface-overlay)' }}
        >
          <Users size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      ) : (
        <Avatar
          src={otherUser?.avatar}
          displayName={displayName}
          size="md"
          status={status as any}
        />
      )}

      <span className="text-sm truncate flex-1">{displayName}</span>

      {hovered && (
        <Tooltip content="Close DM" placement="top">
          <div
            className="p-0.5 rounded opacity-60 hover:opacity-100 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X size={14} />
          </div>
        </Tooltip>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pending friend request badge
// ---------------------------------------------------------------------------

function PendingFriendBadge() {
  const count = useFriendsStore((s) =>
    s.relationships.filter((r) => r.type === 'PENDING_INCOMING').length
  );
  if (count === 0) return null;
  return (
    <span
      className="ml-auto flex items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0"
      style={{
        background: 'var(--color-danger-default)',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main list
// ---------------------------------------------------------------------------

export function DMConversationList() {
  const router = useRouter();
  const pathname = usePathname();
  const conversations = useDMsStore((s) => s.conversations);
  const setConversations = useDMsStore((s) => s.setConversations);
  const removeConversation = useDMsStore((s) => s.removeConversation);
  const isLoaded = useDMsStore((s) => s.isLoaded);
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isLoaded) {
      getDMConversations()
        .then(setConversations)
        .catch(console.error);
    }
  }, [isLoaded, setConversations]);

  const dmList = Object.values(conversations);

  // Extract active DM ID from pathname
  const activeDMId = pathname?.startsWith('/channels/@me/')
    ? pathname.split('/channels/@me/')[1]
    : null;

  const handleDMClick = (dmId: string) => {
    router.push(`/channels/@me/${dmId}`);
  };

  const handleCloseDM = (dmId: string) => {
    removeConversation(dmId);
    if (activeDMId === dmId) {
      router.push('/channels/@me');
    }
  };

  return (
    <div className="space-y-1">
      {/* Friends button */}
      <button
        onClick={() => router.push('/channels/@me')}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left"
        style={{
          background: !activeDMId && pathname === '/channels/@me'
            ? 'var(--color-accent-subtle)'
            : 'transparent',
          color: !activeDMId
            ? 'var(--color-text-primary)'
            : 'var(--color-text-secondary)',
        }}
      >
        <Users size={20} style={{ opacity: 0.8 }} />
        <span className="text-sm font-medium">Friends</span>
        <PendingFriendBadge />
      </button>

      {/* DM header */}
      <div className="flex items-center justify-between px-2 pt-3 pb-1">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Direct Messages
        </p>
        <Tooltip content="Create DM" placement="top">
          <button
            className="opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => {
              useUIStore.getState().openModal('create-dm', {});
            }}
          >
            <Plus size={14} />
          </button>
        </Tooltip>
      </div>

      {/* DM list */}
      {dmList.length === 0 && (
        <div className="py-4 text-center">
          <MessageSquare size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-disabled)' }} />
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            No conversations yet
          </p>
        </div>
      )}

      {dmList.map((dm) => (
        <DMItem
          key={dm.id}
          dm={dm}
          isActive={activeDMId === dm.id}
          currentUserId={currentUser?.id ?? ''}
          onClick={() => handleDMClick(dm.id)}
          onClose={() => handleCloseDM(dm.id)}
        />
      ))}
    </div>
  );
}
