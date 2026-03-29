/**
 * Audio pipeline barrel export.
 */

// Types & policy
export {
  type AudioMode,
  type AudioPlatform,
  type PipelineState,
  type AudioConstraintPolicy,
  type AudioPipelineUIState,
  type AudioTelemetryEvent,
  type AudioPipelineStrategy,
  type KrispErrorDetail,
  AUDIO_MODE_POLICY,
  KrispInitError,
  KRISP_ERROR_MESSAGES,
  WorkletInitError,
  createDefaultPipelineUIState,
} from './types';

// Constraints
export {
  type CaptureConstraints,
  type RuntimeConstraints,
  type ConstraintVerification,
  type ConstraintMismatch,
  buildCaptureConstraints,
  buildRuntimeConstraints,
  verifyAppliedConstraints,
  requiresRepublish,
} from './constraints';

// Telemetry
export { audioTelemetry } from './telemetry';

// Pipeline
export { AudioPipeline } from './pipeline';

// Krisp Manager
export { KrispManager } from './krisp-manager';

// Desktop Worklet Manager
export { DesktopWorkletManager } from './desktop-worklet-manager';

// Strategies
export { BrowserAudioStrategy } from './strategies/browser.strategy';
export { DesktopAudioStrategy } from './strategies/desktop.strategy';
