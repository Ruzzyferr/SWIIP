'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Hash,
  Volume2,
  Megaphone,
  Plus,
  Settings,
  UserPlus,
  Users,
  Search,
  Compass,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Tooltip } from '@/components/ui/Tooltip';
const SearchModal = dynamic(() => import('@/components/search/SearchModal').then(m => ({ default: m.SearchModal })), { ssr: false });
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useTranslations } from 'next-intl';
import { ChannelType, type ChannelPayload } from '@constchat/protocol';

const spring = { type: 'spring' as const, stiffness: 500, damping: 30 };

// ---------------------------------------------------------------------------
// Channel Tabs — horizontal scrollable channel list
// ---------------------------------------------------------------------------

function getChannelIcon(type: ChannelType) {
  switch (type) {
    case ChannelType.VOICE:
      return <Volume2 size={13} />;
    case ChannelType.ANNOUNCEMENT:
      return <Megaphone size={13} />;
    default:
      return <Hash size={13} />;
  }
}

// Maximum visible tabs before showing overflow menu
const MAX_VISIBLE_TABS = 12;

/** Count voice participants for a channel from the participants map */
function getVoiceCount(participants: Record<string, unknown>, channelId: string): number {
  let count = 0;
  for (const key in participants) {
    if (key.startsWith(channelId + ':')) count++;
  }
  return count;
}

function ChannelTabs() {
  const router = useRouter();
  const channels = useGuildsStore((s) => s.channels);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const activeChannelId = useUIStore((s) => s.activeChannelId);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);
  const participants = useVoiceStore((s) => s.participants);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const overflowRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close overflow on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) setOverflowOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [overflowOpen]);

  // Focus search when overflow opens
  useEffect(() => {
    if (overflowOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [overflowOpen]);

  if (!activeGuildId) return null;

  const allChannels = Object.values(channels).filter((ch) => {
    const gId = (ch as ChannelPayload & { guildId?: string }).guildId;
    return gId === activeGuildId && ch.type !== ChannelType.CATEGORY;
  });

  // Get category channels for grouping
  const categories = Object.values(channels).filter((ch) => {
    const gId = (ch as ChannelPayload & { guildId?: string }).guildId;
    return gId === activeGuildId && ch.type === ChannelType.CATEGORY;
  });

  if (allChannels.length === 0) return null;

  const hasOverflow = allChannels.length > MAX_VISIBLE_TABS;

  // Always show active channel in visible tabs; fill rest from beginning
  const visibleChannels = hasOverflow
    ? (() => {
        const activeIdx = allChannels.findIndex((ch) => ch.id === activeChannelId);
        const visible = allChannels.slice(0, MAX_VISIBLE_TABS);
        // If active channel is not in visible set, swap it in
        if (activeIdx >= MAX_VISIBLE_TABS && allChannels[activeIdx]) {
          visible[MAX_VISIBLE_TABS - 1] = allChannels[activeIdx]!;
        }
        return visible;
      })()
    : allChannels;

  // Group channels by category for the overflow menu
  const groupedChannels = (() => {
    const filtered = searchQuery
      ? allChannels.filter((ch) => ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : allChannels;

    // Build category map
    const catMap = new Map<string, { name: string; channels: typeof filtered }>();
    const uncategorized: typeof filtered = [];

    for (const ch of filtered) {
      const parentId = (ch as ChannelPayload & { parentId?: string | null }).parentId;
      if (parentId) {
        const existing = catMap.get(parentId);
        if (existing) {
          existing.channels.push(ch);
        } else {
          const cat = categories.find((c) => c.id === parentId);
          catMap.set(parentId, { name: cat?.name ?? 'Unknown', channels: [ch] });
        }
      } else {
        uncategorized.push(ch);
      }
    }

    const groups: { name: string | null; channels: typeof filtered }[] = [];
    if (uncategorized.length > 0) groups.push({ name: null, channels: uncategorized });
    catMap.forEach((val) => groups.push({ name: val.name, channels: val.channels }));
    return groups;
  })();

  const navigateToChannel = (ch: ChannelPayload) => {
    setActiveChannel(ch.id);
    router.push(`/channels/${activeGuildId}/${ch.id}`);
    setOverflowOpen(false);
  };

  const overflowCount = allChannels.length - MAX_VISIBLE_TABS;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scroll-hidden px-1">
      {visibleChannels.map((ch) => {
        const isActive = activeChannelId === ch.id;
        return (
          <motion.button
            key={ch.id}
            onClick={() => navigateToChannel(ch)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0"
            animate={{
              background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
              color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
            }}
            whileHover={{
              background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
              color: 'var(--color-text-primary)',
            }}
            transition={spring}
          >
            {getChannelIcon(ch.type)}
            <span>{ch.name}</span>
            {ch.type === ChannelType.VOICE && (() => {
              const count = getVoiceCount(participants, ch.id);
              return count > 0 ? (
                <span className="flex items-center gap-1 ml-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-status-online)' }} />
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>{count}</span>
                </span>
              ) : null;
            })()}
          </motion.button>
        );
      })}

      {/* Overflow menu for 50+ channels */}
      {hasOverflow && (
        <div className="relative flex-shrink-0" ref={overflowRef}>
          <motion.button
            onClick={() => setOverflowOpen((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
            animate={{
              background: overflowOpen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.04)',
              color: overflowOpen ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
            }}
            whileHover={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--color-text-primary)',
            }}
            transition={spring}
          >
            <Compass size={13} />
            <span>+{overflowCount}</span>
            <ChevronDown size={11} style={{ transform: overflowOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
          </motion.button>

          <AnimatePresence>
            {overflowOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOverflowOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, scale: 0.95, filter: 'blur(4px)' }}
                  transition={spring}
                  className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(14, 18, 20, 0.95)',
                    backdropFilter: 'blur(30px)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
                  }}
                >
                  {/* Search bar */}
                  <div className="px-3 pt-3 pb-2">
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <Search size={14} style={{ color: 'var(--color-text-disabled)', flexShrink: 0 }} />
                      <input
                        ref={searchRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search channels..."
                        className="bg-transparent border-none outline-none text-xs flex-1"
                        style={{ color: 'var(--color-text-primary)' }}
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }}>
                          <Plus size={12} style={{ transform: 'rotate(45deg)' }} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Channel count */}
                  <div className="px-4 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
                      {searchQuery
                        ? `${groupedChannels.reduce((sum, g) => sum + g.channels.length, 0)} results`
                        : `${allChannels.length} channels`}
                    </span>
                  </div>

                  {/* Grouped channel list */}
                  <div className="max-h-[360px] overflow-y-auto pb-2">
                    {groupedChannels.map((group, gi) => (
                      <div key={gi}>
                        {group.name && (
                          <div className="px-4 pt-3 pb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
                              {group.name}
                            </span>
                          </div>
                        )}
                        {group.channels.map((ch) => {
                          const isActive = activeChannelId === ch.id;
                          return (
                            <button
                              key={ch.id}
                              onClick={() => navigateToChannel(ch)}
                              className="flex items-center gap-2.5 w-full px-4 py-1.5 text-xs transition-colors"
                              style={{
                                color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                                background: isActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent'; }}
                            >
                              <span style={{ color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-disabled)' }}>
                                {getChannelIcon(ch.type)}
                              </span>
                              <span className="flex-1 text-left truncate font-medium">{ch.name}</span>
                              {ch.type === ChannelType.VOICE && (() => {
                                const count = getVoiceCount(participants, ch.id);
                                return count > 0 ? (
                                  <span className="flex items-center gap-1 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-status-online)' }} />
                                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>{count}</span>
                                  </span>
                                ) : null;
                              })()}
                              {isActive && (
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent-primary)' }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}

                    {groupedChannels.reduce((sum, g) => sum + g.channels.length, 0) === 0 && (
                      <div className="px-4 py-6 text-center">
                        <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>No channels found</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Top Bar — two rows: server strip (A) + channel tabs (B)
// ---------------------------------------------------------------------------

export function SwiipTopBar() {
  const t = useTranslations('channels');
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
  const toggleMemberSidebar = useUIStore((s) => s.toggleMemberSidebar);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const openServerSettings = useUIStore((s) => s.openServerSettings);
  const openModal = useUIStore((s) => s.openModal);
  const isDMMode = !activeGuildId || activeGuildId === '@me' || activeGuildId === 'me';
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header
      className="flex flex-col flex-shrink-0 relative z-20 min-w-0"
      style={{
        background: 'rgba(12, 16, 18, 0.8)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Single row — channel tabs + search + context actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-12 min-w-0 relative">
        {/* Global search */}
        <Tooltip content={t('search')} placement="bottom">
          <motion.button
            onClick={() => setShowSearch(true)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={spring}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--color-text-tertiary)',
            }}
            aria-label={t('search')}
          >
            <Search size={15} />
          </motion.button>
        </Tooltip>

        {/* Ambient glow line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--ambient-primary-muted, rgba(16,185,129,0.15)) 30%, var(--ambient-primary, #10B981) 50%, var(--ambient-primary-muted, rgba(16,185,129,0.15)) 70%, transparent)',
            opacity: 0.5,
            transition: 'background 600ms ease',
          }}
        />

        {/* Channel tabs */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ChannelTabs />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {activeGuildId && !isDMMode && (
            <>
              <Tooltip content={t('showMembers')} placement="bottom">
                <motion.button
                  onClick={toggleMemberSidebar}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={spring}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    color: isMemberSidebarOpen ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
                    background: isMemberSidebarOpen ? 'rgba(16,185,129,0.1)' : 'transparent',
                  }}
                >
                  <Users size={16} />
                </motion.button>
              </Tooltip>

              <Tooltip content="Server Settings" placement="bottom">
                <motion.button
                  onClick={() => openServerSettings(activeGuildId)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={spring}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <Settings size={16} />
                </motion.button>
              </Tooltip>

              <Tooltip content="Invite People" placement="bottom">
                <motion.button
                  onClick={() => openModal('invite', { guildId: activeGuildId })}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={spring}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <UserPlus size={16} />
                </motion.button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} />
    </header>
  );
}
