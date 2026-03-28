'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Shield,
  Bell,
  Palette,
  Volume2,
  Monitor,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { logout as logoutApi } from '@/lib/api/auth.api';
import { setAccessToken } from '@/lib/api/client';
import { VoiceSettingsPage } from '@/components/settings/VoiceSettingsPage';
import { AccountPage } from '@/components/settings/AccountPage';
import { AppearancePage } from '@/components/settings/AppearancePage';
import { PrivacyPage } from '@/components/settings/PrivacyPage';
import { NotificationsPage } from '@/components/settings/NotificationsPage';
import { KeybindsPage } from '@/components/settings/KeybindsPage';

const NAV_ITEMS = [
  { id: 'account', label: 'My Account', icon: User, section: 'User Settings' },
  { id: 'privacy', label: 'Privacy & Safety', icon: Shield, section: 'User Settings' },
  { id: 'notifications', label: 'Notifications', icon: Bell, section: 'App Settings' },
  { id: 'appearance', label: 'Appearance', icon: Palette, section: 'App Settings' },
  { id: 'voice', label: 'Voice & Video', icon: Volume2, section: 'App Settings' },
  { id: 'keybinds', label: 'Keybinds', icon: KeyRound, section: 'App Settings' },
];

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="max-w-2xl">
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
  const isOpen = useUIStore((s) => s.isSettingsOpen);
  const page = useUIStore((s) => s.settingsPage);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const setPage = useUIStore((s) => s.setSettingsPage);
  const logoutStore = useAuthStore((s) => s.logout);

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
    } catch {}
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
        return <PlaceholderPage title={item?.label ?? 'Settings'} />;
      }
    }
  };

  // Group nav items by section
  const sections = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>(
    (acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section]!.push(item);
      return acc;
    },
    {}
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 flex"
          style={{
            zIndex: 50,
            background: 'var(--color-surface-base)',
          }}
        >
          {/* Left nav */}
          <div
            className="flex justify-end overflow-y-auto scroll-thin"
            style={{
              width: '218px',
              flexShrink: 0,
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              borderRight: '1px solid var(--color-border-subtle)',
              paddingTop: '60px',
              paddingRight: '8px',
              paddingLeft: '20px',
            }}
          >
            <nav className="w-full space-y-1 pb-6">
              {Object.entries(sections).map(([section, items]) => (
                <div key={section} className="mb-3">
                  <p
                    className="px-2 py-1 text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    {section}
                  </p>
                  {items.map(({ id, label, icon: Icon }) => {
                    const active = page === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setPage(id)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast"
                        style={{
                          background: active
                            ? 'var(--color-accent-subtle)'
                            : 'transparent',
                          color: active
                            ? 'var(--color-text-primary)'
                            : 'var(--color-text-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = 'var(--color-surface-raised)';
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
                        <Icon size={15} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Separator + Logout */}
              <div
                className="h-px my-2 mx-2"
                style={{ background: 'var(--color-border-subtle)' }}
              />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast"
                style={{ color: 'var(--color-danger-default)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-danger-muted)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <LogOut size={15} />
                Log Out
              </button>
            </nav>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto scroll-thin px-10 py-16">
            {renderPage()}
          </div>

          {/* Close button */}
          <div className="flex-shrink-0 pt-16 pr-6">
            <button
              onClick={closeSettings}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-fast"
              style={{
                border: '2px solid var(--color-border-strong)',
                color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-text-primary)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
              aria-label="Close settings"
            >
              <X size={16} />
            </button>
            <p
              className="text-xs mt-1 text-center"
              style={{ color: 'var(--color-text-disabled)' }}
            >
              ESC
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
