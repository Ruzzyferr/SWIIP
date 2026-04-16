/**
 * NetworkMonitor — detects network interface changes (WiFi↔cellular, VPN,
 * sleep/wake) and notifies subscribers so the gateway and LiveKit can
 * reconnect immediately instead of waiting for heartbeat / ICE timeouts.
 *
 * Events emitted to callbacks:
 *  - 'online'  — device came back online (navigator.onLine flipped to true)
 *  - 'offline' — device went offline
 *  - 'change'  — network interface changed while still online (e.g. WiFi → cellular)
 */

export type NetworkEvent = 'online' | 'offline' | 'change';
export type NetworkCallback = (online: boolean, event: NetworkEvent) => void;

class NetworkMonitor {
  private listeners = new Set<NetworkCallback>();
  private started = false;
  private boundOnline = this.handleOnline.bind(this);
  private boundOffline = this.handleOffline.bind(this);
  private boundChange = this.handleChange.bind(this);

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    window.addEventListener('online', this.boundOnline);
    window.addEventListener('offline', this.boundOffline);

    // Network Information API (Chrome/Edge/Android WebView)
    const conn = (navigator as NavigatorWithConnection).connection;
    if (conn) {
      conn.addEventListener('change', this.boundChange);
    }
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    window.removeEventListener('online', this.boundOnline);
    window.removeEventListener('offline', this.boundOffline);

    const conn = (navigator as NavigatorWithConnection).connection;
    if (conn) {
      conn.removeEventListener('change', this.boundChange);
    }
  }

  subscribe(cb: NetworkCallback): () => void {
    this.listeners.add(cb);
    // Auto-start on first subscriber
    if (!this.started) this.start();
    return () => {
      this.listeners.delete(cb);
      if (this.listeners.size === 0) this.stop();
    };
  }

  get isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  private emit(online: boolean, event: NetworkEvent): void {
    for (const cb of this.listeners) {
      try { cb(online, event); } catch { /* subscriber error — don't crash */ }
    }
  }

  private handleOnline(): void {
    this.emit(true, 'online');
  }

  private handleOffline(): void {
    this.emit(false, 'offline');
  }

  private handleChange(): void {
    // Network interface changed — only fire if still online (WiFi → cellular, VPN toggle)
    if (navigator.onLine) {
      this.emit(true, 'change');
    }
  }
}

// Navigator.connection type shim (Network Information API)
interface NetworkInformation extends EventTarget {
  addEventListener(type: 'change', listener: EventListener): void;
  removeEventListener(type: 'change', listener: EventListener): void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

export const networkMonitor = new NetworkMonitor();
