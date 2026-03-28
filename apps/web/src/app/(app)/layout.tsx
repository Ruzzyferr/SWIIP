'use client';

import { type ReactNode, useEffect, useState, useCallback } from 'react';
import { AppProvider } from '@/components/providers/AppProvider';
import { ServerRail } from '@/components/layout/ServerRail';
import { ModalRoot } from '@/components/modals/ModalRoot';
import { SettingsOverlay } from '@/components/layout/SettingsOverlay';
import { ServerSettingsWrapper } from '@/components/settings/ServerSettingsWrapper';
import { DesktopTitleBar } from '@/components/layout/DesktopTitleBar';
import { UpdateBanner } from '@/components/layout/UpdateBanner';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { KeyboardShortcutsModal } from '@/components/modals/KeyboardShortcutsModal';
import { useUIStore } from '@/stores/ui.store';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: ReactNode }) {
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Ctrl+/ to open keyboard shortcuts modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    setIsDesktop((window as any).constchat?.platform === 'desktop');
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <AppProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <DesktopTitleBar />
        {/* Spacer for fixed-positioned title bar (32px) */}
        {isDesktop && <div className="shrink-0" style={{ height: 32 }} />}
        {isDesktop && <UpdateBanner />}
        <ConnectionBanner />
        <div
          className="flex flex-1 overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {/* Server rail — fixed left column */}
          {(!isMobile || isMobileNavOpen) && (
            <ErrorBoundary fallbackTitle="Server list failed to load">
              <ServerRail />
            </ErrorBoundary>
          )}

          {/* Main content area */}
          <ErrorBoundary fallbackTitle="Something went wrong">
            <div className="flex-1 flex min-w-0 overflow-hidden">
              {children}
            </div>
          </ErrorBoundary>
        </div>
      </div>

      {/* Global modals */}
      <ModalRoot />

      {/* Settings overlay */}
      <SettingsOverlay />

      {/* Server settings overlay */}
      <ServerSettingsWrapper />

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Toast notifications */}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-surface-overlay)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '14px',
          },
        }}
      />
    </AppProvider>
  );
}
