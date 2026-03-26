'use client';

import { useState, useEffect } from 'react';
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
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { logout as logoutApi } from '@/lib/api/auth.api';
import { setAccessToken } from '@/lib/api/client';

const NAV_ITEMS = [
  { id: 'account', label: 'My Account', icon: User, section: 'User Settings' },
  { id: 'privacy', label: 'Privacy & Safety', icon: Shield, section: 'User Settings' },
  { id: 'notifications', label: 'Notifications', icon: Bell, section: 'App Settings' },
  { id: 'appearance', label: 'Appearance', icon: Palette, section: 'App Settings' },
  { id: 'voice', label: 'Voice & Video', icon: Volume2, section: 'App Settings' },
  { id: 'keybinds', label: 'Keybinds', icon: KeyRound, section: 'App Settings' },
];

function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const getPresence = usePresenceStore((s) => s.getPresence);

  if (!user) return null;

  const displayName = (user as typeof user & { displayName?: string }).displayName ?? user.globalName ?? user.username;
  const status = getPresence(user.id);

  return (
    <div className="max-w-2xl">
      {/* Profile card */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border-subtle)' }}
      >
        {/* Banner */}
        <div
          className="h-24"
          style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-strong))' }}
        />

        {/* Profile info */}
        <div
          className="px-5 pb-5 relative"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div
              className="rounded-full p-1"
              style={{ background: 'var(--color-surface-raised)' }}
            >
              <Avatar
                userId={user.id}
                src={(user as typeof user & { avatarUrl?: string }).avatarUrl ?? user.avatar}
                displayName={displayName}
                size="2xl"
                status={status}
              />
            </div>
            <div className="pb-1">
              <h3
                className="text-lg font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {displayName}
              </h3>
              <p
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                @{user.username}#{user.discriminator}
              </p>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg space-y-3"
              style={{ background: 'var(--color-surface-overlay)' }}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    Username
                  </p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {user.username}
                  </p>
                </div>
                <Button variant="secondary" size="sm">
                  Edit
                </Button>
              </div>
              <div
                className="h-px"
                style={{ background: 'var(--color-border-subtle)' }}
              />
              <div className="flex justify-between items-center">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    Email
                  </p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {user.email ?? '••••••@••••.com'}
                  </p>
                </div>
                <Button variant="secondary" size="sm">
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearancePage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3
          className="text-lg font-semibold mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Appearance
        </h3>
        <p
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Customize how ConstChat looks on your device.
        </p>
      </div>

      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--color-surface-raised)' }}
      >
        <p
          className="text-xs font-bold uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Theme
        </p>
        <div className="flex gap-3">
          {['Dark', 'Light'].map((theme) => (
            <button
              key={theme}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-fast"
              style={{
                background:
                  theme === 'Dark'
                    ? 'var(--color-accent-primary)'
                    : 'var(--color-surface-overlay)',
                color:
                  theme === 'Dark'
                    ? '#ffffff'
                    : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
      case 'appearance':
        return <AppearancePage />;
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
              background: 'var(--color-surface-elevated)',
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
