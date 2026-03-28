'use client';

import { useEffect } from 'react';
import { useVoiceStore } from '@/stores/voice.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useVoiceActions } from './useVoiceActions';
import { getPlatformProvider } from '@/lib/platform';

/**
 * Syncs voice state to the Electron tray menu and handles tray voice actions.
 * No-op on web — only runs on desktop.
 */
export function useDesktopTray() {
  const platform = getPlatformProvider();
  const connectionState = useVoiceStore((s) => s.connectionState);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const { toggleMute, toggleDeafen, leaveVoiceChannel } = useVoiceActions();

  // Sync voice state to tray
  useEffect(() => {
    if (!platform.isDesktop) return;
    const constchat = (window as any).constchat;
    constchat?.setVoiceStatus?.({
      connected: connectionState === 'connected',
      muted: selfMuted,
      deafened: selfDeafened,
    });
  }, [platform.isDesktop, connectionState, selfMuted, selfDeafened]);

  // Handle tray actions (with cleanup to prevent listener accumulation)
  useEffect(() => {
    if (!platform.isDesktop) return;
    const constchat = (window as any).constchat;
    if (!constchat?.onTrayVoiceAction) return;

    const cleanup = constchat.onTrayVoiceAction((action: string) => {
      switch (action) {
        case 'toggle-mute':
          toggleMute();
          break;
        case 'toggle-deafen':
          toggleDeafen();
          break;
        case 'disconnect':
          leaveVoiceChannel();
          break;
      }
    });
    return cleanup;
  }, [platform.isDesktop, toggleMute, toggleDeafen, leaveVoiceChannel]);

  // Sync unread badge count to taskbar (desktop only)
  useEffect(() => {
    if (!platform.isDesktop) return;
    const constchat = (window as any).constchat;
    if (!constchat?.setBadgeCount) return;

    const computeUnread = () => {
      const channels = useMessagesStore.getState().channels;
      let total = 0;
      for (const ch of Object.values(channels)) {
        total += ch.mentionCount ?? 0;
      }
      return total;
    };

    // Initial sync
    constchat.setBadgeCount(computeUnread());

    // Subscribe to store changes
    const unsub = useMessagesStore.subscribe(() => {
      constchat.setBadgeCount(computeUnread());
    });
    return unsub;
  }, [platform.isDesktop]);
}
