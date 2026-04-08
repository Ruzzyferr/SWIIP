'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Hash,
  Volume2,
  Megaphone,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  UserPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
import { updateChannel as updateChannelApi } from '@/lib/api/channels.api';

// ---------------------------------------------------------------------------
// Guild header with dropdown
// ---------------------------------------------------------------------------

function GuildHeaderDropdown({
  guild,
  guildId: _guildId,
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
  const t = useTranslations('servers');

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-4 h-12 w-full transition-all duration-200"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        aria-label={`${guild.name} — ${t('serverOptions')}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-accent-muted)' }}>
            <span className="text-[10px] font-bold" style={{ color: 'var(--color-accent-primary)' }}>
              {guild?.name?.charAt(0)?.toUpperCase() || 'S'}
            </span>
          </div>
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
            {guild?.name || 'Server'}
          </span>
        </div>
        <Settings size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -4, scale: 0.97, filter: 'blur(2px)' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
              className="absolute left-2 right-2 top-12 z-20 rounded-lg py-1.5 shadow-lg"
              style={{
                background: 'var(--color-surface-overlay)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <DropdownItem icon={<UserPlus size={15} />} label={t('invitePeople')} onClick={() => { onInvite(); setOpen(false); }} accent />
              <DropdownItem icon={<Plus size={15} />} label={t('createChannel')} onClick={() => { onCreateChannel(); setOpen(false); }} />
              <DropdownItem icon={<Settings size={15} />} label={t('serverSettings')} onClick={() => { onSettings(); setOpen(false); }} />
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
  onDragStart?: (e: React.DragEvent, channelId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetChannelId: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CategorySection({
  name,
  categoryId,
  channels,
  activeChannelId,
  onChannelClick,
  guildId,
  onCreateChannel,
  onDragStart,
  onDragOver,
  onDrop,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const tChannels = useTranslations('channels');

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
        <Tooltip content={tChannels('createChannelIn', { name })} placement="top">
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
            transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.5 }}
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
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
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
  onDragStart,
  onDragOver,
  onDrop,
}: {
  channel: ChannelPayload;
  isActive: boolean;
  onClick: () => void;
  guildId?: string;
  onDragStart?: (e: React.DragEvent, channelId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetChannelId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const isVoice = channel.type === ChannelType.VOICE;
  const tChannels = useTranslations('channels');

  // Unread detection: compare channel's lastMessageId with user's lastReadId
  const lastReadId = useMessagesStore((s) => s.channels[channel.id]?.lastReadId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastMessageId = (channel as any).lastMessageId as string | undefined;
  const mentionCount = useMessagesStore((s) => s.channels[channel.id]?.mentionCount ?? 0);
  const hasUnread = !isActive && !isVoice && !!lastMessageId && lastMessageId !== lastReadId;

  // Voice channel user count for limit indicator
  const voiceUserCount = useVoiceStore((s) => {
    if (!isVoice) return 0;
    return Object.keys(s.participants).filter((k) => k.startsWith(`${channel.id}:`)).length;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userLimit = (channel as any).userLimit as number | undefined;

  return (
    <div>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setDragOver(false); }}
        draggable
        onDragStart={(e) => onDragStart?.(e, channel.id)}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); onDragOver?.(e); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { setDragOver(false); onDrop?.(e, channel.id); }}
        className="channel-item w-full text-left"
        style={{
          borderLeft: isActive
            ? '3px solid var(--color-accent-primary)'
            : '3px solid transparent',
          background: isActive
            ? 'var(--color-accent-subtle)'
            : dragOver
            ? 'var(--color-accent-muted)'
            : hovered
            ? 'rgba(255,255,255,0.04)'
            : 'transparent',
          paddingLeft: isActive ? 'calc(var(--channel-item-pl, 8px) - 3px)' : undefined,
          color: isActive
            ? 'var(--color-text-primary)'
            : hasUnread
            ? 'var(--color-text-primary)'
            : 'var(--color-text-secondary)',
          fontWeight: hasUnread ? 600 : undefined,
          borderTop: dragOver ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
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
            <Tooltip content={tChannels('invitePeople')} placement="top">
              <div
                className="p-0.5 rounded hover:text-text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <UserPlus size={13} />
              </div>
            </Tooltip>
            <Tooltip content={tChannels('channelSettings')} placement="top">
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
// Section label for grouped channel layout
// ---------------------------------------------------------------------------

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[10px] font-semibold uppercase"
        style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.1em' }}>
        {label}
      </span>
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
  const tChannels = useTranslations('channels');
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

  // Get channels for this guild, grouped into sections (SPACES, LIVE ROOMS, THREADS)
  const { guildChannels, groupedChannels } = useMemo(() => {
    const _guildChannels: ChannelPayload[] = [];
    const spaces: ChannelPayload[] = [];
    const liveRooms: ChannelPayload[] = [];
    const threads: ChannelPayload[] = [];

    for (const ch of Object.values(channels)) {
      if ((ch as ChannelPayload & { guildId?: string }).guildId !== guildId) continue;
      if (ch.type === ChannelType.CATEGORY) continue; // Skip category channels
      _guildChannels.push(ch);

      if (ch.type === ChannelType.VOICE || ch.type === ChannelType.STAGE) {
        liveRooms.push(ch);
      } else if (ch.type === ChannelType.THREAD) {
        threads.push(ch);
      } else {
        // TEXT, ANNOUNCEMENT, FORUM go to SPACES
        spaces.push(ch);
      }
    }

    return { guildChannels: _guildChannels, groupedChannels: { spaces, liveRooms, threads } };
  }, [channels, guildId]);

  // Drag-and-drop channel reorder
  const draggedChannelRef = useRef<string | null>(null);
  const updateChannelStore = useGuildsStore((s) => s.updateChannel);

  const handleDragStart = useCallback((e: React.DragEvent, channelId: string) => {
    draggedChannelRef.current = channelId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', channelId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetChannelId: string) => {
    e.preventDefault();
    const draggedId = draggedChannelRef.current;
    if (!draggedId || draggedId === targetChannelId || !guildId) return;

    const targetChannel = channels[targetChannelId];
    if (!targetChannel) return;

    const targetPosition = (targetChannel as any).position ?? 0;

    // Optimistic update
    updateChannelStore(draggedId, { position: targetPosition } as any);

    // API call
    updateChannelApi(draggedId, { position: targetPosition }).catch(() => {
      // Revert on failure — just ignore, next sync will fix it
    });

    draggedChannelRef.current = null;
  }, [guildId, channels, updateChannelStore]);

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
        background: 'rgba(18, 22, 22, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: isMobile ? 'none' : '1px solid var(--color-border-subtle)',
        position: 'relative' as const,
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
      <div className="flex-1 overflow-y-auto scroll-thin" style={{ paddingBottom: 8 }}>
        {guildId ? (
          <>
            {groupedChannels.spaces.length > 0 && (
              <>
                <SectionLabel label="SPACES" />
                {groupedChannels.spaces.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    isActive={activeChannelId === ch.id}
                    onClick={() => handleChannelClick(ch.id)}
                    guildId={guildId}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </>
            )}

            {groupedChannels.liveRooms.length > 0 && (
              <>
                <SectionLabel label="LIVE ROOMS" />
                {groupedChannels.liveRooms.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    isActive={activeChannelId === ch.id}
                    onClick={() => handleChannelClick(ch.id)}
                    guildId={guildId}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </>
            )}

            {groupedChannels.threads.length > 0 && (
              <>
                <SectionLabel label="THREADS" />
                {groupedChannels.threads.map((ch) => (
                  <ChannelItem
                    key={ch.id}
                    channel={ch}
                    isActive={activeChannelId === ch.id}
                    onClick={() => handleChannelClick(ch.id)}
                    guildId={guildId}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </>
            )}

            {/* Add a Chat */}
            <div className="px-3 pt-3">
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                onClick={() => handleCreateChannel()}
              >
                <Plus size={14} />
                Add a Chat
              </button>
            </div>

            {/* Empty state */}
            {guildChannels.length === 0 && (
              <div className="px-2 py-6 text-center">
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  {tChannels('noChannelsYet')}
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
