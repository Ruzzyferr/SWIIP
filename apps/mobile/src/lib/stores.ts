/**
 * Mobile store instances.
 *
 * Most stores from @constchat/shared are already singletons and work as-is.
 * Auth store needs a custom SecureStore-backed persistence adapter.
 */
import * as SecureStore from 'expo-secure-store';
import { createAuthStore } from '@constchat/shared';

// Re-export shared singleton stores for convenience
export {
  useGatewayStore,
  useGuildsStore,
  useMessagesStore,
  usePresenceStore,
  useDMsStore,
  useFriendsStore,
  useUIStore,
  useVoiceStore,
} from '@constchat/shared';

// ---------------------------------------------------------------------------
// Mobile Auth Store — persisted in expo-secure-store (encrypted)
// ---------------------------------------------------------------------------

// SecureStore is async but Zustand persist expects sync-compatible getItem/setItem.
// We use an in-memory cache that syncs to SecureStore asynchronously.
const secureStorageCache = new Map<string, string>();
let cacheLoaded = false;

const STORAGE_KEY = 'constchat-auth';

async function loadCache() {
  if (cacheLoaded) return;
  try {
    const value = await SecureStore.getItemAsync(STORAGE_KEY);
    if (value) {
      secureStorageCache.set(STORAGE_KEY, value);
    }
  } catch {
    // SecureStore not available — ignore
  }
  cacheLoaded = true;
}

export const secureStorage = {
  getItem: (name: string): string | null => {
    return secureStorageCache.get(name) ?? null;
  },
  setItem: (name: string, value: string): void => {
    secureStorageCache.set(name, value);
    SecureStore.setItemAsync(name, value).catch(() => {});
  },
  removeItem: (name: string): void => {
    secureStorageCache.delete(name);
    SecureStore.deleteItemAsync(name).catch(() => {});
  },
};

export const useAuthStore = createAuthStore(secureStorage);

/**
 * Must be called before the app renders to hydrate the auth cache from SecureStore.
 */
export async function initializeAuthStorage(): Promise<void> {
  await loadCache();
  // Trigger Zustand rehydration by re-reading persisted state
  (useAuthStore as any).persist?.rehydrate?.();
}
