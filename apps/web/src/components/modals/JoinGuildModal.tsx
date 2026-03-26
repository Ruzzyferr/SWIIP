'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { joinGuildByInvite } from '@/lib/api/guilds.api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { toastSuccess, toastError } from '@/lib/toast';

export function JoinGuildModal() {
  const router = useRouter();
  const setGuild = useGuildsStore((s) => s.setGuild);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);
  const closeModal = useUIStore((s) => s.closeModal);

  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extractCode = (input: string): string => {
    const trimmed = input.trim();
    // Handle full URLs like https://constchat.app/invite/abc123
    const urlMatch = trimmed.match(/(?:invite\/|invite=)([a-zA-Z0-9]+)/);
    if (urlMatch?.[1]) return urlMatch[1];
    // Handle bare codes
    return trimmed;
  };

  const handleJoin = async () => {
    const code = extractCode(inviteLink);
    if (!code) {
      setError('Please enter an invite link or code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const guild = await joinGuildByInvite(code);
      setGuild(guild);
      setActiveGuild(guild.id);
      closeModal();
      router.push(`/channels/${guild.id}`);
      toastSuccess(`Joined ${guild.name}!`);
    } catch (err: any) {
      const msg = err?.message ?? 'Invalid or expired invite';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Join a Server
        </h3>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Enter an invite link below to join an existing server.
        </p>
      </div>

      <div>
        <label
          className="block text-xs font-bold uppercase tracking-wide mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Link2 size={12} className="inline mr-1" />
          Invite Link
        </label>
        <Input
          value={inviteLink}
          onChange={(e) => { setInviteLink(e.target.value); setError(''); }}
          placeholder="https://constchat.app/invite/abc123 or abc123"
          error={error || undefined}
          onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
          autoFocus
        />
      </div>

      <div className="rounded-lg p-3" style={{
        background: 'var(--color-surface-base)',
        border: '1px solid var(--color-border-subtle)',
      }}>
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          Invites should look like
        </p>
        <div className="space-y-0.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          <p>hTKzmak</p>
          <p>https://constchat.app/invite/hTKzmak</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={closeModal}
          className="text-sm font-medium transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Back
        </button>
        <Button onClick={handleJoin} loading={loading} disabled={!inviteLink.trim()}>
          Join Server
        </Button>
      </div>
    </div>
  );
}
