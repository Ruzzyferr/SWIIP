'use client';

import { useState, useEffect } from 'react';
import { Ban, UserX } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { getBans, type BanEntry } from '@/lib/api/moderation.api';
import { unbanMember } from '@/lib/api/guilds.api';
import { toastSuccess, toastError } from '@/lib/toast';

export function BanListPage({ guildId }: { guildId: string }) {
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanning, setUnbanning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBans(guildId)
      .then((res) => {
        if (!cancelled) setBans(res ?? []);
      })
      .catch(() => {
        if (!cancelled) setBans([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [guildId]);

  const handleUnban = async (userId: string) => {
    setUnbanning(userId);
    try {
      await unbanMember(guildId, userId);
      setBans((prev) => prev.filter((b) => b.userId !== userId));
      toastSuccess('Member unbanned');
    } catch (err: any) {
      toastError(err?.response?.data?.message ?? 'Failed to unban member');
    } finally {
      setUnbanning(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Bans — {bans.length}
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-text-disabled)', borderTopColor: 'var(--color-accent-primary)' }} />
        </div>
      ) : bans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Ban size={48} style={{ color: 'var(--color-text-disabled)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            No banned members
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {bans.map((ban) => (
            <div
              key={ban.userId}
              className="flex items-center gap-3 px-3 py-2 rounded-lg group"
              style={{ background: 'var(--color-surface-raised)' }}
            >
              <Avatar
                displayName={ban.username ?? ban.userId}
                userId={ban.userId}
                src={ban.avatar}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block"
                  style={{ color: 'var(--color-text-primary)' }}>
                  {ban.username ?? ban.userId}
                </span>
                {ban.reason && (
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    Reason: {ban.reason}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUnban(ban.userId)}
                loading={unbanning === ban.userId}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <UserX size={14} className="mr-1" /> Unban
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
