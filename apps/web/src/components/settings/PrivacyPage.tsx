'use client';

import { useState, useEffect } from 'react';
import { Shield, Eye, UserX, MessageSquareOff } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { getRelationships, unblockUser, type RelationshipPayload } from '@/lib/api/friends.api';
import { toastSuccess, toastError } from '@/lib/toast';

function ToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: typeof Shield;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon
          size={18}
          className="mt-0.5 flex-shrink-0"
          style={{ color: 'var(--color-text-secondary)' }}
        />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {description}
          </p>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
        style={{
          background: value ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
          border: value ? 'none' : '1px solid var(--color-border-default)',
        }}
        role="switch"
        aria-checked={value}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: value ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  );
}

function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {description}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: value === opt.id ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
              color: value === opt.id ? '#fff' : 'var(--color-text-secondary)',
              border: value === opt.id ? 'none' : '1px solid var(--color-border-subtle)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PrivacyPage() {
  // Local state — will be connected to backend/store when APIs are ready
  const [dmFromServers, setDmFromServers] = useState(true);
  const [dmFromFriends, setDmFromFriends] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [filterExplicit, setFilterExplicit] = useState(true);
  const [whoCanDM, setWhoCanDM] = useState('everyone');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Privacy & Safety
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Control who can contact you and what information others can see.
        </p>
      </div>

      {/* Safe Direct Messaging */}
      <section className="space-y-1">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Safe Direct Messaging
        </p>
        <div
          className="p-4 rounded-xl space-y-1"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <ToggleRow
            icon={MessageSquareOff}
            label="Filter explicit content"
            description="Automatically scan and delete direct messages that may contain explicit media."
            value={filterExplicit}
            onChange={setFilterExplicit}
          />
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* DM Settings */}
      <section className="space-y-1">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Direct Messages
        </p>
        <div
          className="p-4 rounded-xl space-y-1"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <SelectRow
            label="Who can send you direct messages"
            description="Choose who is allowed to send you a DM."
            value={whoCanDM}
            options={[
              { id: 'everyone', label: 'Everyone' },
              { id: 'friends', label: 'Friends Only' },
              { id: 'none', label: 'No One' },
            ]}
            onChange={setWhoCanDM}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Eye}
            label="Allow DMs from server members"
            description="Allow direct messages from people in your shared servers."
            value={dmFromServers}
            onChange={setDmFromServers}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Eye}
            label="Allow DMs from friends of friends"
            description="Allow direct messages from friends of your existing friends."
            value={dmFromFriends}
            onChange={setDmFromFriends}
          />
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Privacy */}
      <section className="space-y-1">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Privacy
        </p>
        <div
          className="p-4 rounded-xl space-y-1"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <ToggleRow
            icon={UserX}
            label="Allow friend requests from everyone"
            description="When disabled, only people you share a server with can add you."
            value={allowFriendRequests}
            onChange={setAllowFriendRequests}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Shield}
            label="Show current activity as status"
            description="Let others see what you are currently doing (e.g., playing a game)."
            value={showActivity}
            onChange={setShowActivity}
          />
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Blocked Users */}
      <BlockedUsersSection />
    </div>
  );
}

function BlockedUsersSection() {
  const [blocked, setBlocked] = useState<RelationshipPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRelationships()
      .then((rels) => {
        if (!cancelled) setBlocked(rels.filter((r) => r.type === 'BLOCKED'));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleUnblock = async (userId: string) => {
    setUnblocking(userId);
    try {
      await unblockUser(userId);
      setBlocked((prev) => prev.filter((b) => b.user.id !== userId));
      toastSuccess('User unblocked');
    } catch {
      toastError('Failed to unblock user');
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <section className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider mb-3"
        style={{ color: 'var(--color-text-disabled)' }}>
        Blocked Users
      </p>
      <div className="p-4 rounded-xl" style={{ background: 'var(--color-surface-raised)' }}>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--color-text-disabled)', borderTopColor: 'var(--color-accent-primary)' }} />
          </div>
        ) : blocked.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-tertiary)' }}>
            No blocked users
          </p>
        ) : (
          <div className="space-y-1">
            {blocked.map((rel) => (
              <div key={rel.user.id} className="flex items-center gap-3 py-2 group">
                <Avatar
                  displayName={rel.user.globalName ?? rel.user.username}
                  userId={rel.user.id}
                  src={rel.user.avatar}
                  size="sm"
                />
                <span className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>
                  {rel.user.globalName ?? rel.user.username}
                </span>
                <button
                  onClick={() => handleUnblock(rel.user.id)}
                  disabled={unblocking === rel.user.id}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors opacity-0 group-hover:opacity-100"
                  style={{
                    background: 'var(--color-danger-muted)',
                    color: 'var(--color-danger-default)',
                  }}
                >
                  {unblocking === rel.user.id ? 'Unblocking...' : 'Unblock'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
