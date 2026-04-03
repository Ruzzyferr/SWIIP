/**
 * IndexedDB-based message cache for offline-first experience.
 * Stores messages per channel so they can be shown immediately on page load
 * before the API fetch completes (optimistic rendering pattern).
 */

import type { MessagePayload } from '@constchat/protocol';
import { coerceMessageReactionsToProtocol } from '@constchat/protocol';

const DB_NAME = 'constchat-messages';
const DB_VERSION = 1;
const STORE_NAME = 'messages';
const MAX_MESSAGES_PER_CHANNEL = 100;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['channelId', 'id'] });
        store.createIndex('byChannel', 'channelId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** Save messages for a channel (replaces existing cache for that channel). */
export async function cacheMessages(channelId: string, messages: MessagePayload[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('byChannel');

    // Delete existing messages for this channel
    const range = IDBKeyRange.only(channelId);
    const cursor = index.openCursor(range);
    await new Promise<void>((resolve, reject) => {
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) {
          c.delete();
          c.continue();
        } else {
          resolve();
        }
      };
      cursor.onerror = () => reject(cursor.error);
    });

    // Store the latest N messages
    const toStore = messages.slice(-MAX_MESSAGES_PER_CHANNEL);
    for (const msg of toStore) {
      store.put({ ...msg, channelId });
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB errors are non-critical
  }
}

/**
 * Load cached messages for a channel.
 * Legacy IndexedDB entries may store Prisma-shaped `reactions` rows; coerce to protocol so UI does not crash.
 */
export async function getCachedMessages(
  channelId: string,
  viewerUserId?: string,
): Promise<MessagePayload[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('byChannel');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(channelId));
      request.onsuccess = () => {
        const results = request.result as MessagePayload[];
        // Sort by timestamp ascending
        results.sort((a, b) => {
          const ta = new Date(a.timestamp ?? 0).getTime();
          const tb = new Date(b.timestamp ?? 0).getTime();
          return ta - tb;
        });
        const uid = viewerUserId ?? '';
        resolve(results.map((m) => coerceMessageReactionsToProtocol(m, uid)));
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/** Clear all cached messages. */
export async function clearMessageCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
  } catch {
    // non-critical
  }
}
