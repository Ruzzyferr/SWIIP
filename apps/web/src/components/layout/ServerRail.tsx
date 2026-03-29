'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Compass, Link2, Download } from 'lucide-react';
import Image from 'next/image';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useTranslations } from 'next-intl';

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
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Tooltip content={name} placement="right">
      <div className="relative flex items-center justify-center" style={{ height: 48, width: '100%' }}>
        <button
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: isActive ? 12 : hovered ? 14 : 16,
            background: iconUrl
              ? 'transparent'
              : isActive
              ? 'var(--color-accent-muted)'
              : hovered
              ? 'var(--color-surface-overlay)'
              : 'var(--color-surface-raised)',
            transition: 'border-radius 300ms cubic-bezier(0.45,0,0.15,1), background 200ms, box-shadow 300ms, transform 200ms',
            boxShadow: isActive
              ? '0 0 16px rgba(16,185,129,0.20)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            transform: isActive ? 'scale(1.05)' : hovered ? 'scale(1.03)' : 'scale(1)',
          }}
          aria-label={name}
          aria-pressed={isActive}
        >
          {iconUrl ? (
            <Image
              src={iconUrl}
              alt={name}
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          ) : (
            <span
              className="font-semibold"
              style={{
                fontSize: 12,
                letterSpacing: '-0.02em',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
              }}
            >
              {abbr}
            </span>
          )}
        </button>

        {/* Notification badge */}
        {mentionCount && mentionCount > 0 ? (
          <div
            className="absolute flex items-center justify-center text-white font-bold"
            style={{
              fontSize: 10,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              borderRadius: 10,
              background: 'var(--color-danger-default)',
              border: '2.5px solid var(--color-surface-base)',
              right: 8,
              bottom: -1,
              boxShadow: '0 0 8px rgba(255,84,112,0.35)',
            }}
          >
            {mentionCount > 99 ? '99+' : mentionCount}
          </div>
        ) : hasUnread ? (
          <div
            className="absolute"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-text-primary)',
              border: '2px solid var(--color-surface-base)',
              right: 10,
              bottom: 0,
            }}
          />
        ) : null}
      </div>
    </Tooltip>
  );
}

function RailDivider() {
  return (
    <div
      style={{
        width: 32,
        height: 2,
        borderRadius: 1,
        background: 'linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.3), transparent)',
        margin: '4px 0',
      }}
    />
  );
}

function RailActionButton({
  icon,
  label,
  accentColor,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  accentColor: string;
  onClick?: () => void;
  href?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const Tag = href ? 'a' : 'button';

  return (
    <Tooltip content={label} placement="right">
      <Tag
        onClick={onClick}
        href={href}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          background: hovered ? 'var(--color-accent-muted)' : 'transparent',
          color: 'var(--color-accent-primary)',
          border: '1.5px solid var(--color-accent-primary)',
          transition: 'all 300ms cubic-bezier(0.45,0,0.15,1)',
          boxShadow: 'none',
        }}
        aria-label={label}
      >
        {icon}
      </Tag>
    </Tooltip>
  );
}

export function ServerRail() {
  const t = useTranslations('servers');
  const router = useRouter();
  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);
  const openModal = useUIStore((s) => s.openModal);

  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    setIsDesktop(!!window.constchat?.platform);
  }, []);

  const handleDMClick = () => {
    setActiveGuild(null);
    router.push('/channels/@me');
  };

  const handleGuildClick = (guildId: string) => {
    setActiveGuild(guildId);
    router.push(`/channels/${guildId}`);
  };

  const [dmHovered, setDmHovered] = useState(false);

  return (
    <nav
      className="flex flex-col items-center scroll-hidden overflow-y-auto"
      style={{
        width: 64,
        margin: '8px',
        borderRadius: 20,
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-float)',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '12px 0',
        gap: 4,
        height: 'calc(100dvh - 16px)',
        overflow: 'hidden',
        position: 'relative' as const,
        zIndex: 10,
        flexShrink: 0,
      }}
      aria-label="Server list"
      role="navigation"
    >
      {/* Home / DM button */}
      <Tooltip content={t('directMessages')} placement="right">
        <button
          onClick={handleDMClick}
          onMouseEnter={() => setDmHovered(true)}
          onMouseLeave={() => setDmHovered(false)}
          className="relative flex items-center justify-center flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: !activeGuildId ? 12 : 14,
            overflow: 'hidden',
            background: !activeGuildId
              ? 'var(--color-accent-muted)'
              : dmHovered
              ? 'var(--color-surface-overlay)'
              : 'var(--color-surface-raised)',
            transition: 'all 300ms cubic-bezier(0.45,0,0.15,1)',
            boxShadow: !activeGuildId
              ? '0 0 16px rgba(16,185,129,0.20)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}
          aria-label={t('directMessages')}
          aria-current={!activeGuildId ? 'page' : undefined}
        >
          <Image
            src="/logo.png"
            alt="Swiip"
            width={40}
            height={40}
            className="w-full h-full object-contain"
            style={{
              filter: !activeGuildId
                ? 'none'
                : 'grayscale(0.5) opacity(0.7)',
            }}
          />
        </button>
      </Tooltip>

      <RailDivider />

      {/* Server list */}
      <div className="flex flex-col gap-1 w-full items-center">
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

      <RailDivider />

      {/* Action buttons */}
      <RailActionButton
        icon={<Plus size={20} />}
        label={t('createServer')}
        accentColor="var(--color-success-default)"
        onClick={() => openModal('create-guild')}
      />
      <RailActionButton
        icon={<Link2 size={20} />}
        label={t('joinServer')}
        accentColor="var(--color-accent-primary)"
        onClick={() => openModal('join-guild')}
      />
      <RailActionButton
        icon={<Compass size={20} />}
        label={t('discoverServers')}
        accentColor="var(--color-accent-primary)"
        onClick={() => router.push('/discover')}
      />

      <div className="flex-1" />

      {/* Download — web only */}
      {!isDesktop && (
        <>
          <RailDivider />
          <RailActionButton
            icon={<Download size={20} />}
            label={t('downloadApp')}
            accentColor="var(--color-success-default)"
            href="/downloads/Swiip-Setup-latest.exe"
          />
        </>
      )}
    </nav>
  );
}
