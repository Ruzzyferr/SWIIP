'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Hash,
  Volume2,
  Megaphone,
  Menu,
  Users,
  Pin,
  Search,
  Inbox,
  HelpCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from '@/components/ui/Tooltip';
import { PinnedMessagesPanel } from '@/components/messaging/PinnedMessagesPanel';
const SearchModal = dynamic(() => import('@/components/search/SearchModal').then(m => ({ default: m.SearchModal })), { ssr: false });
import { useUIStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { ChannelType, type ChannelPayload } from '@constchat/protocol';

function getChannelIcon(type: ChannelType) {
  switch (type) {
    case ChannelType.VOICE:
      return <Volume2 size={18} />;
    case ChannelType.ANNOUNCEMENT:
      return <Megaphone size={18} />;
    default:
      return <Hash size={18} />;
  }
}

interface ChannelHeaderProps {
  channelId: string;
  onToggleMobileNav?: () => void;
  showMobileNavToggle?: boolean;
}

export function ChannelHeader({
  channelId,
  onToggleMobileNav,
  showMobileNavToggle = false,
}: ChannelHeaderProps) {
  const t = useTranslations('channels');
  const channel = useGuildsStore((s) => s.channels[channelId]);
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
  const toggleMemberSidebar = useUIStore((s) => s.toggleMemberSidebar);
  const [showPins, setShowPins] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!channel) return null;

  const iconButtonClass =
    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast flex-shrink-0';

  return (
    <header
      className="relative flex items-center gap-2 px-4 h-12 flex-shrink-0"
      style={{
        borderBottom: 'none',
        background: 'rgba(18, 22, 22, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Ambient gradient line under header */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--ambient-primary-muted, rgba(16,185,129,0.15)) 30%, var(--ambient-primary, #10B981) 50%, var(--ambient-primary-muted, rgba(16,185,129,0.15)) 70%, transparent)',
          opacity: 0.6,
          transition: 'background 600ms ease',
        }}
      />
      {showMobileNavToggle && (
        <button
          onClick={onToggleMobileNav}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast md:hidden"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label={t('openChannelsMenu')}
        >
          <Menu size={18} />
        </button>
      )}

      {/* Channel icon + name */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        style={{ color: 'var(--color-text-accent)' }}
      >
        {getChannelIcon(channel.type)}
      </div>
      <h1
        className="text-sm font-bold truncate"
        style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}
      >
        {channel.name}
      </h1>

      {/* Topic */}
      {channel.topic && (
        <>
          <div
            className="w-px h-4 mx-2 flex-shrink-0"
            style={{ background: 'var(--color-border-default)', opacity: 0.5 }}
          />
          <p
            className="text-xs truncate flex-1 min-w-0"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {channel.topic}
          </p>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        {[
          {
            label: t('pins'),
            icon: <Pin size={16} />,
            onClick: () => setShowPins((v) => !v),
            active: showPins,
          },
          {
            label: isMemberSidebarOpen ? t('hideMembers') : t('showMembers'),
            icon: <Users size={16} />,
            onClick: toggleMemberSidebar,
            active: isMemberSidebarOpen,
          },
          {
            label: t('search'),
            icon: <Search size={16} />,
            onClick: () => setShowSearch(true),
          },
          {
            label: t('inbox'),
            icon: <Inbox size={16} />,
            onClick: () => {
              window.location.href = '/channels/@me';
            },
          },
        ].map(({ label, icon, onClick, active }) => (
          <Tooltip key={label} content={label} placement="bottom">
            <motion.button
              onClick={onClick}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className={iconButtonClass}
              style={{
                color: active
                  ? 'var(--color-text-accent)'
                  : 'var(--color-text-secondary)',
                background: active
                  ? 'var(--color-accent-muted)'
                  : 'transparent',
                borderRadius: 'var(--radius-lg)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = active
                  ? 'var(--color-accent-muted)'
                  : 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = active
                  ? 'var(--color-accent-muted)'
                  : 'transparent';
                e.currentTarget.style.color = active
                  ? 'var(--color-text-accent)'
                  : 'var(--color-text-secondary)';
              }}
              aria-label={label}
              aria-pressed={active}
            >
              {icon}
            </motion.button>
          </Tooltip>
        ))}
      </div>

      {/* Search modal */}
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} />

      {/* Pinned messages panel */}
      <AnimatePresence>
        {showPins && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowPins(false)} />
            <PinnedMessagesPanel channelId={channelId} onClose={() => setShowPins(false)} />
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
