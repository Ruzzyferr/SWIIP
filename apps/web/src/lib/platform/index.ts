/**
 * Platform abstraction layer.
 * Provides different configs and capabilities for web vs desktop (Electron).
 * Desktop app sets `window.constchat.platform = 'desktop'` via preload script.
 */

export interface PlatformHeartbeatConfig {
  /** How many missed heartbeat ACKs before declaring zombie connection */
  missedAckTolerance: number;
  /** Whether to use the Page Visibility API for tab backgrounding */
  useVisibilityAPI: boolean;
}

export interface PlatformReconnectConfig {
  /** Maximum number of reconnect attempts */
  maxAttempts: number;
  /** Retry delays in ms (exponential backoff pattern) */
  delays: number[];
  /** Reconnect backoff cap in ms */
  cap: number;
}

export interface PlatformAudioDefaults {
  /** Default audio processing mode */
  defaultMode: 'standard' | 'enhanced';
  /** Whether enhanced (RNNoise) mode is available on this platform */
  enhancedAvailable: boolean;
}

export interface PlatformProvider {
  readonly isDesktop: boolean;

  /** Gateway heartbeat tuning per platform */
  readonly heartbeatConfig: PlatformHeartbeatConfig;

  /** Gateway reconnect tuning per platform */
  readonly reconnectConfig: PlatformReconnectConfig;

  /** LiveKit reconnect policy delays */
  readonly livekitReconnectDelays: number[];

  /** Alone-in-channel auto-disconnect timeout (seconds) */
  readonly aloneTimeoutSec: number;

  /** Audio processing defaults per platform */
  readonly audioDefaults: PlatformAudioDefaults;

  /** Register a global keyboard shortcut (works even when app is unfocused on desktop) */
  registerGlobalShortcut(key: string, callback: () => void): void;

  /** Unregister a global keyboard shortcut */
  unregisterGlobalShortcut(key: string): void;

  /** Listen for window focus changes. Returns cleanup function. */
  onWindowFocusChange(callback: (focused: boolean) => void): () => void;

  /** Listen for system resume (wake from sleep). Returns cleanup function. Desktop only. */
  onSystemResume(callback: () => void): () => void;
}

// Lazy singleton — created on first access
let _provider: PlatformProvider | null = null;

export function getPlatformProvider(): PlatformProvider {
  if (_provider) return _provider;

  const isDesktop =
    typeof window !== 'undefined' &&
    (window as any).constchat?.platform === 'desktop';

  if (isDesktop) {
    _provider = createDesktopProvider();
  } else {
    _provider = createWebProvider();
  }

  return _provider;
}

// --- Web Provider ---
function createWebProvider(): PlatformProvider {
  return {
    isDesktop: false,

    heartbeatConfig: {
      missedAckTolerance: 2,
      useVisibilityAPI: true,
    },

    reconnectConfig: {
      maxAttempts: 15,
      delays: [1000, 2000, 4000, 8000, 15000, 30000],
      cap: 30000,
    },

    livekitReconnectDelays: [200, 500, 1000, 2000, 4000, 8000, 10000, 10000, 10000, 10000],

    aloneTimeoutSec: 300, // 5 minutes

    audioDefaults: {
      defaultMode: 'standard',
      // Set to true at runtime after AudioWorklet + WASM support check
      enhancedAvailable: false,
    },

    registerGlobalShortcut(_key: string, _callback: () => void) {
      // Web doesn't support global shortcuts — keyboard shortcuts are handled
      // via window.addEventListener('keydown') in useVoiceKeyboardShortcuts
    },

    unregisterGlobalShortcut(_key: string) {
      // No-op on web
    },

    onWindowFocusChange(callback: (focused: boolean) => void): () => void {
      const onFocus = () => callback(true);
      const onBlur = () => callback(false);
      window.addEventListener('focus', onFocus);
      window.addEventListener('blur', onBlur);
      return () => {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('blur', onBlur);
      };
    },

    onSystemResume(_callback: () => void): () => void {
      // No system resume event on web
      return () => {};
    },
  };
}

// --- Desktop Provider ---
function createDesktopProvider(): PlatformProvider {
  const constchat = (window as any).constchat;

  // Track registered shortcuts for cleanup
  const shortcutCallbacks = new Map<string, () => void>();

  // Listen for global shortcut events from Electron main process
  if (constchat?.onGlobalShortcut) {
    constchat.onGlobalShortcut((key: string) => {
      const cb = shortcutCallbacks.get(key);
      if (cb) cb();
    });
  }

  return {
    isDesktop: true,

    heartbeatConfig: {
      // Desktop doesn't suffer from browser tab throttling,
      // but window.hide() (minimize to tray) can still trigger visibility change.
      // Allow more missed ACKs since desktop connections should be more stable.
      missedAckTolerance: 3,
      // Disable Page Visibility API — desktop handles focus via Electron IPC.
      useVisibilityAPI: false,
    },

    reconnectConfig: {
      // Desktop users expect always-on connectivity — try harder
      maxAttempts: 30,
      delays: [500, 1000, 2000, 4000, 8000, 15000],
      cap: 15000,
    },

    // Faster initial reconnect, more retries
    livekitReconnectDelays: [100, 300, 500, 1000, 2000, 4000, 8000, 8000, 8000, 8000, 8000, 8000],

    aloneTimeoutSec: 1800, // 30 minutes — desktop users stay connected longer

    audioDefaults: {
      defaultMode: 'enhanced',
      enhancedAvailable: true,
    },

    registerGlobalShortcut(key: string, callback: () => void) {
      shortcutCallbacks.set(key, callback);
      constchat?.registerGlobalShortcut?.(key);
    },

    unregisterGlobalShortcut(key: string) {
      shortcutCallbacks.delete(key);
      constchat?.unregisterGlobalShortcut?.(key);
    },

    onWindowFocusChange(callback: (focused: boolean) => void): () => void {
      // Use Electron's maximize/focus events via IPC
      if (constchat?.onWindowFocusChange) {
        return constchat.onWindowFocusChange(callback);
      }
      // Fallback to browser events
      const onFocus = () => callback(true);
      const onBlur = () => callback(false);
      window.addEventListener('focus', onFocus);
      window.addEventListener('blur', onBlur);
      return () => {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('blur', onBlur);
      };
    },

    onSystemResume(callback: () => void): () => void {
      if (constchat?.onSystemResume) {
        return constchat.onSystemResume(callback) ?? (() => {});
      }
      return () => {};
    },
  };
}
