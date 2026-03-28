'use client';

import { useState, useEffect } from 'react';
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
import { AnimatePresence } from 'framer-motion';
import { Tooltip } from '@/components/ui/Tooltip';
import { PinnedMessagesPanel } from '@/components/messaging/PinnedMessagesPanel';
import { SearchModal } from '@/components/search/SearchModal';
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
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-elevated)',
      }}
    >
      {showMobileNavToggle && (
        <button
          onClick={onToggleMobileNav}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast md:hidden"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Open channels menu"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Channel icon + name */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {getChannelIcon(channel.type)}
      </div>
      <h1
        className="text-sm font-semibold truncate"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {channel.name}
      </h1>

      {/* Topic */}
      {channel.topic && (
        <>
          <div
            className="w-px h-5 mx-1 flex-shrink-0"
            style={{ background: 'var(--color-border-default)' }}
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
            label: 'Pinned Messages',
            icon: <Pin size={16} />,
            onClick: () => setShowPins((v) => !v),
            active: showPins,
          },
          {
            label: isMemberSidebarOpen ? 'Hide Members' : 'Show Members',
            icon: <Users size={16} />,
            onClick: toggleMemberSidebar,
            active: isMemberSidebarOpen,
          },
          {
            label: 'Search',
            icon: <Search size={16} />,
            onClick: () => setShowSearch(true),
          },
          {
            label: 'Inbox',
            icon: <Inbox size={16} />,
            onClick: () => {
              // Navigate to mentions/inbox — uses the DM route as inbox
              window.location.href = '/channels/@me';
            },
          },
        ].map(({ label, icon, onClick, active }) => (
          <Tooltip key={label} content={label} placement="bottom">
            <button
              onClick={onClick}
              className={iconButtonClass}
              style={{
                color: active
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-raised)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = active
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)';
              }}
              aria-label={label}
              aria-pressed={active}
            >
              {icon}
            </button>
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
