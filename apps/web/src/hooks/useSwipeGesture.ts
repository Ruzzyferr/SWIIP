'use client';

import { useRef, useCallback, useEffect } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // minimum px to register as swipe
  enabled?: boolean;
}

/**
 * Touch swipe gesture detection hook (mobile navigation).
 * Attach the returned handlers to the container element.
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
  enabled = true,
}: SwipeOptions) {
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      if (touch) {
        startX.current = touch.clientX;
        startY.current = touch.clientY;
      }
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent | TouchEvent) => {
      if (!enabled) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;

      // Only register horizontal swipes (ignore vertical scrolling)
      if (Math.abs(dx) < threshold || Math.abs(dy) > Math.abs(dx)) return;

      if (dx > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    },
    [enabled, threshold, onSwipeLeft, onSwipeRight]
  );

  return { onTouchStart, onTouchEnd };
}
