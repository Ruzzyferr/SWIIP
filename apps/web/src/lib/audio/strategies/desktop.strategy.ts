/**
 * DesktopAudioStrategy — handles audio modes in Electron desktop context.
 *
 * - Standard: browser constraints (EC+NS+AGC) + AudioWorklet DSP (HPF + limiter)
 * - Enhanced: RNNoise processor. On fail → republish track with Desktop Standard.
 * - Raw: bypass worklet, all processing off.
 */

import { Track, type Room } from 'livekit-client';
import type { AudioPipelineStrategy, AudioMode } from '../types';
import { NoiseFilterError, WorkletInitError } from '../types';
import { buildCaptureConstraints, buildRuntimeConstraints, verifyAppliedConstraints } from '../constraints';
import { RnnoiseManager } from '../rnnoise-manager';
import { DesktopWorkletManager } from '../desktop-worklet-manager';
import { audioTelemetry } from '../telemetry';

export class DesktopAudioStrategy implements AudioPipelineStrategy {
  readonly platform = 'desktop' as const;
  private rnnoiseManager: RnnoiseManager;
  private workletManager: DesktopWorkletManager;

  constructor() {
    this.rnnoiseManager = new RnnoiseManager('desktop');
    this.workletManager = new DesktopWorkletManager('desktop');
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

  setInputGain(normalized: number): void {
    this.rnnoiseManager.setInputGain(normalized);
  }

  dispose(): void {
    this.rnnoiseManager.dispose();
    this.workletManager.dispose();
  }

  getRnnoiseManager(): RnnoiseManager {
    return this.rnnoiseManager;
  }

  getWorkletManager(): DesktopWorkletManager {
    return this.workletManager;
  }

  private async applyRaw(room: Room): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: NoiseFilterError | WorkletInitError | null;
  }> {
    await this.rnnoiseManager.removeFromTrack(room);

    if (this.workletManager.getState() === 'active') {
      this.workletManager.bypass(true);
    }

    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (micPub?.track) {
      const constraints = buildRuntimeConstraints('desktop', 'raw');
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
    await this.rnnoiseManager.removeFromTrack(room);

    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (!micPub?.track) {
      return { activeMode: 'standard', degraded: false, reason: null, errorCode: null };
    }

    const constraints = buildRuntimeConstraints('desktop', 'standard');
    await micPub.track.mediaStreamTrack.applyConstraints(constraints).catch(() => {});

    const verification = verifyAppliedConstraints(micPub.track.mediaStreamTrack, constraints);
    if (!verification.matches) {
      audioTelemetry.log({
        type: 'constraint_verify',
        platform: 'desktop',
        reason: 'Desktop Standard constraints partially rejected',
        data: { mismatches: verification.mismatches },
      });
    }

    const workletOk = await this.applyWorkletChain(room);

    if (!workletOk) {
      audioTelemetry.log({
        type: 'transition',
        platform: 'desktop',
        reason: 'Desktop Standard worklet failed, using browser constraints only',
        errorCode: this.workletManager.getLastFailure()?.code,
      });
    }

    return { activeMode: 'standard', degraded: false, reason: null, errorCode: null };
  }

  private async applyEnhanced(room: Room): Promise<{
    activeMode: AudioMode;
    degraded: boolean;
    reason: string | null;
    errorCode: NoiseFilterError | WorkletInitError | null;
  }> {
    if (this.workletManager.getState() === 'bypassed') {
      this.workletManager.bypass(false);
    }

    const success = await this.rnnoiseManager.applyToTrack(room);

    if (success) {
      return { activeMode: 'enhanced', degraded: false, reason: null, errorCode: null };
    }

    // RNNoise failed — fallback to Desktop Standard with track republish
    const failure = this.rnnoiseManager.getLastFailure();
    const reason = failure?.message ?? 'Noise filter unavailable';
    const errorCode = failure?.code ?? NoiseFilterError.UNKNOWN;

    audioTelemetry.log({
      type: 'transition',
      platform: 'desktop',
      from: 'APPLYING',
      to: 'DEGRADED',
      reason: 'Enhanced -> Desktop Standard fallback: ' + reason,
      errorCode,
    });

    // Republish mic track with Standard constraints (NS=true)
    const constraints = buildCaptureConstraints('desktop', 'standard');
    await room.localParticipant.setMicrophoneEnabled(false);
    await room.localParticipant.setMicrophoneEnabled(true, {
      echoCancellation: constraints.echoCancellation,
      noiseSuppression: constraints.noiseSuppression,
      autoGainControl: constraints.autoGainControl,
    });

    await this.applyStandard(room);

    return {
      activeMode: 'standard',
      degraded: true,
      reason,
      errorCode,
    };
  }

  private async applyWorkletChain(room: Room): Promise<boolean> {
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (!micPub?.track) return false;

    const rawTrack = micPub.track.mediaStreamTrack;
    const rawStream = new MediaStream([rawTrack]);

    const processedStream = await this.workletManager.createChain(rawStream);
    if (!processedStream) return false;

    try {
      const processedTrack = processedStream.getAudioTracks()[0];
      if (!processedTrack) return false;

      // Use LiveKit's sender to replace the track
      const sender = (micPub.track as any).sender as RTCRtpSender | undefined;
      if (sender) {
        await sender.replaceTrack(processedTrack);
      }

      return true;
    } catch (err) {
      audioTelemetry.log({
        type: 'error',
        platform: 'desktop',
        errorCode: WorkletInitError.REPLACE_TRACK_FAILED,
        errorMessage: 'Failed to replace track with processed audio',
        data: {
          error: err instanceof Error ? err.message : String(err),
        },
      });
      return false;
    }
  }
}
