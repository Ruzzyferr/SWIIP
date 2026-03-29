/**
 * BrowserAudioStrategy — handles audio modes in browser context.
 *
 * - Standard: browser WebRTC constraints (EC+NS+AGC)
 * - Enhanced: Krisp processor. On fail → Standard fallback.
 * - Raw: all processing off.
 */

import { Track, type Room } from 'livekit-client';
import type { AudioPipelineStrategy, AudioMode } from '../types';
import { KrispInitError, WorkletInitError } from '../types';
import { buildRuntimeConstraints, verifyAppliedConstraints } from '../constraints';
import { KrispManager } from '../krisp-manager';
import { audioTelemetry } from '../telemetry';

export class BrowserAudioStrategy implements AudioPipelineStrategy {
  readonly platform = 'browser' as const;
  private krispManager: KrispManager;

  constructor() {
    this.krispManager = new KrispManager('browser');
  }

  async applyMode(
    mode: AudioMode,
    room: Room,
  ): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: KrispInitError | WorkletInitError | null;
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
    await this.krispManager.removeFromTrack(room);
  }

  dispose(): void {
    this.krispManager.dispose();
  }

  // --- Krisp support check (delegated) ---

  async checkKrispSupport(): Promise<boolean> {
    return this.krispManager.checkSupport();
  }

  getKrispManager(): KrispManager {
    return this.krispManager;
  }

  // --- Private mode implementations ---

  private async applyRaw(room: Room): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: KrispInitError | WorkletInitError | null;
  }> {
    // Remove any processor
    await this.krispManager.removeFromTrack(room);

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
    errorCode: KrispInitError | WorkletInitError | null;
  }> {
    // Remove any processor
    await this.krispManager.removeFromTrack(room);

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
    errorCode: KrispInitError | WorkletInitError | null;
  }> {
    // Try Krisp
    const success = await this.krispManager.applyToTrack(room);

    if (success) {
      return { activeMode: 'enhanced', degraded: false, reason: null, errorCode: null };
    }

    // Krisp failed — fallback to Browser Standard
    const failure = this.krispManager.getLastFailure();
    const reason = failure?.message ?? 'Krisp unavailable';
    const errorCode = failure?.code ?? KrispInitError.UNKNOWN;

    audioTelemetry.log({
      type: 'transition',
      platform: 'browser',
      from: 'APPLYING',
      to: 'DEGRADED',
      reason: `Enhanced → Standard fallback: ${reason}`,
      errorCode,
    });

    // Apply standard as fallback
    await this.applyStandard(room);

    return {
      activeMode: 'standard',
      degraded: true,
      reason,
      errorCode,
    };
  }
}
