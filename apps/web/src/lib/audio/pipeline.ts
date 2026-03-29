/**
 * AudioPipeline — state machine orchestrator for the audio processing pipeline.
 *
 * Serializes mode transitions via promise chain to prevent race conditions.
 * Manages the lifecycle: probe → apply → active/degraded → dispose.
 */

import { RoomEvent, type Room } from 'livekit-client';
import type {
  AudioMode,
  AudioPlatform,
  AudioPipelineStrategy,
  AudioPipelineUIState,
  PipelineState,
} from './types';
import { createDefaultPipelineUIState } from './types';
import { buildCaptureConstraints, requiresRepublish } from './constraints';
import { audioTelemetry } from './telemetry';

export type PipelineTransitionCallback = (state: AudioPipelineUIState) => void;

export class AudioPipeline {
  private platform: AudioPlatform;
  private strategy: AudioPipelineStrategy;
  private uiState: AudioPipelineUIState;
  private room: Room | null = null;
  private transitionChain: Promise<void> = Promise.resolve();
  private subscribers = new Set<PipelineTransitionCallback>();
  private reconnectCleanup: (() => void) | null = null;
  private disposed = false;

  constructor(platform: AudioPlatform, strategy: AudioPipelineStrategy) {
    this.platform = platform;
    this.strategy = strategy;
    this.uiState = createDefaultPipelineUIState(platform, 'standard');
  }

  /**
   * Get current UI state snapshot.
   */
  getUIState(): AudioPipelineUIState {
    return { ...this.uiState };
  }

  /**
   * Subscribe to state transitions. Returns unsubscribe function.
   */
  onTransition(callback: PipelineTransitionCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Apply audio pipeline to a connected Room.
   * Enables mic with correct constraints and applies processor for the given mode.
   * Serialized through transitionChain to prevent races with requestMode().
   */
  async applyToRoom(room: Room, mode: AudioMode): Promise<void> {
    if (this.disposed) return;

    this.room = room;

    // Serialize through the transition chain so requestMode() calls
    // that arrive during applyToRoom wait their turn.
    this.transitionChain = this.transitionChain.then(async () => {
      if (this.disposed) return;

      this.updateState({ requestedMode: mode, pipelineState: 'PROBING' });

      // Enable mic with initial constraints
      const constraints = buildCaptureConstraints(this.platform, mode);
      await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: constraints.echoCancellation,
        noiseSuppression: constraints.noiseSuppression,
        autoGainControl: constraints.autoGainControl,
      });

      // Apply mode (processor, constraints, etc.)
      await this.applyModeInternal(mode);
    }).catch((err) => {
      console.error('[AudioPipeline] applyToRoom failed:', err);
      this.updateState({ pipelineState: 'FAILED' });
    });

    // Listen for reconnects
    this.setupReconnectHandler(room);

    // Await the chain so the caller knows when it's done
    await this.transitionChain;
  }

  /**
   * Request a mode change. Serialized — safe to call from UI rapidly.
   */
  requestMode(mode: AudioMode): void {
    if (this.disposed) return;

    this.transitionChain = this.transitionChain.then(async () => {
      if (this.disposed || !this.room) return;

      const currentMode = this.uiState.activeMode;

      // Check if EC change requires republish
      if (requiresRepublish(this.platform, currentMode, mode)) {
        // Need to republish mic — can't change EC mid-track
        this.updateState({ requestedMode: mode, pipelineState: 'APPLYING' });

        await this.strategy.removeProcessors(this.room);

        const constraints = buildCaptureConstraints(this.platform, mode);
        // Disable then re-enable mic with new constraints
        await this.room.localParticipant.setMicrophoneEnabled(false);
        await this.room.localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: constraints.echoCancellation,
          noiseSuppression: constraints.noiseSuppression,
          autoGainControl: constraints.autoGainControl,
        });
      } else {
        this.updateState({ requestedMode: mode, pipelineState: 'APPLYING' });
      }

      await this.applyModeInternal(mode);
    }).catch((err) => {
      console.error('[AudioPipeline] Mode transition failed:', err);
      this.updateState({ pipelineState: 'FAILED' });
    });
  }

  /**
   * Handle reconnect — reset processor state, re-apply current mode.
   */
  async handleReconnect(): Promise<void> {
    if (this.disposed || !this.room) return;

    const mode = this.uiState.requestedMode;

    audioTelemetry.log({
      type: 'transition',
      platform: this.platform,
      reason: 'Reconnect detected, re-applying audio mode',
      data: { mode },
    });

    // Wait for track stabilization
    await new Promise((r) => setTimeout(r, 500));

    if (this.disposed || !this.room) return;

    await this.applyModeInternal(mode);
  }

  /**
   * Handle input device change.
   */
  async handleDeviceChange(_deviceId: string): Promise<void> {
    // Device change is handled by LiveKit's setMicrophoneEnabled with new deviceId.
    // After the track changes, we need to re-apply the processor.
    if (this.disposed || !this.room) return;

    const mode = this.uiState.requestedMode;

    audioTelemetry.log({
      type: 'transition',
      platform: this.platform,
      reason: 'Device change detected, re-applying audio mode',
      data: { mode },
    });

    // Short delay for new track to stabilize
    await new Promise((r) => setTimeout(r, 200));

    if (this.disposed || !this.room) return;

    await this.applyModeInternal(mode);
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.reconnectCleanup) {
      this.reconnectCleanup();
      this.reconnectCleanup = null;
    }

    if (this.room) {
      this.strategy.removeProcessors(this.room).catch(() => {});
    }

    this.strategy.dispose();
    this.room = null;
    this.subscribers.clear();

    audioTelemetry.log({
      type: 'transition',
      platform: this.platform,
      from: this.uiState.pipelineState,
      to: 'IDLE',
      reason: 'Pipeline disposed',
    });
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async applyModeInternal(mode: AudioMode): Promise<void> {
    if (this.disposed || !this.room) return;

    this.updateState({ pipelineState: 'APPLYING', requestedMode: mode });

    const result = await this.strategy.applyMode(mode, this.room);

    const newState: Partial<AudioPipelineUIState> = {
      activeMode: result.activeMode,
      isDegraded: result.degraded,
      degradedReason: result.reason,
      degradedErrorCode: result.errorCode,
      pipelineState: result.degraded ? 'DEGRADED' : 'ACTIVE',
    };

    // Update processor status based on result
    if (result.activeMode === 'enhanced') {
      newState.processorStatus = {
        ...this.uiState.processorStatus,
        rnnoise: 'active',
      };
    } else if (mode === 'enhanced' && result.degraded) {
      newState.processorStatus = {
        ...this.uiState.processorStatus,
        rnnoise: 'failed',
      };
    } else {
      newState.processorStatus = {
        ...this.uiState.processorStatus,
        rnnoise: 'idle',
      };
    }

    this.updateState(newState);

    audioTelemetry.log({
      type: 'transition',
      platform: this.platform,
      to: result.degraded ? 'DEGRADED' : 'ACTIVE',
      reason: result.degraded
        ? `Degraded: ${result.reason}`
        : `Mode applied: ${result.activeMode}`,
      data: { requestedMode: mode, activeMode: result.activeMode },
    });
  }

  private setupReconnectHandler(room: Room): void {
    const handler = () => {
      // Reset RNNoise manager on reconnect to avoid stale state
      const strategy = this.strategy as any;
      if (typeof strategy.getRnnoiseManager === 'function') {
        strategy.getRnnoiseManager().resetState();
      }
      this.handleReconnect().catch((err) => {
        console.error('[AudioPipeline] Reconnect handler failed:', err);
      });
    };

    room.on(RoomEvent.Reconnected, handler);
    this.reconnectCleanup = () => {
      room.off(RoomEvent.Reconnected, handler);
    };
  }

  private updateState(patch: Partial<AudioPipelineUIState>): void {
    this.uiState = { ...this.uiState, ...patch };

    // Notify subscribers
    const snapshot = { ...this.uiState };
    for (const sub of this.subscribers) {
      try {
        sub(snapshot);
      } catch {
        // Don't let subscriber errors break the pipeline
      }
    }
  }
}
