'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
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
  Pin,
  MessageSquare,
  Compass,
  Link2,
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useTranslations } from 'next-intl';
import { ChannelType, type ChannelPayload, type GuildPayload } from '@constchat/protocol';

const spring = { type: 'spring' as const, stiffness: 500, damping: 30 };

// ---------------------------------------------------------------------------
// Server Switcher Dropdown
// ---------------------------------------------------------------------------

function ServerSwitcher() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useTranslations('servers');

  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);
  const openModal = useUIStore((s) => s.openModal);

  const activeGuild = activeGuildId ? guilds[activeGuildId] : null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        whileTap={{ scale: 0.97 }}
        transition={spring}
        style={{
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          color: 'var(--color-text-primary)',
        }}
      >
        {/* Active server icon or Swiip logo */}
        <div
          className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{
            background: activeGuild?.icon ? 'transparent' : 'rgba(16, 185, 129, 0.15)',
          }}
        >
          {activeGuild?.icon ? (
            <Image src={activeGuild.icon} alt={activeGuild.name} width={28} height={28} className="object-cover w-full h-full" />
          ) : activeGuild ? (
            <span className="text-xs font-bold" style={{ color: 'var(--color-accent-primary)' }}>
              {activeGuild.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <Image src="/logo.png" alt="Swiip" width={28} height={28} className="object-contain" />
          )}
        </div>

        <span className="text-sm font-semibold truncate max-w-[140px]">
          {activeGuild?.name ?? 'Direct Messages'}
        </span>

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring}
        >
          <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, scale: 0.95, filter: 'blur(4px)' }}
              transition={spring}
              className="absolute left-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl py-2 overflow-hidden"
              style={{
                background: 'rgba(14, 18, 20, 0.95)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
              }}
            >
              {/* DM option */}
              <button
                onClick={() => {
                  setActiveGuild(null);
                  router.push('/channels/@me');
                  setOpen(false);
                }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors"
                style={{
                  color: !activeGuildId ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  background: !activeGuildId ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = !activeGuildId ? 'rgba(16, 185, 129, 0.08)' : 'transparent'; }}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src="/logo.png" alt="DM" width={32} height={32} className="object-contain" />
                </div>
                <div className="flex-1 text-left">
                  <span className="font-medium">Direct Messages</span>
                </div>
                {!activeGuildId && (
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-primary)' }} />
                )}
              </button>

              <div className="h-px mx-3 my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />

              {/* Server label */}
              <div className="px-3 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
                  Servers
                </span>
              </div>

              {/* Server list */}
              <div className="max-h-[300px] overflow-y-auto">
                {guildOrder.map((gid) => {
                  const guild = guilds[gid];
                  if (!guild) return null;
                  const isActive = activeGuildId === gid;
                  return (
                    <button
                      key={gid}
                      onClick={() => {
                        setActiveGuild(gid);
                        router.push(`/channels/${gid}`);
                        setOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors"
                      style={{
                        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        background: isActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent'; }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
                        style={{ background: guild.icon ? 'transparent' : 'rgba(255,255,255,0.06)' }}
                      >
                        {guild.icon ? (
                          <Image src={guild.icon} alt={guild.name} width={32} height={32} className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-xs font-bold" style={{ color: 'var(--color-text-tertiary)' }}>
                            {guild.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="flex-1 text-left truncate font-medium">{guild.name}</span>
                      {isActive && (
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-primary)' }} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="h-px mx-3 my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />

              {/* Actions */}
              <button
                onClick={() => { openModal('create-guild'); setOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--color-accent-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Plus size={16} />
                <span>{t('createServer')}</span>
              </button>
              <button
                onClick={() => { openModal('join-guild'); setOpen(false); }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Link2 size={16} />
                <span>{t('joinServer')}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

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

function ChannelTabs() {
  const router = useRouter();
  const channels = useGuildsStore((s) => s.channels);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const activeChannelId = useUIStore((s) => s.activeChannelId);
  const setActiveChannel = useUIStore((s) => s.setActiveChannel);

  if (!activeGuildId) return null;

  const guildChannels = Object.values(channels).filter((ch) => {
    const gId = (ch as ChannelPayload & { guildId?: string }).guildId;
    return gId === activeGuildId && ch.type !== ChannelType.CATEGORY;
  });

  if (guildChannels.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scroll-hidden px-1">
      {guildChannels.map((ch) => {
        const isActive = activeChannelId === ch.id;
        return (
          <motion.button
            key={ch.id}
            onClick={() => {
              setActiveChannel(ch.id);
              router.push(`/channels/${activeGuildId}/${ch.id}`);
            }}
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
          </motion.button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Top Bar
// ---------------------------------------------------------------------------

export function SwiipTopBar() {
  const t = useTranslations('channels');
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
  const toggleMemberSidebar = useUIStore((s) => s.toggleMemberSidebar);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const openServerSettings = useUIStore((s) => s.openServerSettings);
  const openModal = useUIStore((s) => s.openModal);

  return (
    <header
      className="flex items-center gap-2 px-3 h-12 flex-shrink-0 relative z-20"
      style={{
        background: 'rgba(12, 16, 18, 0.8)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: 'none',
      }}
    >
      {/* Ambient glow line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--ambient-primary-muted, rgba(16,185,129,0.15)) 30%, var(--ambient-primary, #10B981) 50%, var(--ambient-primary-muted, rgba(16,185,129,0.15)) 70%, transparent)',
          opacity: 0.5,
          transition: 'background 600ms ease',
        }}
      />

      {/* Server switcher */}
      <ServerSwitcher />

      {/* Divider */}
      <div className="w-px h-5" style={{ background: 'rgba(255,255,255,0.08)' }} />

      {/* Channel tabs */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <ChannelTabs />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {activeGuildId && (
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

        <Tooltip content={t('search')} placement="bottom">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={spring}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Search size={16} />
          </motion.button>
        </Tooltip>
      </div>
    </header>
  );
}
