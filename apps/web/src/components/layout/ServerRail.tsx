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
      <div className="relative flex items-center justify-center" style={{ height: 52, width: '100%' }}>
        {/* Gradient pill indicator */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            borderRadius: '0 6px 6px 0',
            background: 'var(--color-accent-gradient)',
            transition: 'height 250ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms',
            height: isActive ? 28 : hovered ? 12 : hasUnread ? 8 : 0,
            opacity: isActive || hovered || hasUnread ? 1 : 0,
          }}
        />

        <button
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            borderRadius: isActive || hovered ? 16 : 24,
            background: iconUrl
              ? 'transparent'
              : isActive
              ? 'var(--color-accent-primary)'
              : 'var(--color-surface-raised)',
            transition: 'border-radius 300ms cubic-bezier(0.45,0,0.15,1), background 200ms, box-shadow 300ms',
            boxShadow: isActive
              ? '0 0 20px rgba(108,92,231,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)'
              : hovered
              ? '0 0 12px rgba(108,92,231,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
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
              className="font-semibold"
              style={{
                fontSize: 14,
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
        height: 1,
        margin: '2px auto',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
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
          width: 48,
          height: 48,
          borderRadius: hovered ? 16 : 24,
          background: hovered ? accentColor : 'var(--color-surface-raised)',
          color: hovered ? '#ffffff' : accentColor,
          transition: 'all 300ms cubic-bezier(0.45,0,0.15,1)',
          boxShadow: hovered
            ? `0 0 16px ${accentColor}30`
            : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
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
      className="flex flex-col items-center scroll-hidden overflow-y-auto py-3 gap-1"
      style={{
        width: 'var(--layout-server-rail-width)',
        background: 'var(--color-surface-base)',
        flexShrink: 0,
        height: '100dvh',
        borderRight: '1px solid var(--color-border-subtle)',
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
            width: 48,
            height: 48,
            borderRadius: !activeGuildId || dmHovered ? 16 : 24,
            overflow: 'hidden',
            background: !activeGuildId
              ? '#e8e4ef'
              : dmHovered
              ? '#e8e4ef'
              : 'var(--color-surface-raised)',
            transition: 'all 300ms cubic-bezier(0.45,0,0.15,1)',
            boxShadow: !activeGuildId
              ? 'var(--shadow-glow)'
              : dmHovered
              ? '0 0 16px rgba(108,92,231,0.20)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}
          aria-label={t('directMessages')}
          aria-current={!activeGuildId ? 'page' : undefined}
        >
          <Image
            src="/logo.png"
            alt="Swiip"
            width={48}
            height={48}
            className="w-full h-full object-contain"
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
