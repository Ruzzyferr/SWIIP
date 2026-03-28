'use client';

import { createContext, useContext, type MutableRefObject } from 'react';
import type { VideoTrackMap } from '@/hooks/useLiveKitRoom';

interface LiveKitContextValue {
  videoTracks: VideoTrackMap;
  roomRef: MutableRefObject<any | null> | null;
}

export const LiveKitContext = createContext<LiveKitContextValue>({
  videoTracks: {},
  roomRef: null,
});

export function useLiveKitContext() {
  return useContext(LiveKitContext);
}
