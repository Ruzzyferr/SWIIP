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
      rationale: 'Browser Enhanced: NS off because RNNoise handles NS — stacking browser NS causes artifacts. AGC off: browser AGC runs at getUserMedia time (before RNNoise), distorting the signal RNNoise depends on for noise detection. Low-voice issue compensated by RNNOISE_COMPENSATION_GAIN. EC stays on because RNNoise does NOT handle echo cancellation.',
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
      rationale: 'Desktop Enhanced: NS off because RNNoise handles NS. AGC off: browser AGC runs at getUserMedia time (before RNNoise), distorting the signal RNNoise depends on for noise detection. Low-voice issue compensated by RNNOISE_COMPENSATION_GAIN. EC on because RNNoise does NOT handle echo cancellation.',
    },
  },
};

// ---------------------------------------------------------------------------
// Noise Filter Error Codes (RNNoise-based)
// ---------------------------------------------------------------------------

export enum NoiseFilterError {
  IMPORT_FAILED       = 'NF_IMPORT_FAILED',
  NOT_SUPPORTED       = 'NF_NOT_SUPPORTED',
  WASM_FETCH_FAILED   = 'NF_WASM_FETCH_FAILED',
  WASM_COMPILE_FAILED = 'NF_WASM_COMPILE_FAILED',
  WORKER_INIT_FAILED  = 'NF_WORKER_INIT_FAILED',
  PROCESSOR_TIMEOUT   = 'NF_PROCESSOR_TIMEOUT',
  PROCESSOR_ERROR     = 'NF_PROCESSOR_ERROR',
  TRACK_UNAVAILABLE   = 'NF_TRACK_UNAVAILABLE',
  UNKNOWN             = 'NF_UNKNOWN',
}

/** @deprecated Use NoiseFilterError instead */
export const KrispInitError = NoiseFilterError;

export interface NoiseFilterErrorDetail {
  user: string;
  debug: string;
}

export const NOISE_FILTER_ERROR_MESSAGES: Record<NoiseFilterError, NoiseFilterErrorDetail> = {
  [NoiseFilterError.IMPORT_FAILED]:       { user: 'Noise filter module could not be loaded',        debug: 'Dynamic import of RNNoise WASM failed' },
  [NoiseFilterError.NOT_SUPPORTED]:       { user: 'Noise filter not supported on this browser',     debug: 'AudioWorklet or WebAssembly not available' },
  [NoiseFilterError.WASM_FETCH_FAILED]:   { user: 'Noise filter assets not found',                  debug: 'WASM binary fetch returned non-200 or network error' },
  [NoiseFilterError.WASM_COMPILE_FAILED]: { user: 'Noise filter failed to initialize',              debug: 'WebAssembly.compile() threw during RNNoise init' },
  [NoiseFilterError.WORKER_INIT_FAILED]:  { user: 'Noise filter worker failed to start',            debug: 'AudioWorklet module load failed — likely CSP issue' },
  [NoiseFilterError.PROCESSOR_TIMEOUT]:   { user: 'Noise filter took too long to start',            debug: 'RNNoise processor init exceeded 10s timeout' },
  [NoiseFilterError.PROCESSOR_ERROR]:     { user: 'Noise filter could not attach to audio',         debug: 'setProcessor() threw on mic track' },
  [NoiseFilterError.TRACK_UNAVAILABLE]:   { user: 'No microphone track available',                  debug: 'getTrackPublication(Microphone) returned null' },
  [NoiseFilterError.UNKNOWN]:             { user: 'Noise filter encountered an unexpected error',   debug: 'Catch-all with original error attached' },
};

/** @deprecated Use NOISE_FILTER_ERROR_MESSAGES instead */
export const KRISP_ERROR_MESSAGES = NOISE_FILTER_ERROR_MESSAGES;

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
  degradedErrorCode: NoiseFilterError | WorkletInitError | null;
  /** Support detection results */
  supportDetection: {
    rnnoise: 'supported' | 'unsupported' | 'unchecked' | 'checking';
    worklet: 'supported' | 'unsupported' | 'unchecked';
    platform: AudioPlatform;
  };
  /** Current processor status */
  processorStatus: {
    rnnoise: 'idle' | 'loading' | 'active' | 'failed' | 'removed';
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
      rnnoise: 'unchecked',
      worklet: 'unchecked',
      platform,
    },
    processorStatus: {
      rnnoise: 'idle',
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
  errorCode?: NoiseFilterError | WorkletInitError | string;
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
    errorCode: NoiseFilterError | WorkletInitError | null;
  }>;

  /**
   * Remove all processors and reset to clean state.
   */
  removeProcessors(room: import('livekit-client').Room): Promise<void>;

  /**
   * Set input gain multiplier (0–1 from store's inputVolume 0–100).
   * Applied on top of any processor-specific compensation gain.
   */
  setInputGain?(normalized: number): void;

  /**
   * Clean up all resources (AudioContext, worklet nodes, etc.)
   */
  dispose(): void;
}
