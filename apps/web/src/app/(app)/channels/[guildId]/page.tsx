'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { ChannelType } from '@constchat/protocol';
import { Hash } from 'lucide-react';

/**
 * Guild landing page — redirects to the first text channel.
 * Shows the channel sidebar while determining the redirect.
 */
export default function GuildPage() {
  const router = useRouter();
  const params = useParams();
  const guildId = params.guildId as string;

  const channels = useGuildsStore((s) => s.channels);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  // On mobile, show channel list by default
  useEffect(() => {
    if (isMobile) {
      setMobileNavOpen(true);
    }
  }, [isMobile, setMobileNavOpen]);

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

  // On mobile, show only the sidebar (user picks a channel from here)
  if (isMobile) {
    return <ChannelSidebar guildId={guildId} />;
  }

  return (
    <>
      <ChannelSidebar guildId={guildId} />

      {/* Placeholder while redirecting */}
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ background: 'var(--color-surface-base)' }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-surface-raised)' }}
          >
            <Hash size={28} style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Select a channel to start chatting
          </p>
        </div>
      </div>
    </>
  );
}
