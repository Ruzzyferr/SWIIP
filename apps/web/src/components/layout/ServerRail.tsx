'use client';

import { useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Plus, Compass } from 'lucide-react';
import Image from 'next/image';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';

interface ServerIconProps {
  id: string;
  name: string;
  iconUrl?: string | null;
  isActive: boolean;
  hasUnread?: boolean;
  mentionCount?: number;
  onClick: () => void;
}

function ServerIcon({
  id,
  name,
  iconUrl,
  isActive,
  hasUnread,
  mentionCount,
  onClick,
}: ServerIconProps) {
  const [hovered, setHovered] = useState(false);
  const abbr = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Tooltip content={name} placement="right">
      <div
        className="relative flex items-center"
        style={{ height: 48 }}
      >
        {/* Active/hover pill indicator */}
        <div
          className="absolute"
          style={{
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 4,
            borderRadius: '0 4px 4px 0',
            background: 'var(--color-text-primary)',
            transition: 'height 200ms cubic-bezier(0.34,1.56,0.64,1)',
            height: isActive ? 20 : hovered ? 8 : 0,
          }}
        />

        {/* Icon button */}
        <button
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative flex items-center justify-center overflow-hidden flex-shrink-0 transition-all duration-normal"
          style={{
            width: 48,
            height: 48,
            borderRadius: isActive || hovered ? 'var(--radius-xl)' : 'var(--radius-full)',
            background: iconUrl ? 'transparent' : isActive
              ? 'var(--color-accent-primary)'
              : 'var(--color-surface-elevated)',
            marginLeft: 12,
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-label={name}
          aria-pressed={isActive}
        >
          {iconUrl ? (
            <Image
              src={iconUrl}
              alt={name}
              width={48}
              height={48}
              className="object-cover w-full h-full"
            />
          ) : (
            <span
              className="font-semibold text-sm"
              style={{
                color: isActive
                  ? '#ffffff'
                  : 'var(--color-text-secondary)',
              }}
            >
              {abbr}
            </span>
          )}
        </button>

        {/* Notification badge */}
        {mentionCount && mentionCount > 0 ? (
          <div
            className="absolute bottom-0 right-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-white font-bold"
            style={{
              fontSize: 10,
              background: 'var(--color-danger-default)',
              border: '2px solid var(--color-surface-base)',
              right: -2,
              bottom: -2,
              padding: '0 3px',
            }}
          >
            {mentionCount > 99 ? '99+' : mentionCount}
          </div>
        ) : hasUnread ? (
          <div
            className="absolute rounded-full"
            style={{
              width: 8,
              height: 8,
              background: 'var(--color-text-primary)',
              border: '2px solid var(--color-surface-base)',
              right: -2,
              bottom: -2,
            }}
          />
        ) : null}
      </div>
    </Tooltip>
  );
}

function Divider() {
  return (
    <div
      className="mx-auto"
      style={{
        width: 32,
        height: 1,
        background: 'var(--color-border-subtle)',
        margin: '4px auto',
      }}
    />
  );
}

export function ServerRail() {
  const router = useRouter();
  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);
  const openModal = useUIStore((s) => s.openModal);

  const handleDMClick = () => {
    setActiveGuild(null);
    router.push('/channels/@me');
  };

  const handleGuildClick = (guildId: string) => {
    setActiveGuild(guildId);
    // Navigate to last visited channel or first available
    router.push(`/channels/${guildId}`);
  };

  return (
    <nav
      className="flex flex-col items-center scroll-hidden overflow-y-auto py-3 gap-2"
      style={{
        width: 'var(--layout-server-rail-width)',
        background: 'var(--color-surface-base)',
        borderRight: '1px solid var(--color-border-subtle)',
        flexShrink: 0,
        height: '100vh',
      }}
      aria-label="Server list"
    >
      {/* Home / DM button */}
      <Tooltip content="Direct Messages" placement="right">
        <button
          onClick={handleDMClick}
          className="relative flex items-center justify-center transition-all duration-normal flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius:
              !activeGuildId ? 'var(--radius-xl)' : 'var(--radius-full)',
            background: !activeGuildId
              ? 'var(--color-accent-primary)'
              : 'var(--color-surface-elevated)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderRadius = 'var(--radius-xl)';
            if (activeGuildId) {
              e.currentTarget.style.background = 'var(--color-accent-primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderRadius = !activeGuildId
              ? 'var(--radius-xl)'
              : 'var(--radius-full)';
            if (activeGuildId) {
              e.currentTarget.style.background = 'var(--color-surface-elevated)';
            }
          }}
          aria-label="Direct Messages"
          aria-current={!activeGuildId ? 'page' : undefined}
        >
          <Home
            size={20}
            style={{ color: !activeGuildId ? '#ffffff' : 'var(--color-text-secondary)' }}
          />
        </button>
      </Tooltip>

      <Divider />

      {/* Server list */}
      <div className="flex flex-col gap-2 w-full items-center">
        {guildOrder.map((guildId) => {
          const guild = guilds[guildId];
          if (!guild) return null;
          return (
            <ServerIcon
              key={guildId}
              id={guildId}
              name={guild.name}
              iconUrl={guild.icon}
              isActive={activeGuildId === guildId}
              onClick={() => handleGuildClick(guildId)}
            />
          );
        })}
      </div>

      <Divider />

      {/* Add Server */}
      <Tooltip content="Add a Server" placement="right">
        <button
          onClick={() => openModal('create-guild')}
          className="flex items-center justify-center transition-all duration-normal flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-surface-elevated)',
            color: 'var(--color-success-default)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderRadius = 'var(--radius-xl)';
            e.currentTarget.style.background = 'var(--color-success-default)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderRadius = 'var(--radius-full)';
            e.currentTarget.style.background = 'var(--color-surface-elevated)';
            e.currentTarget.style.color = 'var(--color-success-default)';
          }}
          aria-label="Add a Server"
        >
          <Plus size={20} />
        </button>
      </Tooltip>

      {/* Discover */}
      <Tooltip content="Discover Servers" placement="right">
        <button
          onClick={() => router.push('/discover')}
          className="flex items-center justify-center transition-all duration-normal flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-surface-elevated)',
            color: 'var(--color-accent-primary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderRadius = 'var(--radius-xl)';
            e.currentTarget.style.background = 'var(--color-accent-primary)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderRadius = 'var(--radius-full)';
            e.currentTarget.style.background = 'var(--color-surface-elevated)';
            e.currentTarget.style.color = 'var(--color-accent-primary)';
          }}
          aria-label="Discover Servers"
        >
          <Compass size={20} />
        </button>
      </Tooltip>
    </nav>
  );
}
