/**
 * DesktopWorkletManager — manages the AudioWorklet bridge for Desktop Standard mode.
 *
 * Architecture:
 *   getUserMedia → MediaStreamSource → AudioWorkletNode → MediaStreamDestination
 *   → processedTrack → replaceTrack() on LiveKit
 *
 * Lifecycle:
 * - init(): Register worklet module
 * - createChain(mediaStream): Build audio graph, return processed MediaStream
 * - replaceInput(newStream): Swap input source (device change) without re-init
 * - bypass(enabled): Passthrough mode for debugging
 * - dispose(): Full cleanup (disconnect, close context, null refs)
 */

import { WorkletInitError } from './types';
import { audioTelemetry } from './telemetry';
import type { AudioPlatform } from './types';

export type WorkletManagerState = 'idle' | 'loading' | 'active' | 'failed' | 'bypassed' | 'disposed';

export interface WorkletFailure {
  code: WorkletInitError;
  message: string;
  originalError?: unknown;
}

const WORKLET_URL = '/audio-worklets/desktop-standard-processor.js';
const LATENCY_WARN_MS = 20;

export class DesktopWorkletManager {
  private state: WorkletManagerState = 'idle';
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private lastFailure: WorkletFailure | null = null;
  private measuredLatencyMs: number | null = null;
  private platform: AudioPlatform;

  constructor(platform: AudioPlatform) {
    this.platform = platform;
  }

  getState(): WorkletManagerState {
    return this.state;
  }

  getLastFailure(): WorkletFailure | null {
    return this.lastFailure;
  }

  getLatency(): number | null {
    return this.measuredLatencyMs;
  }

  isLatencyWithinBudget(): boolean {
    if (this.measuredLatencyMs === null) return true;
    return this.measuredLatencyMs <= LATENCY_WARN_MS;
  }

  private initPromise: Promise<boolean> | null = null;

  /**
   * Initialize AudioContext and register the worklet module.
   * Deduplicates concurrent calls — if already loading, returns the same promise.
   */
  async init(): Promise<boolean> {
    if (this.state === 'active') return true;
    if (this.initPromise) return this.initPromise;

    this.state = 'loading';
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<boolean> {

    try {
      // Create AudioContext
      this.audioContext = new AudioContext({ sampleRate: 48000 });

      // Register worklet module
      await this.audioContext.audioWorklet.addModule(WORKLET_URL);

      audioTelemetry.log({
        type: 'processor',
        platform: this.platform,
        reason: 'Desktop worklet module registered',
      });

      return true;
    } catch (err) {
      this.fail(WorkletInitError.MODULE_LOAD_FAILED, 'Worklet module failed to load', err);
      this.initPromise = null; // Allow retry
      return false;
    }
  }

  /**
   * Build the audio processing chain from a raw MediaStream.
   * Returns the processed MediaStream for LiveKit's replaceTrack().
   */
  async createChain(rawStream: MediaStream): Promise<MediaStream | null> {
    if (!this.audioContext) {
      const initOk = await this.init();
      if (!initOk) return null;
    }

    const ctx = this.audioContext!;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    try {
      // Disconnect existing chain if any
      this.disconnectChain();

      // Build: source → worklet → destination
      this.sourceNode = ctx.createMediaStreamSource(rawStream);

      this.workletNode = new AudioWorkletNode(ctx, 'desktop-standard-processor');

      // Listen for latency report from worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data?.type === 'latency') {
          const workletBufferMs = event.data.latencyMs as number;
          const contextLatency = (ctx.baseLatency + (ctx.outputLatency || 0)) * 1000;
          this.measuredLatencyMs = workletBufferMs + contextLatency;

          audioTelemetry.log({
            type: 'latency',
            platform: this.platform,
            data: {
              workletBufferMs,
              contextLatencyMs: contextLatency,
              totalMs: this.measuredLatencyMs,
              withinBudget: this.isLatencyWithinBudget(),
            },
          });

          if (!this.isLatencyWithinBudget()) {
            console.warn(
              `[DesktopWorklet] Latency ${this.measuredLatencyMs.toFixed(1)}ms exceeds ${LATENCY_WARN_MS}ms budget`,
            );
          }
        }
      };

      this.destinationNode = ctx.createMediaStreamDestination();

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.destinationNode);

      this.state = 'active';
      this.lastFailure = null;

      audioTelemetry.log({
        type: 'processor',
        platform: this.platform,
        reason: 'Desktop worklet chain created',
      });

      return this.destinationNode.stream;
    } catch (err) {
      this.fail(WorkletInitError.NODE_CREATE_FAILED, 'Failed to create worklet audio chain', err);
      return null;
    }
  }

  /**
   * Replace input source (e.g., after device change) without rebuilding the worklet.
   */
  replaceInput(newStream: MediaStream): boolean {
    if (!this.audioContext || !this.workletNode || !this.destinationNode) {
      return false;
    }

    try {
      // Disconnect old source
      if (this.sourceNode) {
        this.sourceNode.disconnect();
      }

      // Create new source and connect
      this.sourceNode = this.audioContext.createMediaStreamSource(newStream);
      this.sourceNode.connect(this.workletNode);

      audioTelemetry.log({
        type: 'processor',
        platform: this.platform,
        reason: 'Worklet input source replaced (device change)',
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send parameter updates to the worklet processor.
   */
  updateParams(params: Record<string, unknown>): void {
    this.workletNode?.port.postMessage(params);
  }

  /**
   * Toggle bypass mode (passthrough for debugging).
   */
  bypass(enabled: boolean): void {
    this.workletNode?.port.postMessage({ bypass: enabled });
    this.state = enabled ? 'bypassed' : 'active';
  }

  /**
   * Get the processed output stream (if chain is active).
   */
  getOutputStream(): MediaStream | null {
    return this.destinationNode?.stream ?? null;
  }

  /**
   * Full cleanup — disconnect, close context, null refs.
   */
  dispose(): void {
    this.disconnectChain();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }

    this.audioContext = null;
    this.state = 'disposed';
    this.measuredLatencyMs = null;
    this.lastFailure = null;
    this.initPromise = null;

    audioTelemetry.log({
      type: 'processor',
      platform: this.platform,
      reason: 'Desktop worklet manager disposed',
    });
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private disconnectChain(): void {
    try {
      this.sourceNode?.disconnect();
      this.workletNode?.disconnect();
    } catch {
      // Nodes may already be disconnected
    }

    // Stop destination tracks to prevent leaks
    if (this.destinationNode) {
      for (const track of this.destinationNode.stream.getTracks()) {
        track.stop();
      }
    }

    this.sourceNode = null;
    this.workletNode = null;
    this.destinationNode = null;
  }

  private fail(code: WorkletInitError, message: string, originalError?: unknown): void {
    this.lastFailure = { code, message, originalError };
    this.state = 'failed';

    audioTelemetry.log({
      type: 'error',
      platform: this.platform,
      errorCode: code,
      errorMessage: message,
      data: {
        originalError: originalError instanceof Error
          ? { message: originalError.message, stack: originalError.stack }
          : String(originalError),
      },
    });

    console.warn(`[DesktopWorklet] ${code}: ${message}`, originalError ?? '');
  }
}
