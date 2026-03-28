'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Hash,
  Volume2,
  Megaphone,
  Lock,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { UserPanel } from './UserPanel';
import { DMConversationList } from './DMConversationList';
import { VoiceConnectionPanel } from '@/components/voice/VoiceConnectionPanel';
import { VoiceChannelUsers } from '@/components/voice/VoiceChannelUsers';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useVoiceStore } from '@/stores/voice.store';
import { ChannelType, type ChannelPayload, type GuildPayload } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Guild header with dropdown
// ---------------------------------------------------------------------------

function GuildHeaderDropdown({
  guild,
  guildId,
  onSettings,
  onInvite,
  onCreateChannel,
}: {
  guild: GuildPayload;
  guildId: string;
  onSettings: () => void;
  onInvite: () => void;
  onCreateChannel: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-4 h-12 w-full transition-colors duration-fast"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        aria-label={`${guild.name} — server options`}
      >
        <span className="font-semibold truncate text-sm" style={{ color: 'var(--color-text-primary)' }}>
          {guild.name}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute left-2 right-2 top-12 z-20 rounded-lg py-1.5 shadow-lg"
              style={{
                background: 'var(--color-surface-overlay)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <DropdownItem icon={<UserPlus size={15} />} label="Invite People" onClick={() => { onInvite(); setOpen(false); }} accent />
              <DropdownItem icon={<Plus size={15} />} label="Create Channel" onClick={() => { onCreateChannel(); setOpen(false); }} />
              <DropdownItem icon={<Settings size={15} />} label="Server Settings" onClick={() => { onSettings(); setOpen(false); }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownItem({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm transition-colors rounded-md mx-auto"
      style={{
        color: accent
          ? 'var(--color-accent-primary)'
          : hovered
          ? 'var(--color-text-primary)'
          : 'var(--color-text-secondary)',
        background: hovered ? 'var(--color-accent-primary)' : 'transparent',
        ...(hovered ? { color: '#fff' } : {}),
        margin: '0 4px',
        width: 'calc(100% - 8px)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Category channel group
// ---------------------------------------------------------------------------

interface CategorySectionProps {
  name: string;
  categoryId?: string;
  channels: ChannelPayload[];
  activeChannelId: string | null;
  onChannelClick: (channelId: string) => void;
  guildId?: string;
  onCreateChannel?: (categoryId?: string) => void;
}

function CategorySection({
  name,
  categoryId,
  channels,
  activeChannelId,
  onChannelClick,
  guildId,
  onCreateChannel,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-1">
      {/* Category header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-1 w-full px-2 py-1 rounded transition-colors duration-fast group"
        style={{ color: 'var(--color-text-tertiary)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-tertiary)';
        }}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight size={12} className="flex-shrink-0" />
        ) : (
          <ChevronDown size={12} className="flex-shrink-0" />
        )}
        <span
          className="text-xs font-semibold uppercase tracking-wider truncate"
        >
          {name}
        </span>
        <Tooltip content={`Create channel in ${name}`} placement="top">
          <div
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-fast p-0.5 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onCreateChannel?.(categoryId);
            }}
          >
            <Plus size={14} />
          </div>
        </Tooltip>
      </button>

      {/* Channel list */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-0.5 space-y-0.5">
              {channels.map((ch) => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  isActive={activeChannelId === ch.id}
                  onClick={() => onChannelClick(ch.id)}
                  guildId={guildId}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channel item
// ---------------------------------------------------------------------------

function getChannelIcon(type: ChannelType) {
  switch (type) {
    case ChannelType.VOICE:
      return <Volume2 size={15} />;
    case ChannelType.ANNOUNCEMENT:
      return <Megaphone size={15} />;
    default:
      return <Hash size={15} />;
  }
}

function ChannelItem({
  channel,
  isActive,
  onClick,
  guildId,
}: {
  channel: ChannelPayload;
  isActive: boolean;
  onClick: () => void;
  guildId?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isVoice = channel.type === ChannelType.VOICE;

  // Unread detection: compare channel's lastMessageId with user's lastReadId
  const lastReadId = useMessagesStore((s) => s.channels[channel.id]?.lastReadId);
  const lastMessageId = (channel as any).lastMessageId as string | undefined;
  const mentionCount = useMessagesStore((s) => s.channels[channel.id]?.mentionCount ?? 0);
  const hasUnread = !isActive && !isVoice && !!lastMessageId && lastMessageId !== lastReadId;

  // Voice channel user count for limit indicator
  const voiceUserCount = useVoiceStore((s) => {
    if (!isVoice) return 0;
    return Object.keys(s.participants).filter((k) => k.startsWith(`${channel.id}:`)).length;
  });
  const userLimit = (channel as any).userLimit as number | undefined;

  return (
    <div>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="channel-item w-full text-left"
        style={{
          background: isActive
            ? 'var(--color-accent-subtle)'
            : hovered
            ? 'var(--color-surface-raised)'
            : 'transparent',
          color: isActive || hasUnread
            ? 'var(--color-text-primary)'
            : hovered
            ? 'var(--color-text-primary)'
            : 'var(--color-text-secondary)',
          fontWeight: hasUnread ? 600 : undefined,
        }}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Unread pill indicator — left edge */}
        {hasUnread && (
          <div
            className="absolute left-0 rounded-r-sm"
            style={{
              width: 4,
              height: 8,
              background: 'var(--color-text-primary)',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
        )}

        <span style={{ opacity: isActive || hasUnread ? 1 : 0.7, flexShrink: 0 }}>
          {getChannelIcon(channel.type)}
        </span>
        <span className="truncate">{channel.name}</span>

        {/* Voice channel user limit */}
        {isVoice && userLimit != null && userLimit > 0 && (
          <span
            className="ml-auto text-xs shrink-0"
            style={{ color: voiceUserCount >= userLimit ? 'var(--color-danger-default)' : 'var(--color-text-tertiary)' }}
          >
            {voiceUserCount}/{userLimit}
          </span>
        )}

        {/* Mention badge */}
        {mentionCount > 0 && !isActive && (
          <span
            className="ml-auto flex items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0"
            style={{
              background: 'var(--color-danger-default)',
              minWidth: 18,
              height: 18,
              padding: '0 5px',
            }}
          >
            {mentionCount > 99 ? '99+' : mentionCount}
          </span>
        )}

        {/* Actions visible on hover */}
        {hovered && (
          <div className="ml-auto flex items-center gap-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            <Tooltip content="Invite people" placement="top">
              <div
                className="p-0.5 rounded hover:text-text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <UserPlus size={13} />
              </div>
            </Tooltip>
            <Tooltip content="Channel settings" placement="top">
              <div
                className="p-0.5 rounded hover:text-text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Settings size={13} />
              </div>
            </Tooltip>
          </div>
        )}
      </button>
      {/* Voice channel participants */}
      {isVoice && guildId && (
        <VoiceChannelUsers channelId={channel.id} guildId={guildId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ChannelSidebar
// ---------------------------------------------------------------------------

interface ChannelSidebarProps {
  guildId?: string;
}

export function ChannelSidebar({ guildId }: ChannelSidebarProps) {
  const router = useRouter();
  const channels = useGuildsStore((s) => s.channels);
  const guilds = useGuildsStore((s) => s.guilds);
  const activeChannelId = useUIStore((s) => s.activeChannelId);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);
  const openServerSettings = useUIStore((s) => s.openServerSettings);
  const openModal = useUIStore((s) => s.openModal);
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

  const guild = guildId ? guilds[guildId] : null;

  const handleCreateChannel = (categoryId?: string) => {
    openModal('create-channel', { guildId, categoryId });
  };

  // Get channels for this guild, grouped in a single pass
  const { guildChannels, categories, uncategorized, channelsByCategory } = useMemo(() => {
    const _guildChannels: ChannelPayload[] = [];
    const _categories: ChannelPayload[] = [];
    const _uncategorized: ChannelPayload[] = [];
    const _channelsByCategory: Record<string, ChannelPayload[]> = {};

    for (const ch of Object.values(channels)) {
      if ((ch as ChannelPayload & { guildId?: string }).guildId !== guildId) continue;
      _guildChannels.push(ch);

      if (ch.type === ChannelType.CATEGORY) {
        _categories.push(ch);
      } else {
        const catId = (ch as ChannelPayload & { categoryId?: string }).categoryId;
        if (catId) {
          if (!_channelsByCategory[catId]) _channelsByCategory[catId] = [];
          _channelsByCategory[catId].push(ch);
        } else {
          _uncategorized.push(ch);
        }
      }
    }

    return { guildChannels: _guildChannels, categories: _categories, uncategorized: _uncategorized, channelsByCategory: _channelsByCategory };
  }, [channels, guildId]);

  const handleChannelClick = (channelId: string) => {
    setActiveChannel(channelId);
    if (guildId) {
      router.push(`/channels/${guildId}/${channelId}`);
      // On mobile, close the channel menu after navigating.
      if (isMobile) {
        setMobileNavOpen(false);
      }
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{
        ...(isMobile
          ? { flex: 1, minWidth: 0 }
          : { width: 'var(--layout-channel-sidebar-width)', flexShrink: 0 }),
        background: 'var(--color-surface-elevated)',
        borderRight: isMobile ? 'none' : '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Server header with dropdown */}
      {guild && guildId && (
        <GuildHeaderDropdown
          guild={guild}
          guildId={guildId}
          onSettings={() => openServerSettings(guildId)}
          onInvite={() => {
            const firstChannel = Object.values(channels).find(
              (ch) => (ch as ChannelPayload & { guildId?: string }).guildId === guildId && ch.type !== ChannelType.CATEGORY
            );
            openModal('invite', { guildId, channelId: firstChannel?.id ?? '' });
          }}
          onCreateChannel={() => handleCreateChannel()}
        />
      )}

      {/* Channel list — scrollable */}
      <div className="flex-1 overflow-y-auto scroll-thin py-3 px-2 space-y-1">
        {guildId ? (
          <>
            {/* Uncategorized channels */}
            {uncategorized.length > 0 && (
              <div className="space-y-0.5 mb-2">
                {uncategorized.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    isActive={activeChannelId === ch.id}
                    onClick={() => handleChannelClick(ch.id)}
                    guildId={guildId}
                  />
                ))}
              </div>
            )}

            {/* Categorized sections */}
            {categories.map((cat) => (
                <CategorySection
                  key={cat.id}
                  name={cat.name}
                  categoryId={cat.id}
                  channels={channelsByCategory[cat.id] ?? []}
                  activeChannelId={activeChannelId}
                  onChannelClick={handleChannelClick}
                  guildId={guildId}
                  onCreateChannel={handleCreateChannel}
                />
            ))}

            {/* Empty state */}
            {guildChannels.length === 0 && (
              <div className="px-2 py-6 text-center">
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  No channels yet
                </p>
              </div>
            )}
          </>
        ) : (
          /* DM view */
          <DMConversationList />
        )}
      </div>

      {/* Voice connection panel (when in a voice channel) */}
      <VoiceConnectionPanel />

      {/* User panel */}
      <UserPanel />
    </div>
  );
}
