/**
 * RnnoiseManager — manages the RNNoise noise filter lifecycle.
 *
 * Drop-in replacement for KrispManager. Uses open-source RNNoise WASM
 * instead of proprietary Krisp (which requires LiveKit Cloud license).
 *
 * Key differences from KrispManager:
 * - Uses @sapphi-red/web-noise-suppressor (MIT, free)
 * - Retry-friendly: processor failure doesn't permanently kill the manager
 * - Support check tests AudioWorklet + WASM availability
 */

import { Track, type Room } from 'livekit-client';
import { NoiseFilterError, NOISE_FILTER_ERROR_MESSAGES } from './types';
import { audioTelemetry } from './telemetry';
import type { AudioPlatform } from './types';
import { RnnoiseProcessor } from './rnnoise-processor';

export type RnnoiseManagerState =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'applying'
  | 'applied'
  | 'failed';

export interface RnnoiseFailure {
  code: NoiseFilterError;
  message: string;
  debugMessage: string;
  originalError?: unknown;
}

export class RnnoiseManager {
  private state: RnnoiseManagerState = 'idle';
  private supportCheckPromise: Promise<boolean> | null = null;
  private lastFailure: RnnoiseFailure | null = null;
  private platform: AudioPlatform;
  private activeProcessor: RnnoiseProcessor | null = null;

  constructor(platform: AudioPlatform) {
    this.platform = platform;
  }

  getState(): RnnoiseManagerState {
    return this.state;
  }

  getLastFailure(): RnnoiseFailure | null {
    return this.lastFailure;
  }

  /**
   * Check if RNNoise is supported (AudioWorklet + WASM).
   * Deduplicates concurrent calls via cached promise.
   */
  async checkSupport(): Promise<boolean> {
    if (this.state === 'ready' || this.state === 'applied') return true;
    // Unlike KrispManager, we allow retry after failure
    if (this.state === 'checking' && this.supportCheckPromise) {
      return this.supportCheckPromise;
    }

    this.state = 'checking';
    this.supportCheckPromise = this._doCheckSupport();
    const result = await this.supportCheckPromise;
    this.supportCheckPromise = null;
    return result;
  }

  private async _doCheckSupport(): Promise<boolean> {
    try {
      // Check AudioWorklet support
      if (typeof AudioWorkletNode === 'undefined') {
        this.fail(NoiseFilterError.NOT_SUPPORTED);
        return false;
      }

      // Check WebAssembly support
      if (typeof WebAssembly === 'undefined') {
        this.fail(NoiseFilterError.NOT_SUPPORTED);
        return false;
      }

      this.state = 'ready';

      audioTelemetry.log({
        type: 'support_check',
        platform: this.platform,
        reason: 'RNNoise supported',
        data: { result: true },
      });

      return true;
    } catch (err) {
      if (this.state !== 'failed') {
        this.fail(NoiseFilterError.UNKNOWN, err);
      }
      return false;
    }
  }

  /**
   * Create a fresh RNNoise processor instance.
   * Returns a new RnnoiseProcessor that implements LiveKit's TrackProcessor.
   */
  createProcessor(): RnnoiseProcessor {
    return new RnnoiseProcessor();
  }

  /**
   * Apply RNNoise processor to the room's mic track.
   * Returns true on success, false on failure (with structured error).
   */
  async applyToTrack(room: Room): Promise<boolean> {
    // Check support first (allows retry after previous failure)
    const supported = await this.checkSupport();
    if (!supported) return false;

    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (!micPub?.track) {
      this.fail(NoiseFilterError.TRACK_UNAVAILABLE);
      return false;
    }

    this.state = 'applying';

    const processor = this.createProcessor();

    // Apply with timeout
    const timeoutPromise = new Promise<false>((resolve) =>
      setTimeout(() => resolve(false), 10_000),
    );

    const applyPromise = (async (): Promise<boolean> => {
      try {
        // Stop any existing processor first
        await micPub.track!.stopProcessor().catch(() => {});

        // Apply RNNoise processor — cast needed because LiveKit's generic
        // TrackProcessor type is overly strict with ProcessorOptions variance
        await (micPub.track as any).setProcessor(processor);
        this.activeProcessor = processor;

        // Disable browser NS to prevent double-processing
        await micPub.track!.mediaStreamTrack.applyConstraints({
          noiseSuppression: false,
          autoGainControl: false,
        }).catch(() => {});

        this.state = 'applied';
        this.lastFailure = null;

        audioTelemetry.log({
          type: 'processor',
          platform: this.platform,
          reason: 'RNNoise processor applied successfully',
        });

        return true;
      } catch (err) {
        this.fail(NoiseFilterError.PROCESSOR_ERROR, err);
        return false;
      }
    })();

    const result = await Promise.race([applyPromise, timeoutPromise]);

    if (!result && this.state === 'applying') {
      this.fail(NoiseFilterError.PROCESSOR_TIMEOUT);
    }

    return result;
  }

  /**
   * Set input gain on the active RNNoise processor.
   * @param normalized 0–1 (from store's inputVolume / 100)
   */
  setInputGain(normalized: number): void {
    this.activeProcessor?.setInputGain(normalized);
  }

  /**
   * Remove RNNoise processor from the room's mic track.
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

    this.activeProcessor = null;

    // Return to ready state (not idle) — ready for re-application
    if (this.state === 'applied') {
      this.state = 'ready';
    }

    audioTelemetry.log({
      type: 'processor',
      platform: this.platform,
      reason: 'RNNoise processor removed',
    });
  }

  /**
   * Reset state — allows retry after failure.
   * Called on reconnect to avoid stale state.
   */
  resetState(): void {
    if (this.state === 'failed') {
      this.state = 'idle';
    }
    this.supportCheckPromise = null;
  }

  /**
   * Full cleanup.
   */
  dispose(): void {
    this.activeProcessor = null;
    this.lastFailure = null;
    this.supportCheckPromise = null;
    this.state = 'idle';
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private fail(code: NoiseFilterError, originalError?: unknown): void {
    const messages = NOISE_FILTER_ERROR_MESSAGES[code];
    this.lastFailure = {
      code,
      message: messages.user,
      debugMessage: messages.debug,
      originalError,
    };
    // Don't permanently kill the manager — allow retry
    // Only set to 'failed' if we were checking support (not just a processor error)
    if (this.state === 'checking') {
      this.state = 'failed';
    } else {
      // For processor errors, go back to 'ready' so user can retry
      this.state = 'ready';
    }

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
      `[RnnoiseManager] ${code}: ${messages.user}`,
      originalError ?? '',
    );
  }
}
