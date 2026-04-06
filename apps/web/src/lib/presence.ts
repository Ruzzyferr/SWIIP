import type { PresenceStatus } from '@constchat/protocol';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { usePresenceStore } from '@/stores/presence.store';

/**
 * Updates the user's presence status both locally and on the gateway.
 * Shared by StatusPicker and AccountPage to avoid duplication.
 */
export function updateUserStatus(
  userId: string,
  status: PresenceStatus,
  customStatus?: string,
  customStatusEmoji?: string,
  customStatusExpiresAt?: string,
): void {
  const gw = getGatewayClient();
  gw.updatePresence(status, [], customStatus, customStatusEmoji, customStatusExpiresAt);
  usePresenceStore.getState().setPresence(userId, { status, customStatus, customStatusEmoji, customStatusExpiresAt });
}

/** Clear-after durations in milliseconds. */
export const CLEAR_AFTER_OPTIONS = [
  { label: "Don't clear", value: 0 },
  { label: '30 minutes', value: 30 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '4 hours', value: 4 * 60 * 60 * 1000 },
  { label: 'Today', value: -1 }, // -1 = calculate until midnight
] as const;

const CLEAR_TIMER_KEY = 'swiip:custom_status_clear_at';

/** Schedule clearing custom status after a duration. */
export function scheduleStatusClear(userId: string, currentStatus: PresenceStatus, durationMs: number): void {
  if (durationMs === 0) {
    localStorage.removeItem(CLEAR_TIMER_KEY);
    return;
  }

  let clearAt: number;
  if (durationMs === -1) {
    // Until end of today
    const now = new Date();
    clearAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  } else {
    clearAt = Date.now() + durationMs;
  }

  localStorage.setItem(CLEAR_TIMER_KEY, JSON.stringify({ clearAt, userId, status: currentStatus }));
}

/** Check and execute any pending status clear on mount. */
export function checkPendingStatusClear(): void {
  try {
    const raw = localStorage.getItem(CLEAR_TIMER_KEY);
    if (!raw) return;
    const { clearAt, userId, status } = JSON.parse(raw);
    if (Date.now() >= clearAt) {
      localStorage.removeItem(CLEAR_TIMER_KEY);
      updateUserStatus(userId, status, undefined);
    }
  } catch {
    localStorage.removeItem(CLEAR_TIMER_KEY);
  }
}
