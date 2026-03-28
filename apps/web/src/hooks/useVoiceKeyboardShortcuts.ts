'use client';

import { useEffect } from 'react';
import { useVoiceStore } from '@/stores/voice.store';
import { useVoiceActions } from './useVoiceActions';

/**
 * Registers global keyboard shortcuts for voice controls.
 * Active only when connected to a voice channel.
 * Disabled when a text input, textarea, or contenteditable is focused.
 */
export function useVoiceKeyboardShortcuts() {
  const connectionState = useVoiceStore((s) => s.connectionState);
  const { toggleMute, toggleDeafen, toggleCamera } = useVoiceActions();

  useEffect(() => {
    if (connectionState !== 'connected') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // Ctrl+Shift+M — Mute toggle (works even in input)
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        toggleMute();
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
  }, [connectionState, toggleMute, toggleDeafen, toggleCamera]);
}
