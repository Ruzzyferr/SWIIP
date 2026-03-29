'use client';

import { useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface AmbientColors {
  primary: string;
  primaryMuted: string;
  primarySubtle: string;
  glow: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_EMERALD: RGB = { r: 16, g: 185, b: 129 }; // #10B981
const DEBOUNCE_MS = 300;
const TRANSITION_MS = 600;
const BUCKET_SIZE = 32; // color quantization bucket size

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rgbToString({ r, g, b }: RGB, alpha?: number): string {
  if (alpha !== undefined) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function buildAmbientColors(color: RGB): AmbientColors {
  return {
    primary: rgbToString(color),
    primaryMuted: rgbToString(color, 0.15),
    primarySubtle: rgbToString(color, 0.08),
    glow: `0 0 30px ${rgbToString(color, 0.2)}`,
  };
}

function bucketKey({ r, g, b }: RGB): string {
  const br = Math.floor(r / BUCKET_SIZE) * BUCKET_SIZE;
  const bg = Math.floor(g / BUCKET_SIZE) * BUCKET_SIZE;
  const bb = Math.floor(b / BUCKET_SIZE) * BUCKET_SIZE;
  return `${br},${bg},${bb}`;
}

/**
 * Extracts the dominant color from an image URL using an offscreen canvas.
 * Samples every 4th pixel and uses a simple color-bucketing algorithm.
 */
function extractDominantColor(imageUrl: string): Promise<RGB> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64; // downsample for performance
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_EMERALD);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        const buckets = new Map<string, { color: RGB; count: number }>();

        // Sample every 4th pixel (stride = 16 bytes since each pixel is 4 bytes)
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i]!;
          const g = data[i + 1]!;
          const b = data[i + 2]!;
          const a = data[i + 3]!;

          // Skip transparent or near-transparent pixels
          if (a < 128) continue;

          // Skip very dark or very bright pixels (likely background)
          const brightness = (r + g + b) / 3;
          if (brightness < 20 || brightness > 240) continue;

          const pixel: RGB = { r, g, b };
          const key = bucketKey(pixel);

          const existing = buckets.get(key);
          if (existing) {
            existing.count++;
            // Running average for smoother result
            existing.color.r = Math.round(
              (existing.color.r * (existing.count - 1) + r) / existing.count,
            );
            existing.color.g = Math.round(
              (existing.color.g * (existing.count - 1) + g) / existing.count,
            );
            existing.color.b = Math.round(
              (existing.color.b * (existing.count - 1) + b) / existing.count,
            );
          } else {
            buckets.set(key, { color: { r, g, b }, count: 1 });
          }
        }

        if (buckets.size === 0) {
          resolve(DEFAULT_EMERALD);
          return;
        }

        // Find the bucket with the highest count (most dominant)
        let dominant: RGB = DEFAULT_EMERALD;
        let maxCount = 0;

        for (const bucket of buckets.values()) {
          // Weight by saturation to prefer vibrant colors
          const max = Math.max(bucket.color.r, bucket.color.g, bucket.color.b);
          const min = Math.min(bucket.color.r, bucket.color.g, bucket.color.b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const weightedCount = bucket.count * (1 + saturation * 2);

          if (weightedCount > maxCount) {
            maxCount = weightedCount;
            dominant = bucket.color;
          }
        }

        resolve(dominant);
      } catch {
        resolve(DEFAULT_EMERALD);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_EMERALD);
    };

    img.src = imageUrl;
  });
}

function applyAmbientVars(colors: AmbientColors): void {
  const root = document.documentElement;

  // Enable smooth transition for the custom properties
  root.style.transition = [
    '--ambient-primary',
    '--ambient-primary-muted',
    '--ambient-primary-subtle',
    '--ambient-glow',
  ]
    .map((prop) => `${prop} ${TRANSITION_MS}ms ease`)
    .join(', ');

  root.style.setProperty('--ambient-primary', colors.primary);
  root.style.setProperty('--ambient-primary-muted', colors.primaryMuted);
  root.style.setProperty('--ambient-primary-subtle', colors.primarySubtle);
  root.style.setProperty('--ambient-glow', colors.glow);
}

function resetAmbientVars(): void {
  const colors = buildAmbientColors(DEFAULT_EMERALD);
  applyAmbientVars(colors);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAmbientTheme(imageUrl: string | null | undefined): void {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const updateTheme = useCallback(async (url: string | null | undefined) => {
    if (!url) {
      const fallback = buildAmbientColors(DEFAULT_EMERALD);
      applyAmbientVars(fallback);
      return;
    }

    try {
      const dominant = await extractDominantColor(url);
      if (!isMounted.current) return;
      const colors = buildAmbientColors(dominant);
      applyAmbientVars(colors);
    } catch {
      if (!isMounted.current) return;
      const fallback = buildAmbientColors(DEFAULT_EMERALD);
      applyAmbientVars(fallback);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    // Debounce image URL changes
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      updateTheme(imageUrl);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [imageUrl, updateTheme]);

  // Cleanup on unmount — reset to default emerald
  useEffect(() => {
    return () => {
      isMounted.current = false;
      resetAmbientVars();
    };
  }, []);
}
