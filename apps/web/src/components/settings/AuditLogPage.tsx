'use client';

import { useState, useEffect } from 'react';
import { ScrollText, Filter, ChevronDown } from 'lucide-react';
import { getAuditLog, type AuditLogEntry } from '@/lib/api/moderation.api';
import { toastError } from '@/lib/toast';

const ACTION_LABELS: Record<string, string> = {
  GUILD_UPDATE: 'Server Updated',
  CHANNEL_CREATE: 'Channel Created',
  CHANNEL_UPDATE: 'Channel Updated',
  CHANNEL_DELETE: 'Channel Deleted',
  ROLE_CREATE: 'Role Created',
  ROLE_UPDATE: 'Role Updated',
  ROLE_DELETE: 'Role Deleted',
  MEMBER_KICK: 'Member Kicked',
  MEMBER_BAN_ADD: 'Member Banned',
  MEMBER_BAN_REMOVE: 'Member Unbanned',
  MEMBER_UPDATE: 'Member Updated',
  MEMBER_ROLE_UPDATE: 'Member Roles Updated',
  MESSAGE_DELETE: 'Message Deleted',
  MESSAGE_BULK_DELETE: 'Messages Bulk Deleted',
  MESSAGE_PIN: 'Message Pinned',
  MESSAGE_UNPIN: 'Message Unpinned',
  INVITE_CREATE: 'Invite Created',
  INVITE_DELETE: 'Invite Deleted',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function AuditLogPage({ guildId }: { guildId: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAuditLog(guildId, { actionType: filterAction || undefined, limit: 50 })
      .then((res) => {
        if (!cancelled) setEntries(res.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          // API might not exist yet — show empty
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [guildId, filterAction]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Audit Log
        </h2>

        <div className="relative">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <Filter size={12} />
            {filterAction ? (ACTION_LABELS[filterAction] ?? filterAction) : 'All Actions'}
            <ChevronDown size={12} />
          </button>

          {showFilter && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-20 rounded-xl py-1 max-h-64 overflow-y-auto w-52 shadow-lg"
                style={{
                  background: 'var(--color-surface-overlay)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <button
                  onClick={() => { setFilterAction(''); setShowFilter(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                  style={{
                    color: !filterAction ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                    background: !filterAction ? 'var(--color-accent-subtle)' : 'transparent',
                  }}
                >
                  All Actions
                </button>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setFilterAction(key); setShowFilter(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                    style={{
                      color: filterAction === key ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                      background: filterAction === key ? 'var(--color-accent-subtle)' : 'transparent',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-text-disabled)', borderTopColor: 'var(--color-accent-primary)' }} />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <ScrollText size={48} style={{ color: 'var(--color-text-disabled)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            No audit log entries found
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{ background: 'var(--color-surface-raised)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {entry.username ?? entry.userId}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: 'var(--color-surface-overlay)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {ACTION_LABELS[entry.actionType] ?? entry.actionType}
                  </span>
                </div>
                {entry.reason && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                    Reason: {entry.reason}
                  </p>
                )}
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }}>
                {formatDate(entry.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
