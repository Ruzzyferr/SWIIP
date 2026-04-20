'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider } from '@/components/providers/AppProvider';
import { SwiipTopBar } from '@/components/layout/SwiipTopBar';
import { ServerDock } from '@/components/layout/ServerDock';
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
import { DMConversationList } from '@/components/layout/DMConversationList';
import { useUIStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAmbientTheme } from '@/hooks/useAmbientTheme';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const setMemberSidebarOpen = useUIStore((s) => s.setMemberSidebarOpen);

  // Ambient Adaptive Theming
  const activeGuildId = useUIStore((s) => s.activeGuildId);
  const isDMMode = !activeGuildId || activeGuildId === '@me' || activeGuildId === 'me';
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setIsDesktop(!!(window as any).constchat?.platform);
  }, []);

  // Narrow viewports: hide member sidebar by default; DM list uses overlay drawer (isMobileNavOpen).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      if (mq.matches) {
        setMemberSidebarOpen(false);
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setMemberSidebarOpen]);

  return (
    <AppProvider>
      <div className="flex flex-col h-[100dvh] w-full min-w-0 max-w-[100dvw] overflow-hidden" style={{ background: 'var(--color-surface-base)' }}>
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
              {/* Vertical server dock — desktop/tablet */}
              <div className="hidden md:flex">
                <ServerDock />
              </div>
              {/* DM conversation list — desktop column; mobile slide-over (toggled from Friends / DM header) */}
              {isDMMode && (
                <>
                  <aside
                    className="hidden md:flex w-60 shrink-0 flex-col overflow-y-auto h-full p-2 scroll-thin"
                    style={{
                      background: 'rgba(10, 14, 16, 0.6)',
                      borderRight: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <DMConversationList />
                  </aside>
                  <AnimatePresence>
                    {isMobileNavOpen && (
                      <>
                        <motion.div
                          key="dm-backdrop"
                          role="presentation"
                          aria-hidden
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="fixed inset-0 z-[55] bg-black/55 md:hidden"
                          onClick={() => setMobileNavOpen(false)}
                        />
                        <motion.aside
                          key="dm-drawer"
                          initial={{ x: '-105%' }}
                          animate={{ x: 0 }}
                          exit={{ x: '-105%' }}
                          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                          className="fixed inset-y-0 left-0 z-[60] flex w-[min(344px,92vw)] md:hidden"
                          style={{
                            background: 'rgba(10, 14, 16, 0.98)',
                            borderRight: '1px solid rgba(255,255,255,0.06)',
                            boxShadow: '8px 0 40px rgba(0,0,0,0.45)',
                          }}
                        >
                          <ServerDock />
                          <div className="flex-1 flex flex-col overflow-y-auto p-2 scroll-thin">
                            <DMConversationList />
                          </div>
                        </motion.aside>
                      </>
                    )}
                  </AnimatePresence>
                </>
              )}
              {children}
            </div>
          </ErrorBoundary>
        </div>

        {/* Bottom dock: voice panel + user panel — part of layout flow */}
        <div
          className="shrink-0 relative z-30"
          style={{
            background: 'rgba(12, 16, 18, 0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.3)',
          }}
        >
          {/* Ambient glow line on top */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--ambient-primary-muted, rgba(16,185,129,0.12)) 30%, var(--ambient-primary, #10B981) 50%, var(--ambient-primary-muted, rgba(16,185,129,0.12)) 70%, transparent)',
              opacity: 0.4,
              transition: 'background 600ms ease',
            }}
          />
          <VoiceConnectionPanel />
          <UserPanel />
        </div>
      </div>

      <ModalRoot />
      <SettingsOverlay />
      <ServerSettingsWrapper />
      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <div aria-live="polite" aria-atomic="true" className="sr-only" id="swiip-live-region" />

      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: '!max-w-[min(100vw-2rem,380px)] sm:!max-w-[380px]',
          },
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
