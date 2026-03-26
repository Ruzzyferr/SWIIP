'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Link2, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createInvite, type CreateInviteResponse } from '@/lib/api/guilds.api';
import { useUIStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { toastSuccess, toastError } from '@/lib/toast';

const EXPIRE_OPTIONS = [
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '6 hours', value: 21600 },
  { label: '1 day', value: 86400 },
  { label: '7 days', value: 604800 },
  { label: 'Never', value: 0 },
];

const MAX_USES_OPTIONS = [
  { label: 'No limit', value: 0 },
  { label: '1 use', value: 1 },
  { label: '5 uses', value: 5 },
  { label: '10 uses', value: 10 },
  { label: '25 uses', value: 25 },
  { label: '50 uses', value: 50 },
  { label: '100 uses', value: 100 },
];

export function InviteModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const activeModal = useUIStore((s) => s.activeModal);
  const guilds = useGuildsStore((s) => s.guilds);
  const channels = useGuildsStore((s) => s.channels);

  const guildId = (activeModal?.props?.guildId as string) ?? '';
  const channelId = (activeModal?.props?.channelId as string) ?? '';
  const guild = guilds[guildId];

  const [invite, setInvite] = useState<CreateInviteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState(86400);
  const [maxUses, setMaxUses] = useState(0);

  // Auto-generate invite on open
  useEffect(() => {
    if (guildId && channelId) {
      generateInvite();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generateInvite = async () => {
    setLoading(true);
    try {
      const result = await createInvite(guildId, channelId, {
        maxAge: expiresIn || undefined,
        maxUses: maxUses || undefined,
      });
      setInvite(result);
    } catch (err: any) {
      toastError(err?.message ?? 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const inviteUrl = invite
    ? `${window.location.origin}/invite/${invite.code}`
    : '';

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toastSuccess('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError('Failed to copy to clipboard');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Invite people to {guild?.name ?? 'server'}
        </h3>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Share this link with others to grant access to your server.
        </p>
      </div>

      {/* Invite link */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2.5"
        style={{
          background: 'var(--color-surface-base)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <Link2 size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <input
          readOnly
          value={loading ? 'Generating...' : inviteUrl}
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: 'var(--color-text-primary)' }}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <Button
          onClick={handleCopy}
          disabled={!invite || loading}
          size="sm"
          variant={copied ? 'ghost' : 'primary'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span className="ml-1">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--color-text-secondary)' }}>
            <Clock size={12} className="inline mr-1" />
            Expire After
          </label>
          <select
            value={expiresIn}
            onChange={(e) => setExpiresIn(Number(e.target.value))}
            className="w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--color-surface-base)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            {EXPIRE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--color-text-secondary)' }}>
            <Users size={12} className="inline mr-1" />
            Max Uses
          </label>
          <select
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value))}
            className="w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--color-surface-base)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            {MAX_USES_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Regenerate */}
      <div className="flex justify-between items-center pt-1">
        <Button variant="ghost" onClick={generateInvite} loading={loading}>
          Generate New Link
        </Button>
        <Button variant="ghost" onClick={closeModal}>
          Done
        </Button>
      </div>
    </div>
  );
}
