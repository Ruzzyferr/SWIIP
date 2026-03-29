'use client';

import { useEffect, useRef } from 'react';

interface MeshGradientProps {
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export function MeshGradient({ className = '', intensity = 'medium' }: MeshGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const opacityMap = { low: 0.4, medium: 0.6, high: 0.8 };
    const baseOpacity = opacityMap[intensity];

    // Gradient orbs configuration
    const orbs = [
      { x: 0.2, y: 0.3, r: 0.5, color: [16, 185, 129], speed: 0.0003, phase: 0 },
      { x: 0.8, y: 0.2, r: 0.45, color: [52, 211, 153], speed: 0.0004, phase: Math.PI * 0.5 },
      { x: 0.5, y: 0.8, r: 0.5, color: [110, 231, 183], speed: 0.00025, phase: Math.PI },
      { x: 0.3, y: 0.6, r: 0.35, color: [5, 150, 105], speed: 0.00035, phase: Math.PI * 1.5 },
    ];

    let time = 0;
    const animate = () => {
      time++;
      ctx.clearRect(0, 0, width, height);

      // Dark base
      ctx.fillStyle = '#090B0B';
      ctx.fillRect(0, 0, width, height);

      // Animate orbs
      for (const orb of orbs) {
        const ox = (orb.x + Math.sin(time * orb.speed + orb.phase) * 0.15) * width;
        const oy = (orb.y + Math.cos(time * orb.speed * 0.7 + orb.phase) * 0.15) * height;
        const or = orb.r * Math.min(width, height);

        const gradient = ctx.createRadialGradient(ox, oy, 0, ox, oy, or);
        gradient.addColorStop(0, `rgba(${orb.color.join(',')}, ${baseOpacity * 0.2})`);
        gradient.addColorStop(0.5, `rgba(${orb.color.join(',')}, ${baseOpacity * 0.08})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      animRef.current = requestAnimationFrame(animate);
    };

    // Check reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      // Draw static frame
      time = 0;
      ctx.fillStyle = '#090B0B';
      ctx.fillRect(0, 0, width, height);
      for (const orb of orbs) {
        const ox = orb.x * width;
        const oy = orb.y * height;
        const or = orb.r * Math.min(width, height);
        const gradient = ctx.createRadialGradient(ox, oy, 0, ox, oy, or);
        gradient.addColorStop(0, `rgba(${orb.color.join(',')}, ${baseOpacity * 0.15})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      animate();
    }

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
