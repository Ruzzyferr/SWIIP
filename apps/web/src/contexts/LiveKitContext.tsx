'use client';

import { createContext, useContext } from 'react';
import type { VideoTrackMap } from '@/hooks/useLiveKitRoom';

interface LiveKitContextValue {
  videoTracks: VideoTrackMap;
}

export const LiveKitContext = createContext<LiveKitContextValue>({
  videoTracks: {},
});

export function useLiveKitContext() {
  return useContext(LiveKitContext);
}
