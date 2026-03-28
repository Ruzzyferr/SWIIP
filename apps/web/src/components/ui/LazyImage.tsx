'use client';

import { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  loading?: 'lazy' | 'eager';
}

/**
 * Image component with a shimmer placeholder while loading.
 * Uses IntersectionObserver for true lazy loading and shows
 * a pulsing gradient placeholder until the image is decoded.
 */
export function LazyImage({ src, alt, className = '', style, onClick, loading = 'lazy' }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(loading === 'eager');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading === 'eager' || !containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={style}>
      {/* Shimmer placeholder */}
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: 'linear-gradient(135deg, var(--color-surface-raised) 0%, var(--color-surface-overlay) 50%, var(--color-surface-raised) 100%)',
            backgroundSize: '200% 200%',
          }}
        />
      )}

      {/* Actual image */}
      {inView && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onClick={onClick}
          style={{ cursor: onClick ? 'pointer' : undefined }}
        />
      )}
    </div>
  );
}
