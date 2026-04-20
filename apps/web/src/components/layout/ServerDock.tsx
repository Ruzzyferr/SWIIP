'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Download, Link2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@/components/ui/Tooltip';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import type { GuildPayload } from '@constchat/protocol';

const spring = { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.6 };

const DOCK_WIDTH = 64;
const CELL = 56;
const PILL = 44;

// ---------------------------------------------------------------------------
// DockCell — shared container with the left-edge active/hover accent bar
// ---------------------------------------------------------------------------

function DockCell({
  isActive,
  hovered,
  children,
}: {
  isActive: boolean;
  hovered: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: '100%', height: CELL }}
    >
      <motion.span
        aria-hidden
        className="absolute left-0 rounded-r-full"
        style={{
          width: 4,
          background: 'var(--ambient-primary, var(--color-accent-primary))',
          top: '50%',
          boxShadow: '0 0 10px 0 var(--ambient-primary, rgba(16,185,129,0.6))',
        }}
        initial={false}
        animate={{
          height: isActive ? 28 : hovered ? 12 : 0,
          y: '-50%',
          opacity: isActive ? 1 : hovered ? 0.8 : 0,
        }}
        transition={spring}
      />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home / DM button
// ---------------------------------------------------------------------------

function HomeButton({ isActive, onClick }: { isActive: boolean; onClick: () => void }) {
  const t = useTranslations('servers');
  const [hovered, setHovered] = useState(false);
  return (
    <Tooltip content={t('directMessages')} placement="right">
      <DockCell isActive={isActive} hovered={hovered}>
        <motion.button
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative flex items-center justify-center overflow-hidden"
          animate={{
            borderRadius: isActive ? 14 : hovered ? 16 : 22,
            scale: isActive ? 1.06 : hovered ? 1.04 : 1,
            background: isActive
              ? 'var(--color-accent-muted, rgba(16,185,129,0.15))'
              : 'rgba(255,255,255,0.04)',
            boxShadow: isActive
              ? '0 0 0 2px var(--ambient-primary, rgba(16,185,129,0.6)), 0 10px 30px -10px var(--ambient-primary, rgba(16,185,129,0.5))'
              : hovered
              ? '0 0 0 1px rgba(255,255,255,0.08), 0 6px 20px -8px rgba(0,0,0,0.4)'
              : '0 0 0 1px rgba(255,255,255,0.03)',
          }}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          style={{ width: PILL, height: PILL }}
          aria-label={t('directMessages')}
          aria-current={isActive ? 'page' : undefined}
        >
          <Image
            src="/logo.png"
            alt="Swiip"
            width={PILL}
            height={PILL}
            className="w-full h-full object-contain"
            style={{ filter: isActive ? 'none' : 'grayscale(0.4) opacity(0.75)' }}
          />
          {isActive && (
            <motion.span
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              initial={false}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.18), transparent 70%)',
              }}
            />
          )}
        </motion.button>
      </DockCell>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Guild icon
// ---------------------------------------------------------------------------

function GuildButton({
  guild,
  isActive,
  onClick,
}: {
  guild: GuildPayload;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const abbr = guild.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Tooltip content={guild.name} placement="right">
      <DockCell isActive={isActive} hovered={hovered}>
        <motion.button
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative flex items-center justify-center overflow-hidden"
          animate={{
            borderRadius: isActive ? 14 : hovered ? 16 : 22,
            scale: isActive ? 1.08 : hovered ? 1.05 : 1,
            background: guild.icon
              ? 'transparent'
              : isActive
              ? 'var(--color-accent-muted, rgba(16,185,129,0.15))'
              : hovered
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(255,255,255,0.04)',
            boxShadow: isActive
              ? '0 0 0 2px var(--ambient-primary, rgba(16,185,129,0.6)), 0 10px 30px -10px var(--ambient-primary, rgba(16,185,129,0.5))'
              : hovered
              ? '0 0 0 1px rgba(255,255,255,0.08), 0 6px 20px -8px rgba(0,0,0,0.4)'
              : '0 0 0 1px rgba(255,255,255,0.04)',
          }}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          style={{ width: PILL, height: PILL }}
          aria-label={guild.name}
          aria-current={isActive ? 'page' : undefined}
        >
          {guild.icon ? (
            <Image
              src={guild.icon}
              alt={guild.name}
              width={PILL}
              height={PILL}
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
      </DockCell>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Add-server button + right-opening dropdown (portaled)
// ---------------------------------------------------------------------------

function AddServerButton() {
  const t = useTranslations('servers');
  const openModal = useUIStore((s) => s.openModal);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <>
      <Tooltip content={t('addServer')} placement="right" disabled={open}>
        <DockCell isActive={open} hovered={hovered}>
          <motion.button
            ref={buttonRef}
            onClick={() => setOpen((v) => !v)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="flex items-center justify-center"
            animate={{
              borderRadius: open ? 14 : hovered ? 16 : 22,
              scale: open ? 1.06 : hovered ? 1.05 : 1,
              background: open
                ? 'var(--color-accent-muted, rgba(16,185,129,0.15))'
                : 'rgba(16,185,129,0.06)',
              color: 'var(--color-accent-primary)',
              boxShadow: open
                ? '0 0 0 2px var(--ambient-primary, rgba(16,185,129,0.5)), 0 10px 30px -10px rgba(16,185,129,0.6)'
                : hovered
                ? '0 0 0 1px rgba(16,185,129,0.35), 0 6px 20px -8px rgba(16,185,129,0.4)'
                : '0 0 0 1px rgba(16,185,129,0.25)',
              rotate: open ? 45 : 0,
            }}
            whileTap={{ scale: 0.9 }}
            transition={spring}
            style={{
              width: PILL,
              height: PILL,
              border: '1.5px dashed rgba(16,185,129,0.35)',
            }}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t('addServer')}
          >
            <Plus size={20} />
          </motion.button>
        </DockCell>
      </Tooltip>

      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && menuPos && (
              <motion.div
                ref={menuRef}
                role="menu"
                initial={{ opacity: 0, x: -8, scale: 0.96, filter: 'blur(4px)' }}
                animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -8, scale: 0.96, filter: 'blur(4px)' }}
                transition={spring}
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  left: menuPos.left,
                  transform: 'translateY(-50%)',
                  zIndex: 'var(--z-popover, 70)' as unknown as number,
                  width: 240,
                  borderRadius: 16,
                  padding: '8px',
                  background: 'rgba(14, 18, 20, 0.95)',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow:
                    '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03), 0 0 40px -20px var(--ambient-primary, rgba(16,185,129,0.3))',
                  transformOrigin: 'left center',
                }}
              >
                <MenuItem
                  icon={<Plus size={16} />}
                  label={t('createServer')}
                  accent
                  onClick={() => {
                    openModal('create-guild');
                    setOpen(false);
                  }}
                />
                <MenuItem
                  icon={<Link2 size={16} />}
                  label={t('joinServer')}
                  onClick={() => {
                    openModal('join-guild');
                    setOpen(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors rounded-lg"
      style={{ color: accent ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        className="flex items-center justify-center rounded-lg"
        style={{
          width: 28,
          height: 28,
          background: accent ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
        }}
      >
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Action pill (discover, download)
// ---------------------------------------------------------------------------

function ActionPill({
  icon,
  label,
  isActive = false,
  onClick,
  href,
}: {
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const Tag = href ? motion.a : motion.button;
  return (
    <Tooltip content={label} placement="right">
      <DockCell isActive={isActive} hovered={hovered}>
        <Tag
          onClick={onClick}
          href={href}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="flex items-center justify-center"
          animate={{
            borderRadius: isActive ? 14 : hovered ? 16 : 22,
            scale: isActive ? 1.06 : hovered ? 1.05 : 1,
            background: isActive
              ? 'var(--color-accent-muted, rgba(16,185,129,0.15))'
              : hovered
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(255,255,255,0.04)',
            boxShadow: isActive
              ? '0 0 0 2px var(--ambient-primary, rgba(16,185,129,0.6)), 0 10px 30px -10px rgba(16,185,129,0.5)'
              : hovered
              ? '0 0 0 1px rgba(255,255,255,0.08), 0 6px 20px -8px rgba(0,0,0,0.4)'
              : '0 0 0 1px rgba(255,255,255,0.04)',
            color: isActive || hovered
              ? 'var(--color-accent-primary)'
              : 'var(--color-text-secondary)',
          }}
          whileTap={{ scale: 0.9 }}
          transition={spring}
          style={{ width: PILL, height: PILL }}
          aria-label={label}
          aria-current={isActive ? 'page' : undefined}
        >
          {icon}
        </Tag>
      </DockCell>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 32,
        height: 2,
        borderRadius: 1,
        margin: '6px auto',
        background:
          'linear-gradient(90deg, transparent, rgba(var(--ambient-rgb, 16, 185, 129), 0.3), transparent)',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function ServerDock() {
  const t = useTranslations('servers');
  const router = useRouter();
  const pathname = usePathname();
  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsDesktop(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !!(window as unknown as { constchat?: { platform?: unknown } }).constchat?.platform,
    );
  }, []);

  const isDMActive = !activeGuildId || activeGuildId === '@me' || activeGuildId === 'me';

  const goToDM = () => {
    setActiveGuild(null);
    router.push('/channels/@me');
  };
  const goToGuild = (gid: string) => {
    setActiveGuild(gid);
    router.push(`/channels/${gid}`);
  };
  const goToDiscover = () => {
    router.push('/discover');
  };

  const isDiscoverActive = pathname?.startsWith('/discover');

  return (
    <motion.aside
      aria-label="Server dock"
      role="navigation"
      className="flex flex-col items-center shrink-0 h-full relative"
      style={{
        width: DOCK_WIDTH,
        paddingTop: 10,
        paddingBottom: 10,
        background: 'rgba(10, 14, 16, 0.75)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        zIndex: 15,
      }}
      initial={{ x: -32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={spring}
    >
      {/* Ambient top glow */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: 120,
          background:
            'linear-gradient(180deg, var(--ambient-primary-subtle, rgba(16,185,129,0.08)) 0%, transparent 100%)',
          opacity: 0.8,
        }}
      />

      {/* Home / DM */}
      <div className="relative w-full">
        <HomeButton isActive={isDMActive} onClick={goToDM} />
      </div>

      <Divider />

      {/* Guilds (scrollable) */}
      <div
        className="flex flex-col items-center w-full overflow-y-auto scroll-hidden"
        style={{ flex: '1 1 auto', minHeight: 0, gap: 2 }}
      >
        {guildOrder.map((gid) => {
          const guild = guilds[gid];
          if (!guild) return null;
          return (
            <GuildButton
              key={gid}
              guild={guild}
              isActive={activeGuildId === gid}
              onClick={() => goToGuild(gid)}
            />
          );
        })}

        {/* Add */}
        <AddServerButton />
      </div>

      <Divider />

      {/* Discover */}
      <ActionPill
        icon={<Compass size={20} />}
        label={t('discoverServers')}
        isActive={!!isDiscoverActive}
        onClick={goToDiscover}
      />

      {!isDesktop && (
        <ActionPill
          icon={<Download size={20} />}
          label={t('downloadApp')}
          href="/downloads/Swiip-Setup-latest.exe"
        />
      )}
    </motion.aside>
  );
}
