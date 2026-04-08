'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  UserMinus,
  ShieldOff,
  User,
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
  unblockUser,
  getFriendSuggestions,
  type RelationshipPayload,
  type FriendSuggestion,
} from '@/lib/api/friends.api';
import { openDM } from '@/lib/api/dms.api';
import { useDMsStore } from '@/stores/dms.store';
import { toastSuccess, toastError } from '@/lib/toast';
import { useTranslations } from 'next-intl';
import type { PresenceStatus } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Tab types
// ---------------------------------------------------------------------------

type FriendsTab = 'online' | 'all' | 'pending' | 'blocked' | 'add' | 'suggestions';

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
    } catch (err: unknown) {
      setStatus('error');
      const e = err as Record<string, unknown>;
      setMessage(((e?.response as Record<string, unknown>)?.data as Record<string, unknown>)?.message as string ?? (e?.message as string) ?? 'Failed to send friend request');
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
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
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
// Dropdown menu for friend actions
// ---------------------------------------------------------------------------

function FriendDropdown({
  relationship,
  onMessage,
  onRemove,
  onBlock,
  onUnblock,
  onProfile,
  onClose,
}: {
  relationship: RelationshipPayload;
  onMessage: () => void;
  onRemove: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onProfile: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const itemClass =
    'w-full px-3 py-1.5 text-sm text-left rounded flex items-center gap-2 transition-colors';

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg py-1 shadow-xl"
      style={{
        background: 'var(--color-surface-overlay)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <button
        className={itemClass}
        style={{ color: 'var(--color-text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
        onClick={() => { onProfile(); onClose(); }}
      >
        <User size={14} />
        Profile
      </button>

      {relationship.type === 'FRIEND' && (
        <button
          className={itemClass}
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          onClick={() => { onMessage(); onClose(); }}
        >
          <MessageSquare size={14} />
          Message
        </button>
      )}

      <div className="my-1 mx-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }} />

      {relationship.type === 'BLOCKED' ? (
        <button
          className={itemClass}
          style={{ color: 'var(--color-success-default)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-success-muted)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          onClick={() => { onUnblock(); onClose(); }}
        >
          <ShieldOff size={14} />
          Unblock
        </button>
      ) : (
        <>
          <button
            className={itemClass}
            style={{ color: 'var(--color-danger-default)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { onRemove(); onClose(); }}
          >
            <UserMinus size={14} />
            Remove Friend
          </button>
          <button
            className={itemClass}
            style={{ color: 'var(--color-danger-default)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => { onBlock(); onClose(); }}
          >
            <Ban size={14} />
            Block
          </button>
        </>
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
  onBlock,
  onUnblock,
  onProfile,
}: {
  relationship: RelationshipPayload;
  onMessage: () => void;
  onAccept?: () => void;
  onRemove: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onProfile: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const presence = usePresenceStore((s) => relationship.user ? s.users[relationship.user.id] : undefined);
  const status = (presence?.status ?? 'offline') as PresenceStatus;
  const customStatus = presence?.customStatus;

  const isPending = relationship.type === 'PENDING_INCOMING' || relationship.type === 'PENDING_OUTGOING';
  const isBlocked = relationship.type === 'BLOCKED';

  if (!relationship.user) return null;

  const statusText = isPending
    ? relationship.type === 'PENDING_INCOMING' ? 'Incoming friend request' : 'Outgoing friend request'
    : isBlocked
    ? 'Blocked'
    : customStatus
    ? customStatus
    : status === 'online' ? 'Online'
    : status === 'idle' ? 'Idle'
    : status === 'dnd' ? 'Do Not Disturb'
    : 'Offline';

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors cursor-pointer"
      style={{
        background: hovered ? 'var(--color-surface-raised)' : 'transparent',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      onClick={onProfile}
    >
      <Avatar
        src={relationship.user.avatar}
        displayName={relationship.user.globalName ?? relationship.user.username}
        size="lg"
        status={isPending || isBlocked ? undefined : status}
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
          {statusText}
        </p>
      </div>

      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Pending incoming: Accept + Decline */}
        {relationship.type === 'PENDING_INCOMING' && onAccept && (
          <Tooltip content="Accept" placement="top">
            <button
              onClick={onAccept}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-success-default)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <Check size={16} />
            </button>
          </Tooltip>
        )}
        {relationship.type === 'PENDING_INCOMING' && (
          <Tooltip content="Decline" placement="top">
            <button
              onClick={onRemove}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger-default)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <X size={16} />
            </button>
          </Tooltip>
        )}

        {/* Pending outgoing: Cancel */}
        {relationship.type === 'PENDING_OUTGOING' && (
          <Tooltip content="Cancel Request" placement="top">
            <button
              onClick={onRemove}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger-default)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <X size={16} />
            </button>
          </Tooltip>
        )}

        {/* Friend: Message button */}
        {relationship.type === 'FRIEND' && (
          <Tooltip content="Message" placement="top">
            <button
              onClick={onMessage}
              className="p-2 rounded-full transition-colors"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <MessageSquare size={16} />
            </button>
          </Tooltip>
        )}

        {/* More menu for friends and blocked */}
        {!isPending && (
          <div className="relative">
            <Tooltip content="More" placement="top">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-full transition-colors"
                style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              >
                <MoreVertical size={16} />
              </button>
            </Tooltip>
            {menuOpen && (
              <FriendDropdown
                relationship={relationship}
                onMessage={onMessage}
                onRemove={onRemove}
                onBlock={onBlock}
                onUnblock={onUnblock}
                onProfile={onProfile}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FriendsList component
// ---------------------------------------------------------------------------

export function FriendsList() {
  const t = useTranslations('friends');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);
  const openModal = useUIStore((s) => s.openModal);
  const [activeTab, setActiveTab] = useState<FriendsTab>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const relationships = useFriendsStore((s) => s.relationships);
  const setRelationships = useFriendsStore((s) => s.setRelationships);
  const isLoaded = useFriendsStore((s) => s.isLoaded);
  const addConversation = useDMsStore((s) => s.addConversation);
  const presences = usePresenceStore((s) => s.users);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  const refreshRelationships = useCallback(async () => {
    try {
      const updated = await getRelationships();
      setRelationships(updated);
    } catch (err) {
      console.error('Failed to refresh relationships:', err);
    }
  }, [setRelationships]);

  useEffect(() => {
    if (!isLoaded) {
      refreshRelationships();
    }
  }, [isLoaded, refreshRelationships]);

  useEffect(() => {
    if (activeTab === 'suggestions' && !suggestionsLoaded) {
      getFriendSuggestions()
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestionsLoaded(true));
    }
  }, [activeTab, suggestionsLoaded]);

  const handleMessage = useCallback(async (userId: string) => {
    try {
      const dm = await openDM(userId);
      addConversation(dm);
      router.push(`/channels/@me/${dm.id}`);
    } catch {
      toastError('Failed to open DM');
    }
  }, [addConversation, router]);

  const handleAccept = useCallback(async (targetId: string) => {
    try {
      await acceptFriendRequest(targetId);
      await refreshRelationships();
      toastSuccess('Friend request accepted!');
    } catch (err: unknown) {
      toastError((err as Error)?.message ?? 'Failed to accept');
    }
  }, [refreshRelationships]);

  const handleRemove = useCallback(async (targetId: string) => {
    try {
      await removeFriend(targetId);
      await refreshRelationships();
      toastSuccess('Removed successfully');
    } catch (err: unknown) {
      toastError((err as Error)?.message ?? 'Failed to remove');
    }
  }, [refreshRelationships]);

  const handleBlock = useCallback(async (targetId: string) => {
    try {
      await blockUser(targetId);
      await refreshRelationships();
      toastSuccess('User blocked');
    } catch (err: unknown) {
      toastError((err as Error)?.message ?? 'Failed to block');
    }
  }, [refreshRelationships]);

  const handleUnblock = useCallback(async (targetId: string) => {
    try {
      await unblockUser(targetId);
      await refreshRelationships();
      toastSuccess('User unblocked');
    } catch (err: unknown) {
      toastError((err as Error)?.message ?? 'Failed to unblock');
    }
  }, [refreshRelationships]);

  const handleProfile = useCallback((userId: string) => {
    openModal('user-profile', { userId });
  }, [openModal]);

  // Filter relationships by tab
  const filtered = useMemo(() => relationships.filter((r) => {
    if (!r.user) return false;
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
        const name = (r.user?.globalName ?? r.user?.username ?? '').toLowerCase();
        const uname = (r.user?.username ?? '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || uname.includes(q);
      })
    : filtered, [filtered, searchQuery]);

  // Sort: incoming first for pending, online first for friends
  const sorted = useMemo(() => [...displayed].sort((a, b) => {
    if (activeTab === 'pending') {
      if (a.type === 'PENDING_INCOMING' && b.type !== 'PENDING_INCOMING') return -1;
      if (a.type !== 'PENDING_INCOMING' && b.type === 'PENDING_INCOMING') return 1;
    }
    if (activeTab === 'online' || activeTab === 'all') {
      const aOnline = (presences[a.user?.id ?? '']?.status ?? 'offline') !== 'offline';
      const bOnline = (presences[b.user?.id ?? '']?.status ?? 'offline') !== 'offline';
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
    }
    const aName = a.user?.globalName ?? a.user?.username ?? '';
    const bName = b.user?.globalName ?? b.user?.username ?? '';
    return aName.localeCompare(bName);
  }), [displayed, activeTab, presences]);

  const pendingCount = useMemo(() => relationships.filter(
    (r) => r.type === 'PENDING_INCOMING'
  ).length, [relationships]);

  const tabs: { id: FriendsTab; label: string; badge?: number }[] = [
    { id: 'online', label: t('online') },
    { id: 'all', label: t('all') },
    { id: 'pending', label: t('pending'), badge: pendingCount },
    { id: 'blocked', label: t('blocked') },
    { id: 'suggestions', label: 'Suggestions' },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-surface-base)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 h-12 flex-shrink-0 min-w-0"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        {/* Mobile hamburger — opens DM conversation drawer */}
        <button
          onClick={toggleMobileNav}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast md:hidden shrink-0"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Open conversations menu"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 shrink-0" style={{ color: 'var(--color-text-primary)' }}>
          <Users size={18} className="sm:w-5 sm:h-5 shrink-0" />
          <span className="font-semibold text-sm whitespace-nowrap">{t('title')}</span>
        </div>

        <div className="h-5 w-px shrink-0 hidden sm:block" style={{ background: 'var(--color-border-default)' }} />

        <div className="flex flex-1 min-w-0 items-center gap-1 overflow-x-auto scroll-thin pb-0.5 -mr-1 pr-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
            className="px-2.5 sm:px-3 py-1 rounded text-sm font-medium transition-colors relative shrink-0"
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
          className="px-2.5 sm:px-3 py-1 rounded text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
          style={{
            background: activeTab === 'add' ? 'transparent' : 'var(--color-success-default)',
            color: activeTab === 'add' ? 'var(--color-success-default)' : '#fff',
            border: activeTab === 'add' ? '1px solid var(--color-success-default)' : 'none',
          }}
        >
          {t('addFriend')}
        </button>
        </div>
      </div>

      {/* Add friend form */}
      {activeTab === 'add' && <AddFriendForm />}

      {/* Suggestions */}
      {activeTab === 'suggestions' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-3"
            style={{ color: 'var(--color-text-disabled)' }}>
            Suggested Friends — {suggestions.length}
          </p>
          {!suggestionsLoaded && (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-text-disabled)', borderTopColor: 'transparent' }} />
            </div>
          )}
          {suggestionsLoaded && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Users size={48} style={{ color: 'var(--color-text-disabled)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No suggestions right now. Join more servers to find people!
              </p>
            </div>
          )}
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mb-1"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Avatar userId={s.id} src={s.avatar} displayName={s.globalName ?? s.username} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {s.globalName ?? s.username}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {s.mutualGuildCount} mutual server{s.mutualGuildCount !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await sendFriendRequest(s.username, s.discriminator);
                    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
                    toastSuccess('Friend request sent!');
                  } catch {
                    toastError('Failed to send request');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                style={{ background: 'var(--color-success-default)', color: '#fff' }}
              >
                <UserPlus size={12} />
                Add
              </button>
              <button
                onClick={() => openModal('user-profile', { userId: s.id })}
                className="p-1.5 rounded"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <User size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {activeTab !== 'add' && activeTab !== 'suggestions' && (
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
              placeholder={tCommon('search')}
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
      {activeTab !== 'add' && activeTab !== 'suggestions' && (
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider px-2 mb-2"
            style={{ color: 'var(--color-text-disabled)' }}>
            {activeTab === 'online' ? t('online') : activeTab === 'all' ? t('all') : activeTab === 'pending' ? t('pending') : t('blocked')}
            {' — '}{sorted.length}
          </p>

          {sorted.length === 0 && (
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
                  ? tCommon('none')
                  : activeTab === 'online'
                  ? t('noFriends')
                  : activeTab === 'pending'
                  ? t('noPending')
                  : activeTab === 'blocked'
                  ? t('noBlocked')
                  : t('noFriends')}
              </p>
            </div>
          )}

          {sorted.map((rel) => (
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
              onBlock={() => handleBlock(rel.user.id)}
              onUnblock={() => handleUnblock(rel.user.id)}
              onProfile={() => handleProfile(rel.user.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
