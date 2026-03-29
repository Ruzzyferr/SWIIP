/**
 * Platform-aware audio constraint building and verification.
 *
 * Reads from the AUDIO_MODE_POLICY table — never hard-codes EC/NS/AGC values.
 * Runtime constraint changes cannot toggle echoCancellation (browser limitation),
 * so buildRuntimeConstraints() omits EC.
 */

import { AUDIO_MODE_POLICY, type AudioPlatform } from './types';
import type { AudioMode } from '@/stores/voice.store';

// ---------------------------------------------------------------------------
// Build capture constraints (initial mic publish)
// ---------------------------------------------------------------------------

export interface CaptureConstraints {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

/**
 * Build initial capture constraints for getUserMedia / mic publish.
 * Includes echoCancellation — can only be set at publish time.
 */
export function buildCaptureConstraints(platform: AudioPlatform, mode: AudioMode): CaptureConstraints {
  const policy = AUDIO_MODE_POLICY[platform]?.[mode] ?? AUDIO_MODE_POLICY.browser.standard;
  return {
    echoCancellation: policy.echoCancellation,
    noiseSuppression: policy.noiseSuppression,
    autoGainControl: policy.autoGainControl,
  };
}

// ---------------------------------------------------------------------------
// Build runtime constraints (mid-track changes)
// ---------------------------------------------------------------------------

export interface RuntimeConstraints {
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

/**
 * Build runtime-safe constraints for applyConstraints() mid-track.
 * Excludes echoCancellation — cannot be toggled after getUserMedia.
 */
export function buildRuntimeConstraints(platform: AudioPlatform, mode: AudioMode): RuntimeConstraints {
  const policy = AUDIO_MODE_POLICY[platform]?.[mode] ?? AUDIO_MODE_POLICY.browser.standard;
  return {
    noiseSuppression: policy.noiseSuppression,
    autoGainControl: policy.autoGainControl,
  };
}

// ---------------------------------------------------------------------------
// Constraint verification
// ---------------------------------------------------------------------------

export interface ConstraintMismatch {
  key: string;
  requested: boolean;
  actual: boolean | undefined;
}

export interface ConstraintVerification {
  matches: boolean;
  mismatches: ConstraintMismatch[];
  actualSettings: Record<string, unknown>;
}

/**
 * Verify that the applied constraints match what was requested.
 * Calls track.getSettings() and compares against expected values.
 *
 * Note: some browsers silently ignore constraints (e.g., Safari may ignore NS).
 * This function logs mismatches but does NOT throw.
 */
export function verifyAppliedConstraints(
  track: MediaStreamTrack,
  expected: CaptureConstraints | RuntimeConstraints,
): ConstraintVerification {
  const settings = track.getSettings();
  const mismatches: ConstraintMismatch[] = [];

  for (const [key, requestedValue] of Object.entries(expected)) {
    const actualValue = (settings as Record<string, unknown>)[key];
    if (typeof actualValue === 'boolean' && actualValue !== requestedValue) {
      mismatches.push({
        key,
        requested: requestedValue as boolean,
        actual: actualValue,
      });
    }
    // If actualValue is undefined, the browser doesn't report it — not a mismatch
  }

  return {
    matches: mismatches.length === 0,
    mismatches,
    actualSettings: settings as Record<string, unknown>,
  };
}

/**
 * Check whether switching from one mode to another requires a track republish
 * (because echoCancellation needs to change).
 */
export function requiresRepublish(
  platform: AudioPlatform,
  fromMode: AudioMode,
  toMode: AudioMode,
): boolean {
  const fallback = AUDIO_MODE_POLICY.browser.standard;
  const fromEC = (AUDIO_MODE_POLICY[platform]?.[fromMode] ?? fallback).echoCancellation;
  const toEC = (AUDIO_MODE_POLICY[platform]?.[toMode] ?? fallback).echoCancellation;
  return fromEC !== toEC;
}
