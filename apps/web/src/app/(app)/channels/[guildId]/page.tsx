'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { ChannelType } from '@constchat/protocol';
import { Hash } from 'lucide-react';

/**
 * Guild landing page — redirects to the first text channel.
 * Channel navigation is handled by SwiipTopBar tabs.
 */
export default function GuildPage() {
  const router = useRouter();
  const params = useParams();
  const guildId = params.guildId as string;

  const channels = useGuildsStore((s) => s.channels);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);

  useEffect(() => {
    setActiveGuild(guildId);
  }, [guildId, setActiveGuild]);

  // Find the first text channel in this guild and redirect
  useEffect(() => {
    const guildChannels = Object.values(channels).filter(
      (ch) => (ch as typeof ch & { guildId?: string }).guildId === guildId
    );

    const firstText = guildChannels
      .filter((ch) => ch.type === ChannelType.TEXT || ch.type === ChannelType.ANNOUNCEMENT)
      .sort((a, b) => a.position - b.position)[0];

    const firstVoice = guildChannels
      .filter((ch) => ch.type === ChannelType.VOICE)
      .sort((a, b) => a.position - b.position)[0];

    const firstChannel = firstText ?? firstVoice;
    if (firstChannel) {
      setActiveChannel(firstChannel.id);
      router.replace(`/channels/${guildId}/${firstChannel.id}`);
    }
  }, [guildId, channels, router, setActiveChannel]);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center"
      style={{ background: 'transparent' }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <Hash size={28} style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          Select a channel from the tabs above
        </p>
      </div>
    </div>
  );
}
