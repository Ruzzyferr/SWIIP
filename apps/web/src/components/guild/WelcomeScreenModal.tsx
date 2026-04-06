'use client';

import { useEffect, useState } from 'react';
import { Hash, X } from 'lucide-react';
import { getWelcomeScreen, type WelcomeScreen } from '@/lib/api/guilds.api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useRouter } from 'next/navigation';

export function WelcomeScreenModal({
  guildId,
  onClose,
}: {
  guildId: string;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<WelcomeScreen | null>(null);
  const guild = useGuildsStore((s) => s.guilds[guildId]);
  const channels = useGuildsStore((s) => s.getGuildChannels(guildId));
  const router = useRouter();

  useEffect(() => {
    getWelcomeScreen(guildId)
      .then((data) => {
        if (data.enabled) setScreen(data);
        else onClose();
      })
      .catch(() => onClose());
  }, [guildId, onClose]);

  if (!screen) return null;

  const handleChannelClick = (channelId: string) => {
    router.push(`/channels/${guildId}/${channelId}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="relative w-full max-w-md rounded-xl p-8 mx-4"
        style={{ background: 'var(--color-surface-overlay)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Welcome to {guild?.name ?? 'this server'}!
          </h2>
          {screen.description && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {screen.description}
            </p>
          )}
        </div>

        {screen.channels.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase" style={{ color: 'var(--color-text-disabled)' }}>
              Start here
            </p>
            {screen.channels.map((ch) => {
              const channel = channels.find((c) => c.id === ch.channelId);
              if (!channel) return null;
              return (
                <button
                  key={ch.channelId}
                  onClick={() => handleChannelClick(ch.channelId)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors"
                  style={{ background: 'var(--color-surface-raised)' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--color-accent-muted)' }}
                  >
                    <Hash size={16} style={{ color: 'var(--color-accent-primary)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {channel.name}
                    </p>
                    {ch.description && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                        {ch.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-6 py-2.5 rounded-md text-sm font-medium"
          style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
