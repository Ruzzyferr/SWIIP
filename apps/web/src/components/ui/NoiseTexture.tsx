'use client';

/**
 * SVG-based noise texture overlay.
 * Apply as a child of any container to add tactile warmth.
 * Uses feTurbulence for performant, resolution-independent noise.
 */
export function NoiseTexture({
  opacity = 0.03,
  className = '',
}: {
  opacity?: number;
  className?: string;
}) {
  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity, mixBlendMode: 'overlay', zIndex: 1 }}
      aria-hidden="true"
    >
      <filter id="swiip-noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="4"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#swiip-noise)" />
    </svg>
  );
}
