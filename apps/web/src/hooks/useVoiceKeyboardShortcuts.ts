'use client';

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '@/stores/voice.store';
import { useVoiceActions } from './useVoiceActions';
import { getPlatformProvider } from '@/lib/platform';

/**
 * Registers keyboard shortcuts for voice controls.
 * Active only when connected to a voice channel.
 *
 * On desktop (Electron), modifier shortcuts (Ctrl+Shift+M/D/H/G) are registered
 * as global shortcuts via Electron's globalShortcut module — they work even when
 * the window is unfocused, even when the window is unfocused.
 *
 * PTT on desktop: when app is focused, uses keydown/keyup for proper hold-to-talk.
 * When unfocused, global shortcut acts as toggle (Electron limitation: no keyup event).
 * Focus tracking ensures the two modes don't conflict.
 */
export function useVoiceKeyboardShortcuts() {
  const connectionState = useVoiceStore((s) => s.connectionState);
  const pushToTalk = useVoiceStore((s) => s.settings.pushToTalk);
  const pttKey = useVoiceStore((s) => s.settings.pttKey);
  const keyboardShortcutsEnabled = useVoiceStore((s) => s.settings.keyboardShortcutsEnabled);
  const { toggleMute, toggleDeafen, toggleCamera, toggleScreenShare, leaveVoiceChannel } = useVoiceActions();
  const pttActiveRef = useRef(false);
  const windowFocusedRef = useRef(true);

  const platform = getPlatformProvider();

  // Track window focus for PTT mode sync (desktop only)
  useEffect(() => {
    if (!platform.isDesktop) return;
    const cleanup = platform.onWindowFocusChange((focused) => {
      windowFocusedRef.current = focused;
      // When window gains focus, reset global PTT toggle to avoid state drift
      // The window-level keydown/keyup handlers take over
    });
    return cleanup;
  }, [platform]);

  // ── Desktop Global Shortcuts (Ctrl+Shift+M/D/H/G) ──
  useEffect(() => {
    if (!platform.isDesktop || connectionState !== 'connected' || pushToTalk || !keyboardShortcutsEnabled) return;

    platform.registerGlobalShortcut('Ctrl+Shift+M', toggleMute);
    platform.registerGlobalShortcut('Ctrl+Shift+D', toggleDeafen);
    platform.registerGlobalShortcut('Ctrl+Shift+H', leaveVoiceChannel);
    platform.registerGlobalShortcut('Ctrl+Shift+G', toggleScreenShare);

    return () => {
      platform.unregisterGlobalShortcut('Ctrl+Shift+M');
      platform.unregisterGlobalShortcut('Ctrl+Shift+D');
      platform.unregisterGlobalShortcut('Ctrl+Shift+H');
      platform.unregisterGlobalShortcut('Ctrl+Shift+G');
    };
  }, [platform, connectionState, pushToTalk, keyboardShortcutsEnabled, toggleMute, toggleDeafen, leaveVoiceChannel, toggleScreenShare]);

  // ── Push-to-Talk ──
  useEffect(() => {
    if (connectionState !== 'connected' || !pushToTalk || !keyboardShortcutsEnabled) return;

    // Start muted when PTT mode is active
    const store = useVoiceStore.getState();
    if (!store.selfMuted) {
      store.setSelfMuted(true);
    }

    const matchesPTTKey = (e: KeyboardEvent) => {
      if (pttKey === 'Space') return e.code === 'Space';
      if (pttKey.length === 1) return e.key.toUpperCase() === pttKey.toUpperCase();
      return e.code === pttKey;
    };

    // Window-level hold-to-talk (works when app is focused)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesPTTKey(e) && !pttActiveRef.current) {
        e.preventDefault();
        pttActiveRef.current = true;
        useVoiceStore.getState().setSelfMuted(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (matchesPTTKey(e) && pttActiveRef.current) {
        e.preventDefault();
        pttActiveRef.current = false;
        useVoiceStore.getState().setSelfMuted(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    // Desktop: also register global shortcut as toggle for when unfocused.
    // Focus-aware: only toggles when window is NOT focused (avoids double-fire).
    let globalCleanup: (() => void) | undefined;
    if (platform.isDesktop) {
      const accelerator = pttKeyToAccelerator(pttKey);
      if (accelerator) {
        platform.registerGlobalShortcut(accelerator, () => {
          // Only use toggle mode when unfocused — focused mode uses keydown/keyup
          if (!windowFocusedRef.current) {
            const currentlyMuted = useVoiceStore.getState().selfMuted;
            useVoiceStore.getState().setSelfMuted(!currentlyMuted);
          }
        });
        globalCleanup = () => platform.unregisterGlobalShortcut(accelerator);
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      globalCleanup?.();
      pttActiveRef.current = false;
      useVoiceStore.getState().setSelfMuted(false);
    };
  }, [platform, connectionState, pushToTalk, pttKey, keyboardShortcutsEnabled]);

  // ── Regular keyboard shortcuts (non-PTT, window-level) ──
  useEffect(() => {
    if (connectionState !== 'connected' || pushToTalk || !keyboardShortcutsEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift shortcuts — work even in input fields
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key) {
          case 'M':
            e.preventDefault();
            toggleMute();
            return;
          case 'D':
            e.preventDefault();
            toggleDeafen();
            return;
          case 'H':
            e.preventDefault();
            leaveVoiceChannel();
            return;
          case 'G':
            e.preventDefault();
            toggleScreenShare();
            return;
        }
      }

      // Skip if user is typing in an input field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // Single-key shortcuts (only when not typing)
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'm':
            e.preventDefault();
            toggleMute();
            break;
          case 'd':
            e.preventDefault();
            toggleDeafen();
            break;
          case 'v':
            e.preventDefault();
            toggleCamera();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectionState, pushToTalk, keyboardShortcutsEnabled, toggleMute, toggleDeafen, toggleCamera, leaveVoiceChannel, toggleScreenShare]);
}

/**
 * Convert PTT key name to Electron accelerator format.
 * E.g., "Space" → "Space", "KeyV" → "V", "F5" → "F5"
 */
function pttKeyToAccelerator(pttKey: string): string | null {
  if (pttKey === 'Space') return 'Space';
  if (pttKey.startsWith('Key')) return pttKey.slice(3); // "KeyV" → "V"
  if (pttKey.startsWith('Digit')) return pttKey.slice(5); // "Digit1" → "1"
  if (pttKey.length === 1) return pttKey.toUpperCase();
  if (pttKey.startsWith('F') && !isNaN(Number(pttKey.slice(1)))) return pttKey; // F1-F12
  return null;
}
