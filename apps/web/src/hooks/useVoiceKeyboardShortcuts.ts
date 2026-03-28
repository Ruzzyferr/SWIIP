'use client';

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '@/stores/voice.store';
import { useVoiceActions } from './useVoiceActions';

/**
 * Registers global keyboard shortcuts for voice controls.
 * Active only when connected to a voice channel.
 * Disabled when a text input, textarea, or contenteditable is focused (except PTT).
 */
export function useVoiceKeyboardShortcuts() {
  const connectionState = useVoiceStore((s) => s.connectionState);
  const pushToTalk = useVoiceStore((s) => s.settings.pushToTalk);
  const pttKey = useVoiceStore((s) => s.settings.pttKey);
  const { toggleMute, toggleDeafen, toggleCamera } = useVoiceActions();
  const pttActiveRef = useRef(false);

  // Push-to-Talk: mute by default, unmute while key is held
  useEffect(() => {
    if (connectionState !== 'connected' || !pushToTalk) return;

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
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      // Unmute when leaving PTT mode
      pttActiveRef.current = false;
      useVoiceStore.getState().setSelfMuted(false);
    };
  }, [connectionState, pushToTalk, pttKey]);

  // Regular keyboard shortcuts (non-PTT)
  useEffect(() => {
    if (connectionState !== 'connected' || pushToTalk) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+M — Mute toggle (works even in input)
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        toggleMute();
        return;
      }

      // Skip if user is typing in an input field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // Single-key shortcuts (only when not typing)
      switch (e.key.toLowerCase()) {
        case 'm':
          if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            toggleMute();
          }
          break;
        case 'd':
          if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            toggleDeafen();
          }
          break;
        case 'v':
          if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            toggleCamera();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectionState, pushToTalk, toggleMute, toggleDeafen, toggleCamera]);
}
