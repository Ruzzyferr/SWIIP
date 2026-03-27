'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  MessageSquare,
  MoreVertical,
  Check,
  X,
  Search,
  Clock,
  Ban,
  Menu,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useUIStore } from '@/stores/ui.store';
import { useFriendsStore } from '@/stores/friends.store';
import { usePresenceStore } from '@/stores/presence.store';
import {
  getRelationships,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  blockUser,
  type RelationshipPayload,
  type RelationshipType,
} from '@/lib/api/friends.api';
import { openDM } from '@/lib/api/dms.api';
import { useDMsStore } from '@/stores/dms.store';
import { toastSuccess, toastError } from '@/lib/toast';
import type { PresenceStatus } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type FriendsTab = 'online' | 'all' | 'pending' | 'blocked' | 'add';

// ---------------------------------------------------------------------------
// Add Friend form
// ---------------------------------------------------------------------------

function AddFriendForm() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('idle');

    // Parse "username#discriminator"
    const parts = input.split('#');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setStatus('error');
      setMessage('Enter a username in the format Username#0001');
      return;
    }

    try {
      await sendFriendRequest(parts[0]!, parts[1]!);
      setStatus('success');
      setMessage(`Friend request sent to ${input}!`);
      setInput('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message ?? 'Failed to send friend request');
    }
  };

  return (
    <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-1"
        style={{ color: 'var(--color-text-primary)' }}>
        Add Friend
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        You can add friends with their username and discriminator.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setStatus('idle'); }}
            placeholder="Username#0001"
            className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
            style={{
              background: 'var(--color-surface-base)',
              color: 'var(--color-text-primary)',
              border: status === 'error'
                ? '1px solid var(--color-danger-default)'
                : status === 'success'
                ? '1px solid var(--color-success-default)'
                : '1px solid var(--color-border-default)',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          style={{
            background: 'var(--color-accent-primary)',
            color: '#fff',
            opacity: input.trim() ? 1 : 0.5,
          }}
        >
          Send Request
        </button>
      </form>
      {status !== 'idle' && (
        <p className="text-xs mt-2" style={{
          color: status === 'success'
            ? 'var(--color-success-default)'
            : 'var(--color-danger-default)',
        }}>
          {message}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Friend row
// ---------------------------------------------------------------------------

function FriendRow({
  relationship,
  onMessage,
  onAccept,
  onRemove,
}: {
  relationship: RelationshipPayload;
  onMessage: () => void;
  onAccept?: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const presence = usePresenceStore((s) => s.users[relationship.user.id]);
  const status = (presence?.status ?? 'offline') as PresenceStatus;

  const isPending = relationship.type === 'PENDING_INCOMING' || relationship.type === 'PENDING_OUTGOING';
  const isBlocked = relationship.type === 'BLOCKED';

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors cursor-pointer"
      style={{
        background: hovered ? 'var(--color-surface-raised)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
    >
      <Avatar
        src={relationship.user.avatar}
        displayName={relationship.user.globalName ?? relationship.user.username}
        size="lg"
        status={isPending || isBlocked ? null : status}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium truncate"
            style={{ color: 'var(--color-text-primary)' }}>
            {relationship.user.globalName ?? relationship.user.username}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            #{relationship.user.discriminator}
          </span>
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {isPending && relationship.type === 'PENDING_INCOMING' && 'Incoming friend request'}
          {isPending && relationship.type === 'PENDING_OUTGOING' && 'Outgoing friend request'}
          {isBlocked && 'Blocked'}
          {relationship.type === 'FRIEND' && (
            status === 'online' ? 'Online' :
            status === 'idle' ? 'Idle' :
            status === 'dnd' ? 'Do Not Disturb' :
            'Offline'
          )}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {relationship.type === 'PENDING_INCOMING' && onAccept && (
          <Tooltip content="Accept" placement="top">
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
            >
              <Check size={16} />
            </button>
          </Tooltip>
        )}

        {relationship.type === 'PENDING_INCOMING' && (
          <Tooltip content="Decline" placement="top">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
            >
              <X size={16} />
            </button>
          </Tooltip>
        )}

        {relationship.type === 'FRIEND' && (
          <Tooltip content="Message" placement="top">
            <button
              onClick={(e) => { e.stopPropagation(); onMessage(); }}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
            >
              <MessageSquare size={16} />
            </button>
          </Tooltip>
        )}

        {!isPending && (
          <Tooltip content={isBlocked ? 'Unblock' : 'More'} placement="top">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
            >
              <MoreVertical size={16} />
            </button>
          </Tooltip>
        )}

        {relationship.type === 'PENDING_OUTGOING' && (
          <Tooltip content="Cancel" placement="top">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
            >
              <X size={16} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FriendsList component
// ---------------------------------------------------------------------------

export function FriendsList() {
  const router = useRouter();
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);
  const [activeTab, setActiveTab] = useState<FriendsTab>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const relationships = useFriendsStore((s) => s.relationships);
  const setRelationships = useFriendsStore((s) => s.setRelationships);
  const isLoaded = useFriendsStore((s) => s.isLoaded);
  const addConversation = useDMsStore((s) => s.addConversation);
  const presences = usePresenceStore((s) => s.users);

  useEffect(() => {
    if (!isLoaded) {
      getRelationships()
        .then(setRelationships)
        .catch(console.error);
    }
  }, [isLoaded, setRelationships]);

  const handleMessage = useCallback(async (userId: string) => {
    try {
      const dm = await openDM(userId);
      addConversation(dm);
      router.push(`/channels/@me/${dm.id}`);
    } catch (err) {
      console.error('Failed to open DM:', err);
    }
  }, [addConversation, router]);

  const handleAccept = useCallback(async (targetId: string) => {
    try {
      await acceptFriendRequest(targetId);
      const updated = await getRelationships();
      setRelationships(updated);
      toastSuccess('Friend request accepted!');
    } catch (err: any) {
      toastError(err?.message ?? 'Failed to accept friend request');
    }
  }, [setRelationships]);

  const handleRemove = useCallback(async (targetId: string) => {
    try {
      await removeFriend(targetId);
      const updated = await getRelationships();
      setRelationships(updated);
      toastSuccess('Removed successfully');
    } catch (err: any) {
      toastError(err?.message ?? 'Failed to remove');
    }
  }, [setRelationships]);

  // Filter relationships by tab
  const filtered = useMemo(() => relationships.filter((r) => {
    if (activeTab === 'online') {
      return r.type === 'FRIEND' && (presences[r.user.id]?.status ?? 'offline') !== 'offline';
    }
    if (activeTab === 'all') return r.type === 'FRIEND';
    if (activeTab === 'pending') return r.type === 'PENDING_INCOMING' || r.type === 'PENDING_OUTGOING';
    if (activeTab === 'blocked') return r.type === 'BLOCKED';
    return false;
  }), [relationships, activeTab, presences]);

  // Search filter
  const displayed = useMemo(() => searchQuery
    ? filtered.filter((r) => {
        const name = (r.user.globalName ?? r.user.username).toLowerCase();
        return name.includes(searchQuery.toLowerCase());
      })
    : filtered, [filtered, searchQuery]);

  const pendingCount = useMemo(() => relationships.filter(
    (r) => r.type === 'PENDING_INCOMING'
  ).length, [relationships]);

  const tabs: { id: FriendsTab; label: string; badge?: number }[] = [
    { id: 'online', label: 'Online' },
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending', badge: pendingCount },
    { id: 'blocked', label: 'Blocked' },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface-base)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-4 px-4 h-12 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        {/* Mobile hamburger */}
        <button
          onClick={toggleMobileNav}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast md:hidden"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Open channels menu"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <Users size={20} />
          <span className="font-semibold text-sm">Friends</span>
        </div>

        <div className="h-5 w-px mx-1" style={{ background: 'var(--color-border-default)' }} />

        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 py-1 rounded text-sm font-medium transition-colors relative"
            style={{
              background: activeTab === tab.id ? 'var(--color-surface-overlay)' : 'transparent',
              color: activeTab === tab.id
                ? 'var(--color-text-primary)'
                : 'var(--color-text-secondary)',
            }}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 ? (
              <span
                className="ml-1.5 inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold"
                style={{
                  background: 'var(--color-danger-default)',
                  color: '#fff',
                }}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}

        <button
          onClick={() => setActiveTab('add')}
          className="px-3 py-1 rounded text-sm font-medium transition-colors"
          style={{
            background: activeTab === 'add' ? 'transparent' : 'var(--color-success-default)',
            color: activeTab === 'add' ? 'var(--color-success-default)' : '#fff',
            border: activeTab === 'add' ? '1px solid var(--color-success-default)' : 'none',
          }}
        >
          Add Friend
        </button>
      </div>

      {/* Add friend form */}
      {activeTab === 'add' && <AddFriendForm />}

      {/* Search */}
      {activeTab !== 'add' && (
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-md pl-9 pr-3 py-1.5 text-sm outline-none"
              style={{
                background: 'var(--color-surface-base)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-default)',
              }}
            />
          </div>
        </div>
      )}

      {/* List */}
      {activeTab !== 'add' && (
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-2"
            style={{ color: 'var(--color-text-disabled)' }}>
            {activeTab === 'online' ? 'Online' : activeTab === 'all' ? 'All Friends' : activeTab === 'pending' ? 'Pending' : 'Blocked'}
            {' — '}{displayed.length}
          </p>

          {displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              {activeTab === 'pending' ? (
                <Clock size={48} style={{ color: 'var(--color-text-disabled)' }} />
              ) : activeTab === 'blocked' ? (
                <Ban size={48} style={{ color: 'var(--color-text-disabled)' }} />
              ) : (
                <Users size={48} style={{ color: 'var(--color-text-disabled)' }} />
              )}
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                {searchQuery
                  ? 'No results found'
                  : activeTab === 'online'
                  ? 'No friends online right now'
                  : activeTab === 'pending'
                  ? 'No pending requests'
                  : activeTab === 'blocked'
                  ? 'No blocked users'
                  : 'No friends yet. Add someone!'}
              </p>
            </div>
          )}

          {displayed.map((rel) => (
            <FriendRow
              key={rel.id}
              relationship={rel}
              onMessage={() => handleMessage(rel.user.id)}
              onAccept={
                rel.type === 'PENDING_INCOMING'
                  ? () => handleAccept(rel.user.id)
                  : undefined
              }
              onRemove={() => handleRemove(rel.user.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
