'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { AppProvider } from '@/components/providers/AppProvider';
import { SwiipTopBar } from '@/components/layout/SwiipTopBar';
import { ModalRoot } from '@/components/modals/ModalRoot';
import dynamic from 'next/dynamic';
const SettingsOverlay = dynamic(() => import('@/components/layout/SettingsOverlay').then(m => ({ default: m.SettingsOverlay })), { ssr: false });
const ServerSettingsWrapper = dynamic(() => import('@/components/settings/ServerSettingsWrapper').then(m => ({ default: m.ServerSettingsWrapper })), { ssr: false });
import { DesktopTitleBar } from '@/components/layout/DesktopTitleBar';
import { UpdateBanner } from '@/components/layout/UpdateBanner';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
const KeyboardShortcutsModal = dynamic(() => import('@/components/modals/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })), { ssr: false });
import { UserPanel } from '@/components/layout/UserPanel';
import { VoiceConnectionPanel } from '@/components/voice/VoiceConnectionPanel';
import { useUIStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAmbientTheme } from '@/hooks/useAmbientTheme';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Ambient Adaptive Theming
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const activeGuild = useGuildsStore((s) => activeGuildId ? s.guilds[activeGuildId] : null);
  const guildIconUrl = activeGuild?.icon ?? null;
  useAmbientTheme(guildIconUrl);

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
    setIsDesktop(!!(window as any).constchat?.platform);
  }, []);

  return (
    <AppProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--color-surface-base)' }}>
        <DesktopTitleBar />
        {isDesktop && <div className="shrink-0" style={{ height: 32 }} />}
        {isDesktop && <UpdateBanner />}
        <ConnectionBanner />

        {/* Unified Top Bar — replaces ServerRail + ChannelSidebar header */}
        <ErrorBoundary fallbackTitle="Navigation failed to load">
          <SwiipTopBar />
        </ErrorBoundary>

        {/* Full-width content area */}
        <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
          {/* Ambient nebula */}
          <div
            className="absolute pointer-events-none transition-all"
            style={{
              bottom: '-20%',
              left: '-10%',
              width: '60%',
              height: '60%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, var(--ambient-primary-subtle, rgba(16, 185, 129, 0.06)) 0%, transparent 70%)',
              filter: 'blur(80px)',
              transitionDuration: '800ms',
            }}
          />
          <div
            className="absolute pointer-events-none transition-all"
            style={{
              top: '-15%',
              right: '-10%',
              width: '50%',
              height: '50%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, var(--ambient-primary-subtle, rgba(52, 211, 153, 0.03)) 0%, transparent 70%)',
              filter: 'blur(80px)',
              transitionDuration: '800ms',
            }}
          />

          <ErrorBoundary fallbackTitle="Something went wrong">
            <div className="flex-1 flex min-w-0 overflow-hidden h-full" style={{ position: 'relative' }}>
              {children}
            </div>
          </ErrorBoundary>
        </div>
      </div>

      {/* Floating bottom-left: voice panel + user panel */}
      <div
        className="fixed bottom-3 left-3 z-30 flex flex-col gap-1"
        style={{
          width: 260,
          borderRadius: 16,
          background: 'rgba(12, 16, 18, 0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <VoiceConnectionPanel />
        <UserPanel />
      </div>

      <ModalRoot />
      <SettingsOverlay />
      <ServerSettingsWrapper />
      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <div aria-live="polite" aria-atomic="true" className="sr-only" id="swiip-live-region" />

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(18, 22, 22, 0.85)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-xl)',
            fontSize: '13px',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
          },
        }}
      />
    </AppProvider>
  );
}
