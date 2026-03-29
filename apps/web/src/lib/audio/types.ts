/**
 * Audio pipeline types, policy table, error enums, and strategy interface.
 *
 * The AUDIO_MODE_POLICY table is the single source of truth for EC/NS/AGC
 * per platform and mode. These are INITIAL DEFAULTS — intended to be tuned
 * iteratively through A/B testing and user feedback.
 */

// Re-export AudioMode from voice store for convenience
export type { AudioMode } from '@/stores/voice.store';
import type { AudioMode } from '@/stores/voice.store';

// ---------------------------------------------------------------------------
// Platform type
// ---------------------------------------------------------------------------

export type AudioPlatform = 'browser' | 'desktop';

// ---------------------------------------------------------------------------
// Pipeline state machine
// ---------------------------------------------------------------------------

export type PipelineState =
  | 'IDLE'
  | 'PROBING'
  | 'APPLYING'
  | 'ACTIVE'
  | 'DEGRADED'
  | 'FAILED';

// ---------------------------------------------------------------------------
// EC/NS/AGC Policy Table — Initial Defaults
// ---------------------------------------------------------------------------

export interface AudioConstraintPolicy {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  /** Why these values were chosen — documented inline for future tuning. */
  rationale: string;
}

/**
 * Policy lookup: AUDIO_MODE_POLICY[platform][mode]
 *
 * These are initial defaults, NOT final truth.
 * Known risk: AGC=off in Enhanced may cause low input loudness on some devices.
 * If observed, the policy table supports per-entry override without touching
 * constraint logic. See plan for A/B testing strategy.
 */
export const AUDIO_MODE_POLICY: Record<AudioPlatform, Record<AudioMode, AudioConstraintPolicy>> = {
  browser: {
    raw: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      rationale: 'Raw mode: all processing off for instruments/studio mics.',
    },
    standard: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      rationale: 'Browser Standard: rely on browser WebRTC processing. AGC on for volume normalization across different mics.',
    },
    enhanced: {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
      rationale: 'Browser Enhanced: NS off because Krisp assumes raw input — stacking browser NS causes artifacts. AGC off because Krisp manages dynamics internally — stacking AGC causes pumping. EC stays on because Krisp does NOT handle echo cancellation.',
    },
  },
  desktop: {
    raw: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      rationale: 'Raw mode: all processing off for instruments/studio mics.',
    },
    standard: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      rationale: 'Desktop Standard: browser constraints (EC+NS+AGC) + AudioWorklet DSP chain (HPF + limiter). AGC on for baseline volume normalization.',
    },
    enhanced: {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
      rationale: 'Desktop Enhanced: NS off because Krisp handles NS internally. AGC off because Krisp manages dynamics — stacking causes pumping. EC on because Krisp does NOT handle echo cancellation.',
    },
  },
};

// ---------------------------------------------------------------------------
// Krisp Init Error Codes
// ---------------------------------------------------------------------------

export enum KrispInitError {
  IMPORT_FAILED       = 'KRISP_IMPORT_FAILED',
  NOT_SUPPORTED       = 'KRISP_NOT_SUPPORTED',
  WASM_FETCH_FAILED   = 'KRISP_WASM_FETCH_FAILED',
  WASM_COMPILE_FAILED = 'KRISP_WASM_COMPILE_FAILED',
  WORKER_INIT_FAILED  = 'KRISP_WORKER_INIT_FAILED',
  PROCESSOR_TIMEOUT   = 'KRISP_PROCESSOR_TIMEOUT',
  PROCESSOR_ERROR     = 'KRISP_PROCESSOR_ERROR',
  TRACK_UNAVAILABLE   = 'KRISP_TRACK_UNAVAILABLE',
  UNKNOWN             = 'KRISP_UNKNOWN',
}

export interface KrispErrorDetail {
  user: string;
  debug: string;
}

export const KRISP_ERROR_MESSAGES: Record<KrispInitError, KrispErrorDetail> = {
  [KrispInitError.IMPORT_FAILED]:       { user: 'Noise filter module could not be loaded',        debug: 'Dynamic import of @livekit/krisp-noise-filter failed' },
  [KrispInitError.NOT_SUPPORTED]:       { user: 'Noise filter not supported on this browser',     debug: 'isKrispNoiseFilterSupported() returned false' },
  [KrispInitError.WASM_FETCH_FAILED]:   { user: 'Noise filter assets not found',                  debug: 'WASM binary fetch returned non-200 or network error' },
  [KrispInitError.WASM_COMPILE_FAILED]: { user: 'Noise filter failed to initialize',              debug: 'WebAssembly.compile() threw during Krisp init' },
  [KrispInitError.WORKER_INIT_FAILED]:  { user: 'Noise filter worker failed to start',            debug: 'Worker constructor threw — likely CSP or file:// issue' },
  [KrispInitError.PROCESSOR_TIMEOUT]:   { user: 'Noise filter took too long to start',            debug: 'Krisp instance creation exceeded 5s timeout' },
  [KrispInitError.PROCESSOR_ERROR]:     { user: 'Noise filter could not attach to audio',         debug: 'setProcessor() threw on mic track' },
  [KrispInitError.TRACK_UNAVAILABLE]:   { user: 'No microphone track available',                  debug: 'getTrackPublication(Microphone) returned null' },
  [KrispInitError.UNKNOWN]:             { user: 'Noise filter encountered an unexpected error',   debug: 'Catch-all with original error attached' },
};

// ---------------------------------------------------------------------------
// Worklet Init Error Codes
// ---------------------------------------------------------------------------

export enum WorkletInitError {
  MODULE_LOAD_FAILED   = 'WORKLET_MODULE_LOAD_FAILED',
  CONTEXT_CREATE_FAILED = 'WORKLET_CONTEXT_CREATE_FAILED',
  NODE_CREATE_FAILED   = 'WORKLET_NODE_CREATE_FAILED',
  REPLACE_TRACK_FAILED = 'WORKLET_REPLACE_TRACK_FAILED',
  UNKNOWN              = 'WORKLET_UNKNOWN',
}

// ---------------------------------------------------------------------------
// Pipeline UI State (exposed to store and UI)
// ---------------------------------------------------------------------------

export interface AudioPipelineUIState {
  /** What the user selected in settings */
  requestedMode: AudioMode;
  /** What's actually running right now */
  activeMode: AudioMode;
  /** True when activeMode !== requestedMode due to fallback */
  isDegraded: boolean;
  /** Human-readable reason for degradation, or null if not degraded */
  degradedReason: string | null;
  /** Structured error code for degradation, or null */
  degradedErrorCode: KrispInitError | WorkletInitError | null;
  /** Support detection results */
  supportDetection: {
    krisp: 'supported' | 'unsupported' | 'unchecked' | 'checking';
    worklet: 'supported' | 'unsupported' | 'unchecked';
    platform: AudioPlatform;
  };
  /** Current processor status */
  processorStatus: {
    krisp: 'idle' | 'loading' | 'active' | 'failed' | 'removed';
    worklet: 'idle' | 'loading' | 'active' | 'failed' | 'bypassed';
  };
  /** Latency measurements (desktop worklet only) */
  latency: {
    workletMs: number | null;
    withinBudget: boolean;
  };
  /** Current state machine state */
  pipelineState: PipelineState;
}

export function createDefaultPipelineUIState(platform: AudioPlatform, requestedMode: AudioMode): AudioPipelineUIState {
  return {
    requestedMode,
    activeMode: requestedMode,
    isDegraded: false,
    degradedReason: null,
    degradedErrorCode: null,
    supportDetection: {
      krisp: 'unchecked',
      worklet: 'unchecked',
      platform,
    },
    processorStatus: {
      krisp: 'idle',
      worklet: 'idle',
    },
    latency: {
      workletMs: null,
      withinBudget: true,
    },
    pipelineState: 'IDLE',
  };
}

// ---------------------------------------------------------------------------
// Telemetry Event
// ---------------------------------------------------------------------------

export interface AudioTelemetryEvent {
  type: 'transition' | 'error' | 'constraint_verify' | 'latency' | 'processor' | 'support_check';
  timestamp: number;
  platform: AudioPlatform;
  from?: PipelineState;
  to?: PipelineState;
  reason?: string;
  retryCount?: number;
  errorCode?: KrispInitError | WorkletInitError | string;
  errorMessage?: string;
  /** Arbitrary data payload for the event */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Strategy Interface
// ---------------------------------------------------------------------------

export interface AudioPipelineStrategy {
  readonly platform: AudioPlatform;

  /**
   * Apply the given audio mode to the room's mic track.
   * Returns the mode that was actually applied (may differ due to fallback).
   */
  applyMode(
    mode: AudioMode,
    room: import('livekit-client').Room,
  ): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: KrispInitError | WorkletInitError | null;
  }>;

  /**
   * Remove all processors and reset to clean state.
   */
  removeProcessors(room: import('livekit-client').Room): Promise<void>;

  /**
   * Clean up all resources (AudioContext, worklet nodes, etc.)
   */
  dispose(): void;
}
