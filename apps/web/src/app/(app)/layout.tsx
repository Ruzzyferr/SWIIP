'use client';

import { type ReactNode, useEffect, useState, useCallback } from 'react';
import { AppProvider } from '@/components/providers/AppProvider';
import { ServerRail } from '@/components/layout/ServerRail';
import { ModalRoot } from '@/components/modals/ModalRoot';
import dynamic from 'next/dynamic';
const SettingsOverlay = dynamic(() => import('@/components/layout/SettingsOverlay').then(m => ({ default: m.SettingsOverlay })), { ssr: false });
const ServerSettingsWrapper = dynamic(() => import('@/components/settings/ServerSettingsWrapper').then(m => ({ default: m.ServerSettingsWrapper })), { ssr: false });
import { DesktopTitleBar } from '@/components/layout/DesktopTitleBar';
import { UpdateBanner } from '@/components/layout/UpdateBanner';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
const KeyboardShortcutsModal = dynamic(() => import('@/components/modals/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })), { ssr: false });
import { useUIStore } from '@/stores/ui.store';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: ReactNode }) {
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

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
      <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--color-surface-base)' }}>
        <DesktopTitleBar />
        {isDesktop && <div className="shrink-0" style={{ height: 32 }} />}
        {isDesktop && <UpdateBanner />}
        <ConnectionBanner />

        <div className="flex flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
          {/* Atmospheric emerald nebula — bottom left */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: '-20%',
              left: '-10%',
              width: '60%',
              height: '60%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          {/* Atmospheric emerald nebula — top right */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-15%',
              right: '-10%',
              width: '50%',
              height: '50%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(52, 211, 153, 0.03) 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />

          {/* Server rail */}
          {(!isMobile || isMobileNavOpen) && (
            <ErrorBoundary fallbackTitle="Server list failed to load">
              <ServerRail />
            </ErrorBoundary>
          )}

          {/* Main content */}
          <ErrorBoundary fallbackTitle="Something went wrong">
            <div className="flex-1 flex min-w-0 overflow-hidden" style={{ position: 'relative' }}>
              {children}
            </div>
          </ErrorBoundary>
        </div>
      </div>

      <ModalRoot />
      <SettingsOverlay />
      <ServerSettingsWrapper />
      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* ARIA live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="swiip-live-region" />

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-surface-floating)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            fontSize: '13px',
            backdropFilter: 'blur(20px)',
            boxShadow: 'var(--shadow-float)',
          },
        }}
      />
    </AppProvider>
  );
}
