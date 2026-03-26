'use client';

import { useState } from 'react';
import { Hash, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createChannel } from '@/lib/api/channels.api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { ChannelType } from '@constchat/protocol';
import { toastSuccess, toastError } from '@/lib/toast';

type ChannelKind = 'TEXT' | 'VOICE';

export function CreateChannelModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const activeModal = useUIStore((s) => s.activeModal);
  const setChannel = useGuildsStore((s) => s.setChannel);

  const guildId = (activeModal?.props?.guildId as string) ?? '';
  const categoryId = activeModal?.props?.categoryId as string | undefined;

  const [name, setName] = useState('');
  const [kind, setKind] = useState<ChannelKind>('TEXT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed) {
      setError('Channel name is required');
      return;
    }
    if (trimmed.length < 1 || trimmed.length > 100) {
      setError('Channel name must be 1-100 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const channel = await createChannel(guildId, {
        name: trimmed,
        type: kind === 'VOICE' ? ChannelType.VOICE : ChannelType.TEXT,
        categoryId,
      });
      setChannel(channel);
      closeModal();
      toastSuccess(`Channel #${trimmed} created!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create channel';
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
          Create Channel
        </h3>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {categoryId ? 'in this category' : 'in your server'}
        </p>
      </div>

      {/* Channel type selector */}
      <div className="space-y-2">
        <label
          className="block text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Channel Type
        </label>
        <div className="space-y-1.5">
          <ChannelTypeOption
            icon={<Hash size={20} />}
            label="Text"
            description="Send messages, images, GIFs, and more"
            selected={kind === 'TEXT'}
            onClick={() => setKind('TEXT')}
          />
          <ChannelTypeOption
            icon={<Volume2 size={20} />}
            label="Voice"
            description="Hang out together with voice and video"
            selected={kind === 'VOICE'}
            onClick={() => setKind('VOICE')}
          />
        </div>
      </div>

      {/* Name input */}
      <div>
        <label
          className="block text-xs font-bold uppercase tracking-wide mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Channel Name
        </label>
        <div className="relative">
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {kind === 'VOICE' ? <Volume2 size={16} /> : <Hash size={16} />}
          </div>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="new-channel"
            error={error || undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            autoFocus
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-1">
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
          Cancel
        </button>
        <Button
          onClick={handleCreate}
          loading={loading}
          disabled={!name.trim()}
        >
          Create Channel
        </Button>
      </div>
    </div>
  );
}

function ChannelTypeOption({
  icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150"
      style={{
        background: selected ? 'var(--color-accent-subtle)' : 'var(--color-surface-raised)',
        border: selected
          ? '2px solid var(--color-accent-primary)'
          : '2px solid transparent',
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          background: selected ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
          color: selected ? '#fff' : 'var(--color-text-secondary)',
        }}
      >
        {icon}
      </div>
      <div className="text-left">
        <div
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {label}
        </div>
        <div
          className="text-xs"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {description}
        </div>
      </div>
      {/* Radio indicator */}
      <div className="ml-auto flex-shrink-0">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{
            border: selected
              ? '2px solid var(--color-accent-primary)'
              : '2px solid var(--color-text-disabled)',
          }}
        >
          {selected && (
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: 'var(--color-accent-primary)' }}
            />
          )}
        </div>
      </div>
    </button>
  );
}
