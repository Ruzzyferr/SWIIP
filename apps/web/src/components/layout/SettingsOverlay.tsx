'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Shield,
  Bell,
  Palette,
  Volume2,
  KeyRound,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { getPlatformProvider } from '@/lib/platform';
import { useAuthStore } from '@/stores/auth.store';
import { useTranslations } from 'next-intl';
import { logout as logoutApi } from '@/lib/api/auth.api';
import { setAccessToken } from '@/lib/api/client';
import { VoiceSettingsPage } from '@/components/settings/VoiceSettingsPage';
import { AccountPage } from '@/components/settings/AccountPage';
import { AppearancePage } from '@/components/settings/AppearancePage';
import { PrivacyPage } from '@/components/settings/PrivacyPage';
import { NotificationsPage } from '@/components/settings/NotificationsPage';
import { KeybindsPage } from '@/components/settings/KeybindsPage';

const spring = { type: 'spring' as const, stiffness: 400, damping: 30 };

const NAV_ITEMS = [
  { id: 'account', labelKey: 'account.title', icon: User, sectionKey: 'userSettings' },
  { id: 'privacy', labelKey: 'privacy.title', icon: Shield, sectionKey: 'userSettings' },
  { id: 'notifications', labelKey: 'notifications.title', icon: Bell, sectionKey: 'appSettings' },
  { id: 'appearance', labelKey: 'appearance.title', icon: Palette, sectionKey: 'appSettings' },
  { id: 'voice', labelKey: 'voiceVideo.title', icon: Volume2, sectionKey: 'appSettings' },
  { id: 'keybinds', labelKey: 'keybinds.title', icon: KeyRound, sectionKey: 'appSettings' },
];

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h3
        className="text-lg font-semibold mb-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        This section is coming soon.
      </p>
    </div>
  );
}

export function SettingsOverlay() {
  const t = useTranslations('settings');
  const isOpen = useUIStore((s) => s.isSettingsOpen);
  const page = useUIStore((s) => s.settingsPage);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const setPage = useUIStore((s) => s.setSettingsPage);
  const logoutStore = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [wideNav, setWideNav] = useState(true);
  const isDesktop = getPlatformProvider().isDesktop;

  useEffect(() => {
    const q = window.matchMedia('(min-width: 768px)');
    setWideNav(q.matches);
    const fn = () => setWideNav(q.matches);
    q.addEventListener('change', fn);
    return () => q.removeEventListener('change', fn);
  }, []);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, closeSettings]);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch { /* ignore logout errors */ }
    setAccessToken(null);
    logoutStore();
    window.location.href = '/login';
  };

  const renderPage = () => {
    switch (page) {
      case 'account':
        return <AccountPage />;
      case 'privacy':
        return <PrivacyPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'appearance':
        return <AppearancePage />;
      case 'voice':
        return <VoiceSettingsPage />;
      case 'keybinds':
        return <KeybindsPage />;
      default: {
        const item = NAV_ITEMS.find((i) => i.id === page);
        return <PlaceholderPage title={item ? t(item.labelKey) : t('title')} />;
      }
    }
  };

  // Group nav items by section
  const sections = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>(
    (acc, item) => {
      const sectionLabel = t(item.sectionKey);
      if (!acc[sectionLabel]) acc[sectionLabel] = [];
      acc[sectionLabel]!.push(item);
      return acc;
    },
    {}
  );

  const activeItem = NAV_ITEMS.find((i) => i.id === page);
  const ActiveIcon = activeItem?.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, pointerEvents: 'none' }}
          animate={{ opacity: 1, pointerEvents: 'auto' }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 flex flex-col md:flex-row min-h-0"
          style={{
            zIndex: 50,
            background: 'var(--color-surface-base)',
            ...(isDesktop && { top: 32 }),
          }}
        >
          {/* ---- Left Navigation Panel ---- */}
          <motion.div
            className="flex flex-col w-full md:w-[260px] shrink-0 overflow-hidden max-h-[min(320px,42vh)] md:max-h-none md:h-full border-b md:border-b-0 md:border-r"
            style={{
              background: 'rgba(10, 14, 16, 0.95)',
              borderColor: 'rgba(255,255,255,0.04)',
            }}
            initial={wideNav ? { x: -260 } : { opacity: 0, y: -12 }}
            animate={wideNav ? { x: 0 } : { opacity: 1, y: 0 }}
            exit={wideNav ? { x: -260 } : { opacity: 0, y: -12 }}
            transition={spring}
          >
            {/* User info header */}
            <div className="px-4 sm:px-5 pt-4 sm:pt-6 pb-3 sm:pb-4">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1"
                style={{ color: 'var(--color-text-disabled)' }}
              >
                {t('title')}
              </p>
              {user && (
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {user.globalName ?? user.username}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="h-px mx-4" style={{ background: 'rgba(255,255,255,0.04)' }} />

            {/* Nav sections */}
            <nav className="flex-1 min-h-0 overflow-y-auto scroll-thin px-2 sm:px-3 py-2 sm:py-3 space-y-1">
              {Object.entries(sections).map(([section, items]) => (
                <div key={section} className="mb-4">
                  <p
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em]"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    {section}
                  </p>
                  {items.map(({ id, labelKey, icon: Icon }) => {
                    const label = t(labelKey);
                    const active = page === id;
                    return (
                      <motion.button
                        key={id}
                        onClick={() => setPage(id)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium relative overflow-hidden"
                        style={{
                          color: active
                            ? 'var(--color-text-primary)'
                            : 'var(--color-text-secondary)',
                        }}
                        whileHover={{ x: 2 }}
                        transition={spring}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                          }
                        }}
                      >
                        {active && (
                          <motion.div
                            layoutId="settings-nav-active"
                            className="absolute inset-0 rounded-xl"
                            style={{
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.12)',
                            }}
                            transition={spring}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-3">
                          <Icon
                            size={16}
                            style={{
                              color: active ? 'var(--color-accent-primary)' : 'inherit',
                            }}
                          />
                          {label}
                        </span>
                        {active && (
                          <ChevronRight
                            size={14}
                            className="relative z-10 ml-auto"
                            style={{ color: 'var(--color-accent-primary)' }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Bottom: Logout */}
            <div className="px-2 sm:px-3 pb-3 sm:pb-4">
              <div className="h-px mx-1 mb-2" style={{ background: 'rgba(255,255,255,0.04)' }} />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={{ color: 'var(--color-danger-default)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <LogOut size={16} />
                {t('logOut')}
              </button>
            </div>
          </motion.div>

          {/* ---- Main Content Area (full remaining width) ---- */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            {/* Content header bar */}
            <div
              className="flex items-center justify-between h-12 sm:h-14 px-4 sm:px-8 flex-shrink-0 gap-2"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(12, 16, 18, 0.6)',
              }}
            >
              <div className="flex items-center gap-3">
                {ActiveIcon && (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--color-accent-primary)' }}
                  >
                    <ActiveIcon size={16} />
                  </div>
                )}
                <h2
                  className="text-sm sm:text-base font-semibold truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {activeItem ? t(activeItem.labelKey) : t('title')}
                </h2>
              </div>

              {/* Close button */}
              <button
                onClick={closeSettings}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  color: 'var(--color-text-tertiary)',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
                aria-label="Close settings"
              >
                <span className="text-xs font-medium">ESC</span>
                <X size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto scroll-thin">
              <AnimatePresence mode="wait">
                <motion.div
                  key={page}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="px-4 sm:px-8 lg:px-12 xl:px-16 py-6 sm:py-8"
                >
                  <div className="max-w-[960px] w-full">
                    {renderPage()}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
