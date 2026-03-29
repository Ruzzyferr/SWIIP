/**
 * Canvas-based dominant color extraction for Ambient Adaptive Theming.
 * Extracts the most prominent color from a server icon to tint the entire UI.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface AmbientColors {
  primary: string;
  rgb: string;
  muted: string;
  subtle: string;
  glow: string;
}

const DEFAULT_EMERALD: AmbientColors = {
  primary: '#10B981',
  rgb: '16, 185, 129',
  muted: 'rgba(16, 185, 129, 0.15)',
  subtle: 'rgba(16, 185, 129, 0.08)',
  glow: '0 0 30px rgba(16, 185, 129, 0.2)',
};

/**
 * Extract dominant color from an image URL.
 * Uses a small canvas to sample pixels and find the most vibrant color.
 */
export async function extractDominantColor(imageUrl: string): Promise<AmbientColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 32; // Small sample for performance
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_EMERALD);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // Color buckets (simplified k-means)
        const buckets: Map<string, { color: RGB; count: number; saturation: number }> = new Map();

        for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
          const r = data[i]!;
          const g = data[i + 1]!;
          const b = data[i + 2]!;
          const a = data[i + 3]!;

          if (a < 128) continue; // Skip transparent pixels

          // Skip very dark or very light pixels (not useful for theming)
          const brightness = (r + g + b) / 3;
          if (brightness < 30 || brightness > 230) continue;

          // Calculate saturation
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;

          // Skip very desaturated colors
          if (saturation < 0.15) continue;

          // Bucket by rounding to nearest 32
          const br = Math.round(r / 32) * 32;
          const bg = Math.round(g / 32) * 32;
          const bb = Math.round(b / 32) * 32;
          const key = `${br},${bg},${bb}`;

          const existing = buckets.get(key);
          if (existing) {
            existing.count++;
            existing.color.r = (existing.color.r + r) / 2;
            existing.color.g = (existing.color.g + g) / 2;
            existing.color.b = (existing.color.b + b) / 2;
          } else {
            buckets.set(key, { color: { r, g, b }, count: 1, saturation });
          }
        }

        if (buckets.size === 0) {
          resolve(DEFAULT_EMERALD);
          return;
        }

        // Find the most prominent saturated color (weighted by count * saturation)
        let best = { color: { r: 16, g: 185, b: 129 }, score: 0 };
        for (const bucket of buckets.values()) {
          const score = bucket.count * (bucket.saturation + 0.5);
          if (score > best.score) {
            best = { color: bucket.color, score };
          }
        }

        const { r, g, b } = best.color;
        const rr = Math.round(r);
        const gg = Math.round(g);
        const bb = Math.round(b);

        resolve({
          primary: `rgb(${rr}, ${gg}, ${bb})`,
          rgb: `${rr}, ${gg}, ${bb}`,
          muted: `rgba(${rr}, ${gg}, ${bb}, 0.15)`,
          subtle: `rgba(${rr}, ${gg}, ${bb}, 0.08)`,
          glow: `0 0 30px rgba(${rr}, ${gg}, ${bb}, 0.2)`,
        });
      } catch {
        resolve(DEFAULT_EMERALD);
      }
    };

    img.onerror = () => resolve(DEFAULT_EMERALD);
    img.src = imageUrl;
  });
}

export { DEFAULT_EMERALD };
export type { AmbientColors };
