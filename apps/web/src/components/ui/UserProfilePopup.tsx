'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, UserPlus, UserMinus, ShieldOff, Loader2, Check, X, Ban, Link2, Calendar, Shield, Star, Bot, BadgeCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useUIStore } from '@/stores/ui.store';
import { usePresenceStore } from '@/stores/presence.store';
import {
  getUserProfile,
  getMutualGuilds,
  sendFriendRequest,
  removeFriend,
  acceptFriendRequest,
  blockUser,
  unblockUser,
  getUserNote,
  setUserNote,
  type UserProfile,
  type RelationshipType,
} from '@/lib/api/friends.api';
import { openDM } from '@/lib/api/dms.api';
import { useDMsStore } from '@/stores/dms.store';
import { toastError } from '@/lib/toast';

// Badge definitions based on user flags
const USER_BADGES: Array<{ flag: number; label: string; icon: typeof Star; color: string }> = [
  { flag: 1 << 0, label: 'Staff', icon: Shield, color: '#5865f2' },
  { flag: 1 << 1, label: 'Partner', icon: BadgeCheck, color: '#5865f2' },
  { flag: 1 << 2, label: 'Early Supporter', icon: Star, color: '#faa61a' },
  { flag: 1 << 3, label: 'Bug Hunter', icon: Star, color: '#3ba55c' },
  { flag: 1 << 4, label: 'Premium', icon: Star, color: '#f47fff' },
];

function getUserBadges(flags: number | string | undefined) {
  if (!flags) return [];
  const f = typeof flags === 'string' ? parseInt(flags, 10) : flags;
  return USER_BADGES.filter((b) => (f & b.flag) === b.flag);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function UserProfilePopup() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const router = useRouter();

  const userId = (activeModal?.props as { userId?: string })?.userId;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mutualGuilds, setMutualGuilds] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [relationshipType, setRelationshipType] = useState<RelationshipType | null>(null);
  const [note, setNote] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNote, setEditingNote] = useState(false);

  const status = usePresenceStore((s) => userId ? (s.users[userId]?.status ?? 'offline') : 'offline');
  const customStatus = usePresenceStore((s) => userId ? s.users[userId]?.customStatus : undefined);
  const customStatusEmoji = usePresenceStore((s) => userId ? s.users[userId]?.customStatusEmoji : undefined);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      getUserProfile(userId).catch(() => null),
      getMutualGuilds(userId).catch(() => []),
      getUserNote(userId).catch(() => ({ content: '' })),
    ]).then(([prof, guilds, noteData]) => {
      setProfile(prof);
      setRelationshipType(prof?.relationshipType ?? null);
      setMutualGuilds(guilds);
      setNote(noteData.content);
      setNoteDraft(noteData.content);
      setLoading(false);
    });
  }, [userId]);

  const addConversation = useDMsStore((s) => s.addConversation);

  const handleSendDM = useCallback(async () => {
    if (!userId) return;
    try {
      const dm = await openDM(userId);
      addConversation(dm);
      closeModal();
      router.push(`/channels/@me/${dm.id}`);
    } catch {
      toastError('Failed to open DM');
    }
  }, [userId, addConversation, closeModal, router]);

  const handleAddFriend = useCallback(async () => {
    if (!profile?.user?.username) return;
    try {
      await sendFriendRequest(profile.user.username, profile.user.discriminator ?? '0');
      setRelationshipType('PENDING_OUTGOING');
    } catch {
      toastError('Failed to send friend request');
    }
  }, [profile]);

  const handleRemoveFriend = useCallback(async () => {
    if (!userId) return;
    try {
      await removeFriend(userId);
      setRelationshipType(null);
    } catch {
      toastError('Failed to remove friend');
    }
  }, [userId]);

  const handleBlock = useCallback(async () => {
    if (!userId) return;
    try {
      await blockUser(userId);
      setRelationshipType('BLOCKED');
    } catch {
      toastError('Failed to block user');
    }
  }, [userId]);

  const handleAcceptFriend = useCallback(async () => {
    if (!userId) return;
    try {
      await acceptFriendRequest(userId);
      setRelationshipType('FRIEND');
    } catch {
      toastError('Failed to accept friend request');
    }
  }, [userId]);

  const handleDeclineFriend = useCallback(async () => {
    if (!userId) return;
    try {
      await removeFriend(userId);
      setRelationshipType(null);
    } catch {
      toastError('Failed to decline friend request');
    }
  }, [userId]);

  const handleUnblock = useCallback(async () => {
    if (!userId) return;
    try {
      await unblockUser(userId);
      setRelationshipType(null);
    } catch {
      toastError('Failed to unblock user');
    }
  }, [userId]);

  if (!userId) return null;

  const user = profile?.user;
  const displayName = user?.globalName ?? user?.username ?? 'Unknown';
  const username = user?.username ?? '';

  return (
    <div style={{ margin: '-24px', width: 'calc(100% + 48px)' }}>
      {/* Banner area */}
      <div
        className="h-24 rounded-t-xl"
        style={{
          background: user?.banner
            ? `url(${user.banner}) center/cover`
            : 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-hover))',
        }}
      />

      {/* Avatar + info */}
      <div className="px-4 pb-4">
        <div className="flex items-end gap-3 -mt-10">
          <div
            className="rounded-full p-1"
            style={{ background: 'var(--color-surface-floating)' }}
          >
            <Avatar
              userId={userId}
              src={user?.avatar}
              displayName={displayName}
              size="xl"
              status={status as any}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-6 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
        ) : (
          <>
            <div className="mt-3">
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {displayName}
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {username}{user?.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}
              </p>
              {(customStatus || customStatusEmoji) && (
                <p className="text-sm mt-1 flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {customStatusEmoji && <span className="text-base">{customStatusEmoji}</span>}
                  {customStatus}
                </p>
              )}
            </div>

            {/* Badges */}
            {(() => {
              const badges = getUserBadges((user as any)?.flags);
              if (badges.length === 0 && !(user as any)?.isBot) return null;
              return (
                <div className="flex items-center gap-1.5 mt-2">
                  {(user as any)?.isBot && (
                    <span
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
                    >
                      <Bot size={10} /> BOT
                    </span>
                  )}
                  {badges.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <span
                        key={badge.flag}
                        title={badge.label}
                        className="flex items-center justify-center w-6 h-6 rounded-full"
                        style={{ background: `${badge.color}20`, color: badge.color }}
                      >
                        <Icon size={14} />
                      </span>
                    );
                  })}
                </div>
              );
            })()}

            {/* Bio */}
            {(user as any)?.bio && (
              <div
                className="mt-3 rounded-lg p-3 text-sm"
                style={{
                  background: 'var(--color-surface-raised)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {(user as any).bio}
              </div>
            )}

            {/* Profile Links */}
            {(user as any)?.profileLinks?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-disabled)' }}>
                  Links
                </p>
                <div className="flex flex-col gap-1">
                  {(user as any).profileLinks.map((link: { label: string; url: string }, i: number) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors"
                      style={{
                        background: 'var(--color-surface-raised)',
                        color: 'var(--color-accent-primary)',
                      }}
                    >
                      <Link2 size={12} />
                      {link.label || link.url}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Member Since */}
            {(user as any)?.createdAt && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-disabled)' }}>
                  Member Since
                </p>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  <Calendar size={12} />
                  {formatDate((user as any).createdAt)}
                </div>
              </div>
            )}

            {/* Mutual guilds */}
            {mutualGuilds.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-disabled)' }}>
                  Mutual Servers — {mutualGuilds.length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {mutualGuilds.slice(0, 10).map((g) => (
                    <span
                      key={g.id}
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{
                        background: 'var(--color-surface-raised)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Note */}
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-disabled)' }}>
                Note
              </p>
              {editingNote ? (
                <div className="flex flex-col gap-1.5">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="w-full px-2.5 py-1.5 rounded-md text-xs resize-none"
                    style={{
                      background: 'var(--color-surface-base)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border-default)',
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        setUserNote(userId!, noteDraft).then((r) => {
                          setNote(r.content);
                          setEditingNote(false);
                        });
                      }
                      if (e.key === 'Escape') {
                        setNoteDraft(note);
                        setEditingNote(false);
                      }
                    }}
                  />
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => { setNoteDraft(note); setEditingNote(false); }}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setUserNote(userId!, noteDraft).then((r) => {
                          setNote(r.content);
                          setEditingNote(false);
                        });
                      }}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingNote(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md text-xs min-h-[28px]"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: note ? 'var(--color-text-secondary)' : 'var(--color-text-disabled)',
                  }}
                >
                  {note || 'Click to add a note'}
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 mt-4">
              <button
                onClick={handleSendDM}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: 'var(--color-accent-primary)',
                  color: '#fff',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-accent-primary)'; }}
              >
                <MessageSquare size={14} />
                Send Message
              </button>

              {relationshipType === 'FRIEND' ? (
                <button
                  onClick={handleRemoveFriend}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-danger-default)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-muted)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
                >
                  <UserMinus size={14} />
                  Remove
                </button>
              ) : relationshipType === 'PENDING_INCOMING' ? (
                <>
                  <button
                    onClick={handleAcceptFriend}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: 'var(--color-success-default)',
                      color: '#fff',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <Check size={14} />
                    Accept
                  </button>
                  <button
                    onClick={handleDeclineFriend}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: 'var(--color-surface-raised)',
                      color: 'var(--color-danger-default)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-muted)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
                  >
                    <X size={14} />
                    Decline
                  </button>
                </>
              ) : relationshipType === 'PENDING_OUTGOING' ? (
                <button
                  onClick={handleDeclineFriend}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-text-secondary)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-muted)'; e.currentTarget.style.color = 'var(--color-danger-default)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                >
                  <X size={14} />
                  Cancel Request
                </button>
              ) : relationshipType === 'BLOCKED' ? (
                <button
                  onClick={handleUnblock}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: 'var(--color-danger-muted)',
                    color: 'var(--color-danger-default)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  <ShieldOff size={14} />
                  Unblock
                </button>
              ) : (
                <button
                  onClick={handleAddFriend}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-success-default)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-success-muted)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
                >
                  <UserPlus size={14} />
                  Add Friend
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
