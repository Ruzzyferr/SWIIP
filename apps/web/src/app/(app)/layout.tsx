'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { AppProvider } from '@/components/providers/AppProvider';
import { ServerRail } from '@/components/layout/ServerRail';
import { ModalRoot } from '@/components/modals/ModalRoot';
import { SettingsOverlay } from '@/components/layout/SettingsOverlay';
import { ServerSettingsWrapper } from '@/components/settings/ServerSettingsWrapper';
import { DesktopTitleBar } from '@/components/layout/DesktopTitleBar';
import { useUIStore } from '@/stores/ui.store';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: ReactNode }) {
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

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
      <DesktopTitleBar />
      <div
        className="flex w-screen overflow-hidden"
        style={{ height: isDesktop ? 'calc(100dvh - 32px)' : '100dvh', marginTop: isDesktop ? 32 : 0 }}
      >
        {/* Server rail — fixed left column */}
        {(!isMobile || isMobileNavOpen) && (
          <ServerRail />
        )}

        {/* Main content area */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          {children}
        </div>
      </div>

      {/* Global modals */}
      <ModalRoot />

      {/* Settings overlay */}
      <SettingsOverlay />

      {/* Server settings overlay */}
      <ServerSettingsWrapper />

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
