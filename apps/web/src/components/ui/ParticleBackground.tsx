'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ParticleBackgroundProps {
  particleCount?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

const EMERALD_COLORS = ['#10B981', '#34D399', '#6EE7B7'];
const CONNECTION_DISTANCE = 150;
const MAX_CONNECTIONS = 5;
const MOUSE_RADIUS = 200;
const REPULSION_STRENGTH = 0.8;

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randomRange(-0.3, 0.3),
    vy: randomRange(-0.3, 0.3),
    radius: randomRange(1, 3),
    opacity: randomRange(0.3, 0.8),
    color: EMERALD_COLORS[Math.floor(Math.random() * EMERALD_COLORS.length)]!,
  };
}

export function ParticleBackground({
  particleCount,
  className = '',
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const isMobileRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  const getParticleCount = useCallback(
    (width: number) => {
      if (particleCount !== undefined) return particleCount;
      return width < 768 ? 30 : 80;
    },
    [particleCount]
  );

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    dimensionsRef.current = { width, height };
    isMobileRef.current = width < 768;

    const count = getParticleCount(width);
    const existing = particlesRef.current;

    if (existing.length > count) {
      particlesRef.current = existing.slice(0, count);
    } else {
      while (particlesRef.current.length < count) {
        particlesRef.current.push(createParticle(width, height));
      }
    }

    // Clamp particles into new bounds
    for (const p of particlesRef.current) {
      if (p.x > width) p.x = Math.random() * width;
      if (p.y > height) p.y = Math.random() * height;
    }
  }, [getParticleCount]);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    initCanvas();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- Mouse tracking ---
    const handleMouseMove = (e: MouseEvent) => {
      if (isMobileRef.current) return;
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // --- Resize with debounce ---
    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(initCanvas, 200);
    };
    window.addEventListener('resize', handleResize);

    // --- Visibility change ---
    const handleVisibility = () => {
      if (!document.hidden && !reducedMotionRef.current) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // --- Animation loop ---
    function animate() {
      if (document.hidden) return;

      const { width, height } = dimensionsRef.current;
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      ctx!.clearRect(0, 0, width, height);

      // Update positions
      if (!reducedMotionRef.current) {
        for (const p of particles) {
          // Mouse repulsion
          if (mouse) {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_RADIUS && dist > 0) {
              const force =
                ((MOUSE_RADIUS - dist) / MOUSE_RADIUS) * REPULSION_STRENGTH;
              p.vx += (dx / dist) * force * 0.05;
              p.vy += (dy / dist) * force * 0.05;
            }
          }

          // Dampen velocity to keep drift slow
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > 0.4) {
            p.vx *= 0.98;
            p.vy *= 0.98;
          }

          p.x += p.vx;
          p.y += p.vy;

          // Toroidal wrap
          if (p.x < 0) p.x += width;
          if (p.x > width) p.x -= width;
          if (p.y < 0) p.y += height;
          if (p.y > height) p.y -= height;
        }
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        let connections = 0;
        for (let j = i + 1; j < particles.length; j++) {
          if (connections >= MAX_CONNECTIONS) break;

          const pi = particles[i]!;
          const pj = particles[j]!;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = 0.1 * (1 - dist / CONNECTION_DISTANCE);
            ctx!.beginPath();
            ctx!.moveTo(pi.x, pi.y);
            ctx!.lineTo(pj.x, pj.y);
            ctx!.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
            connections++;
          }
        }
      }

      // Draw cursor glow
      if (mouse && !isMobileRef.current) {
        const gradient = ctx!.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          MOUSE_RADIUS
        );
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.06)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(mouse.x, mouse.y, MOUSE_RADIUS, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Draw particles
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.opacity;
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }

      if (!reducedMotionRef.current) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationRef.current);
      clearTimeout(resizeTimer);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [initCanvas]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        willChange: 'transform',
      }}
    />
  );
}
