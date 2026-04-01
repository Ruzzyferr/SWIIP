import type { UserPayload } from '@constchat/protocol';

export type RelationshipType = 'FRIEND' | 'BLOCKED' | 'PENDING_OUTGOING' | 'PENDING_INCOMING';

export interface RelationshipPayload {
  id: string;
  type: RelationshipType;
  user: UserPayload;
  since: string;
}

/**
 * Audio pipeline types — simplified for mobile (no RNNoise/Worklet).
 * Full types live in apps/web/src/lib/audio/types.ts
 */
export type AudioPlatform = 'browser' | 'desktop' | 'mobile';
export type AudioMode = 'standard' | 'enhanced' | 'raw';
export type PipelineState = 'IDLE' | 'PROBING' | 'APPLYING' | 'ACTIVE' | 'DEGRADED' | 'FAILED';

export interface AudioPipelineUIState {
  requestedMode: AudioMode;
  activeMode: AudioMode;
  isDegraded: boolean;
  degradedReason: string | null;
  degradedErrorCode: string | null;
  supportDetection: {
    rnnoise: 'supported' | 'unsupported' | 'unchecked' | 'checking';
    worklet: 'supported' | 'unsupported' | 'unchecked';
    platform: AudioPlatform;
  };
  processorStatus: {
    rnnoise: 'idle' | 'loading' | 'active' | 'failed' | 'removed';
    worklet: 'idle' | 'loading' | 'active' | 'failed' | 'bypassed';
  };
  latency: {
    workletMs: number | null;
    withinBudget: boolean;
  };
  pipelineState: PipelineState;
}

export function createDefaultPipelineUIState(
  platform: AudioPlatform,
  requestedMode: AudioMode,
): AudioPipelineUIState {
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
