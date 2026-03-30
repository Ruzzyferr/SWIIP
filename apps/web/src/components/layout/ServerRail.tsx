'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Compass, Link2, Download } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useTranslations } from 'next-intl';

const spring = { type: 'spring' as const, stiffness: 400, damping: 25, mass: 0.6 };

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
        {/* Active pill indicator */}
        <motion.div
          className="absolute left-0 w-[3px] rounded-r-full"
          style={{
            background: 'var(--color-accent-gradient)',
            top: '50%',
          }}
          initial={false}
          animate={{
            height: isActive ? 24 : hovered ? 10 : 0,
            y: '-50%',
            opacity: isActive || hovered ? 1 : 0,
          }}
          transition={spring}
        />

        <motion.button
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{
            width: 44,
            height: 44,
            perspective: '600px',
          }}
          animate={{
            borderRadius: isActive ? 14 : hovered ? 16 : 22,
            background: iconUrl
              ? 'transparent'
              : isActive
              ? 'var(--color-accent-muted)'
              : hovered
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(255,255,255,0.04)',
            scale: isActive ? 1.08 : hovered ? 1.05 : 1,
            boxShadow: isActive
              ? '0 0 24px rgba(var(--ambient-rgb, 16, 185, 129), 0.35), 0 0 0 2px rgba(var(--ambient-rgb, 16, 185, 129), 0.2)'
              : hovered
              ? '0 0 16px rgba(var(--ambient-rgb, 16, 185, 129), 0.15), 0 0 0 1px rgba(255,255,255,0.08)'
              : '0 0 0 1px rgba(255,255,255,0.04)',
          }}
          whileHover={{ rotateY: 10 }}
          whileTap={{ scale: 0.88 }}
          transition={spring}
          aria-label={name}
          aria-pressed={isActive}
        >
          {iconUrl ? (
            <Image
              src={iconUrl}
              alt={name}
              width={44}
              height={44}
              className="object-cover w-full h-full"
            />
          ) : (
            <span
              className="font-bold"
              style={{
                fontSize: 13,
                letterSpacing: '-0.02em',
                color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
              }}
            >
              {abbr}
            </span>
          )}
        </motion.button>

        {/* Notification badge with bounce */}
        <AnimatePresence>
          {mentionCount && mentionCount > 0 ? (
            <motion.div
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
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              {mentionCount > 99 ? '99+' : mentionCount}
            </motion.div>
          ) : hasUnread ? (
            <motion.div
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
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 600, damping: 15 }}
            />
          ) : null}
        </AnimatePresence>
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
        background: 'linear-gradient(90deg, transparent, rgba(var(--ambient-rgb, 16, 185, 129), 0.3), transparent)',
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
  const Tag = href ? 'a' : 'button';

  return (
    <Tooltip content={label} placement="right">
      <motion.div
        whileHover={{ scale: 1.08, rotate: 5 }}
        whileTap={{ scale: 0.92 }}
        transition={spring}
      >
        <Tag
          onClick={onClick}
          href={href}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            background: 'rgba(16, 185, 129, 0.06)',
            color: 'var(--color-accent-primary)',
            border: '1.5px dashed rgba(16, 185, 129, 0.3)',
            transition: 'all 300ms cubic-bezier(0.45,0,0.15,1)',
          }}
          aria-label={label}
        >
          {icon}
        </Tag>
      </motion.div>
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

  return (
    <motion.nav
      className="flex flex-col items-center scroll-hidden overflow-y-auto"
      style={{
        width: 68,
        margin: '8px',
        borderRadius: 24,
        background: 'rgba(12, 16, 18, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
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
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ ...spring, delay: 0.1 }}
      aria-label="Server list"
      role="navigation"
    >
      {/* Home / DM button */}
      <Tooltip content={t('directMessages')} placement="right">
        <motion.button
          onClick={handleDMClick}
          className="relative flex items-center justify-center flex-shrink-0"
          animate={{
            borderRadius: !activeGuildId ? 14 : 18,
            background: !activeGuildId
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(255,255,255,0.04)',
            boxShadow: !activeGuildId
              ? '0 0 24px rgba(16, 185, 129, 0.3), 0 0 0 2px rgba(16, 185, 129, 0.2)'
              : '0 0 0 1px rgba(255,255,255,0.04)',
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.88 }}
          transition={spring}
          style={{
            width: 44,
            height: 44,
            overflow: 'hidden',
          }}
          aria-label={t('directMessages')}
          aria-current={!activeGuildId ? 'page' : undefined}
        >
          <Image
            src="/logo.png"
            alt="Swiip"
            width={44}
            height={44}
            className="w-full h-full object-contain"
            style={{
              filter: !activeGuildId
                ? 'none'
                : 'grayscale(0.5) opacity(0.7)',
            }}
          />
        </motion.button>
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
    </motion.nav>
  );
}
