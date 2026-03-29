/**
 * KrispManager — manages the full Krisp noise filter lifecycle.
 *
 * Responsibilities:
 * - Support detection with smoke test
 * - Dynamic import + factory caching (constructor, not instance)
 * - Fresh processor creation per Room connection
 * - Apply/remove processor on mic track
 * - Structured failure codes for every error path
 * - Telemetry logging for diagnostics
 */

import { Track, type Room } from 'livekit-client';
import { KrispInitError, KRISP_ERROR_MESSAGES } from './types';
import { audioTelemetry } from './telemetry';
import type { AudioPlatform } from './types';

export type KrispManagerState =
  | 'idle'
  | 'checking'
  | 'loading'
  | 'ready'
  | 'applying'
  | 'applied'
  | 'failed';

export interface KrispFailure {
  code: KrispInitError;
  message: string;
  debugMessage: string;
  originalError?: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KrispFactory = () => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KrispModule = any;

export class KrispManager {
  private state: KrispManagerState = 'idle';
  private factory: KrispFactory | null = null;
  private loadPromise: Promise<KrispModule | null> | null = null;
  private supportCheckPromise: Promise<boolean> | null = null;
  private lastFailure: KrispFailure | null = null;
  private platform: AudioPlatform;

  constructor(platform: AudioPlatform) {
    this.platform = platform;
  }

  getState(): KrispManagerState {
    return this.state;
  }

  getLastFailure(): KrispFailure | null {
    return this.lastFailure;
  }

  /**
   * Check if Krisp is supported on this platform/browser.
   * Runs a smoke test on first call: import → support check → test instance.
   * Deduplicates concurrent calls via cached promise.
   */
  async checkSupport(): Promise<boolean> {
    if (this.state === 'ready' || this.state === 'applied') return true;
    if (this.state === 'failed') return false;
    if (this.supportCheckPromise) return this.supportCheckPromise;

    this.state = 'checking';
    this.supportCheckPromise = this._doCheckSupport();
    return this.supportCheckPromise;
  }

  private async _doCheckSupport(): Promise<boolean> {

    try {
      // Step 1: Dynamic import
      const mod = await this.dynamicImport();
      if (!mod) return false;

      // Step 2: isKrispNoiseFilterSupported()
      const isSupported = mod.isKrispNoiseFilterSupported?.();
      if (!isSupported) {
        this.fail(KrispInitError.NOT_SUPPORTED);
        return false;
      }

      // Step 3: Cache factory
      this.factory = mod.KrispNoiseFilter;
      this.state = 'ready';

      audioTelemetry.log({
        type: 'support_check',
        platform: this.platform,
        reason: 'Krisp supported',
        data: { result: true },
      });

      return true;
    } catch (err) {
      // If we haven't already set a specific error, use UNKNOWN
      if ((this.state as KrispManagerState) !== 'failed') {
        this.fail(KrispInitError.UNKNOWN, err);
      }
      return false;
    }
  }

  /**
   * Load the Krisp factory (dynamic import + cache).
   * Returns the factory or null on failure.
   */
  async loadFactory(): Promise<KrispFactory | null> {
    if (this.factory) return this.factory;

    this.state = 'loading';
    const mod = await this.dynamicImport();
    if (!mod) return null;

    this.factory = mod.KrispNoiseFilter;
    if (!this.factory) {
      this.fail(KrispInitError.IMPORT_FAILED, new Error('KrispNoiseFilter export not found'));
      return null;
    }

    this.state = 'ready';
    return this.factory;
  }

  /**
   * Create a fresh Krisp processor instance.
   * Must be called per Room connection — do NOT reuse instances.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async createProcessor(): Promise<any | null> {
    const factory = await this.loadFactory();
    if (!factory) return null;

    try {
      const processor = factory();
      return processor;
    } catch (err) {
      this.fail(KrispInitError.WORKER_INIT_FAILED, err);
      return null;
    }
  }

  /**
   * Apply Krisp processor to the room's mic track.
   * Returns true on success, false on failure (with structured error).
   */
  async applyToTrack(room: Room): Promise<boolean> {
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (!micPub?.track) {
      this.fail(KrispInitError.TRACK_UNAVAILABLE);
      return false;
    }

    this.state = 'applying';

    // Create processor with timeout
    const processorPromise = this.createProcessor();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 5000),
    );

    const processor = await Promise.race([processorPromise, timeoutPromise]);

    if (!processor) {
      if (this.state === 'applying') {
        // Timeout was the winner
        this.fail(KrispInitError.PROCESSOR_TIMEOUT);
      }
      return false;
    }

    try {
      // Stop any existing processor first
      await micPub.track.stopProcessor().catch(() => {});

      // Apply Krisp
      await micPub.track.setProcessor(processor);

      // Ensure browser NS is OFF — no double processing
      await micPub.track.mediaStreamTrack.applyConstraints({
        noiseSuppression: false,
        autoGainControl: false,
      }).catch(() => {});

      this.state = 'applied';
      this.lastFailure = null;

      audioTelemetry.log({
        type: 'processor',
        platform: this.platform,
        reason: 'Krisp processor applied successfully',
      });

      return true;
    } catch (err) {
      this.fail(KrispInitError.PROCESSOR_ERROR, err);
      return false;
    }
  }

  /**
   * Remove Krisp processor from the room's mic track.
   */
  async removeFromTrack(room: Room): Promise<void> {
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (micPub?.track) {
      try {
        await micPub.track.stopProcessor();
      } catch {
        // Already removed or no processor
      }
    }

    if (this.state === 'applied') {
      this.state = 'ready';
    }

    audioTelemetry.log({
      type: 'processor',
      platform: this.platform,
      reason: 'Krisp processor removed',
    });
  }

  /**
   * Reset factory cache — forces fresh load on next use.
   * Called on reconnect to avoid stale WASM state.
   */
  resetFactory(): void {
    this.factory = null;
    this.loadPromise = null;
    if (this.state === 'applied' || this.state === 'ready') {
      this.state = 'idle';
    }
  }

  /**
   * Full cleanup.
   */
  dispose(): void {
    this.factory = null;
    this.loadPromise = null;
    this.lastFailure = null;
    this.state = 'idle';
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async dynamicImport(): Promise<any | null> {
    if (this.loadPromise) {
      const mod = await this.loadPromise;
      return mod;
    }

    this.loadPromise = (async () => {
      try {
        const mod = await import('@livekit/krisp-noise-filter');
        return mod;
      } catch (err) {
        this.fail(KrispInitError.IMPORT_FAILED, err);
        this.loadPromise = null;
        return null;
      }
    })();

    return this.loadPromise;
  }

  private fail(code: KrispInitError, originalError?: unknown): void {
    const messages = KRISP_ERROR_MESSAGES[code];
    this.lastFailure = {
      code,
      message: messages.user,
      debugMessage: messages.debug,
      originalError,
    };
    this.state = 'failed';

    audioTelemetry.log({
      type: 'error',
      platform: this.platform,
      errorCode: code,
      errorMessage: messages.debug,
      data: {
        originalError: originalError instanceof Error
          ? { message: originalError.message, stack: originalError.stack }
          : String(originalError),
      },
    });

    console.warn(
      `[KrispManager] ${code}: ${messages.user}`,
      originalError ?? '',
    );
  }
}
