'use client';

import { type ReactNode } from 'react';
import { AppProvider } from '@/components/providers/AppProvider';
import { ServerRail } from '@/components/layout/ServerRail';
import { ModalRoot } from '@/components/modals/ModalRoot';
import { SettingsOverlay } from '@/components/layout/SettingsOverlay';
import { ServerSettingsWrapper } from '@/components/settings/ServerSettingsWrapper';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        {/* Server rail — fixed left column */}
        <ServerRail />

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
