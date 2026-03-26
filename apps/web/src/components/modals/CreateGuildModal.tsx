'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createGuild } from '@/lib/api/guilds.api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { toastSuccess, toastError } from '@/lib/toast';

export function CreateGuildModal() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setGuild = useGuildsStore((s) => s.setGuild);
  const closeModal = useUIStore((s) => s.closeModal);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);

  const [name, setName] = useState(`${user?.username ?? 'My'}'s server`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Server name is required');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 100) {
      setError('Server name must be 2–100 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const guild = await createGuild({ name: trimmed });
      setGuild(guild);
      setActiveGuild(guild.id);
      closeModal();
      router.push(`/channels/${guild.id}`);
      toastSuccess(`Server "${trimmed}" created!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create server';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Create Your Server
        </h3>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Give your new server a personality with a name and an icon.
          You can always change it later.
        </p>
      </div>

      {/* Icon placeholder */}
      <div className="flex justify-center">
        <button
          className="w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 transition-colors duration-fast"
          style={{
            border: '2px dashed var(--color-border-strong)',
            color: 'var(--color-text-tertiary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
            e.currentTarget.style.color = 'var(--color-accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-strong)';
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
          }}
          aria-label="Upload server icon"
        >
          <Camera size={20} />
          <span className="text-[10px] font-semibold uppercase">Upload</span>
        </button>
      </div>

      {/* Name input */}
      <div>
        <label
          className="block text-xs font-bold uppercase tracking-wide mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Server Name
        </label>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="My Awesome Server"
          error={error || undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
          autoFocus
        />
      </div>

      {/* Info text */}
      <p
        className="text-xs"
        style={{ color: 'var(--color-text-disabled)' }}
      >
        By creating a server, you agree to ConstChat&apos;s Community Guidelines.
      </p>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={closeModal}
          className="text-sm font-medium transition-colors duration-fast"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          Back
        </button>
        <Button
          onClick={handleCreate}
          loading={loading}
          disabled={!name.trim()}
        >
          Create
        </Button>
      </div>
    </div>
  );
}
