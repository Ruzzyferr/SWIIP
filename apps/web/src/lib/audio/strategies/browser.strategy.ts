/**
 * BrowserAudioStrategy — handles audio modes in browser context.
 *
 * - Standard: browser WebRTC constraints (EC+NS+AGC)
 * - Enhanced: RNNoise processor. On fail → republish track with Standard constraints.
 * - Raw: all processing off.
 */

import { Track, type Room } from 'livekit-client';
import type { AudioPipelineStrategy, AudioMode } from '../types';
import { NoiseFilterError, WorkletInitError } from '../types';
import { buildCaptureConstraints, buildRuntimeConstraints, verifyAppliedConstraints } from '../constraints';
import { RnnoiseManager } from '../rnnoise-manager';
import { audioTelemetry } from '../telemetry';

export class BrowserAudioStrategy implements AudioPipelineStrategy {
  readonly platform = 'browser' as const;
  private rnnoiseManager: RnnoiseManager;

  constructor() {
    this.rnnoiseManager = new RnnoiseManager('browser');
  }

  async applyMode(
    mode: AudioMode,
    room: Room,
  ): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: NoiseFilterError | WorkletInitError | null;
  }> {
    switch (mode) {
      case 'raw':
        return this.applyRaw(room);
      case 'standard':
        return this.applyStandard(room);
      case 'enhanced':
        return this.applyEnhanced(room);
    }
  }

  async removeProcessors(room: Room): Promise<void> {
    await this.rnnoiseManager.removeFromTrack(room);
  }

  dispose(): void {
    this.rnnoiseManager.dispose();
  }

  // --- RNNoise support check (delegated) ---

  async checkRnnoiseSupport(): Promise<boolean> {
    return this.rnnoiseManager.checkSupport();
  }

  getRnnoiseManager(): RnnoiseManager {
    return this.rnnoiseManager;
  }

  // --- Private mode implementations ---

  private async applyRaw(room: Room): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: NoiseFilterError | WorkletInitError | null;
  }> {
    // Remove any processor
    await this.rnnoiseManager.removeFromTrack(room);

    // Apply raw constraints
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (micPub?.track) {
      const constraints = buildRuntimeConstraints('browser', 'raw');
      await micPub.track.mediaStreamTrack.applyConstraints(constraints).catch(() => {});
    }

    return { activeMode: 'raw', degraded: false, reason: null, errorCode: null };
  }

  private async applyStandard(room: Room): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: NoiseFilterError | WorkletInitError | null;
  }> {
    // Remove any processor
    await this.rnnoiseManager.removeFromTrack(room);

    // Apply standard constraints
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (micPub?.track) {
      const constraints = buildRuntimeConstraints('browser', 'standard');
      await micPub.track.mediaStreamTrack.applyConstraints(constraints).catch(() => {});

      // Verify constraints were applied
      const verification = verifyAppliedConstraints(micPub.track.mediaStreamTrack, constraints);
      if (!verification.matches) {
        audioTelemetry.log({
          type: 'constraint_verify',
          platform: 'browser',
          reason: 'Browser Standard constraints partially rejected',
          data: { mismatches: verification.mismatches },
        });
      }
    }

    return { activeMode: 'standard', degraded: false, reason: null, errorCode: null };
  }

  private async applyEnhanced(room: Room): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: NoiseFilterError | WorkletInitError | null;
  }> {
    // Try RNNoise
    const success = await this.rnnoiseManager.applyToTrack(room);

    if (success) {
      return { activeMode: 'enhanced', degraded: false, reason: null, errorCode: null };
    }

    // RNNoise failed — fallback to Standard with track republish
    const failure = this.rnnoiseManager.getLastFailure();
    const reason = failure?.message ?? 'Noise filter unavailable';
    const errorCode = failure?.code ?? NoiseFilterError.UNKNOWN;

    audioTelemetry.log({
      type: 'transition',
      platform: 'browser',
      from: 'APPLYING',
      to: 'DEGRADED',
      reason: `Enhanced → Standard fallback: ${reason}`,
      errorCode,
    });

    // Republish mic track with Standard constraints (NS=true)
    // Cannot toggle noiseSuppression via applyConstraints() — must re-capture
    const constraints = buildCaptureConstraints('browser', 'standard');
    await room.localParticipant.setMicrophoneEnabled(false);
    await room.localParticipant.setMicrophoneEnabled(true, {
      echoCancellation: constraints.echoCancellation,
      noiseSuppression: constraints.noiseSuppression,
      autoGainControl: constraints.autoGainControl,
    });

    return {
      activeMode: 'standard',
      degraded: true,
      reason,
      errorCode,
    };
  }
}
