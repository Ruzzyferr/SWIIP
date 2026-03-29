'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  type MotionValue,
} from 'framer-motion';

// ---------------------------------------------------------------------------
// useMagneticHover
// ---------------------------------------------------------------------------

interface MagneticHoverResult<T extends HTMLElement = HTMLElement> {
  ref: React.RefObject<T | null>;
  style: { x: MotionValue<number>; y: MotionValue<number> };
  onMouseMove: (e: React.MouseEvent<T>) => void;
  onMouseLeave: () => void;
}

export function useMagneticHover<T extends HTMLElement = HTMLDivElement>(
  strength = 0.3,
): MagneticHoverResult<T> {
  const ref = useRef<T>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 });

  const onMouseMove = useCallback(
    (e: React.MouseEvent<T>) => {
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const offsetX = (e.clientX - centerX) * strength;
      const offsetY = (e.clientY - centerY) * strength;

      x.set(offsetX);
      y.set(offsetY);
    },
    [strength, x, y],
  );

  const onMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return {
    ref,
    style: { x: springX, y: springY },
    onMouseMove,
    onMouseLeave,
  };
}

// ---------------------------------------------------------------------------
// useParallax
// ---------------------------------------------------------------------------

interface ParallaxResult<T extends HTMLElement = HTMLElement> {
  ref: React.RefObject<T | null>;
  y: MotionValue<number>;
}

export function useParallax<T extends HTMLElement = HTMLDivElement>(
  speed = 0.1,
): ParallaxResult<T> {
  const ref = useRef<T>(null);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, (value) => value * speed);

  return { ref, y };
}

// ---------------------------------------------------------------------------
// useTilt3D
// ---------------------------------------------------------------------------

interface Tilt3DResult<T extends HTMLElement = HTMLElement> {
  ref: React.RefObject<T | null>;
  style: {
    rotateX: MotionValue<number>;
    rotateY: MotionValue<number>;
    perspective: number;
  };
  onMouseMove: (e: React.MouseEvent<T>) => void;
  onMouseLeave: () => void;
}

export function useTilt3D<T extends HTMLElement = HTMLDivElement>(
  maxTilt = 10,
): Tilt3DResult<T> {
  const ref = useRef<T>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springRotateX = useSpring(rotateX, {
    stiffness: 260,
    damping: 20,
    mass: 0.5,
  });
  const springRotateY = useSpring(rotateY, {
    stiffness: 260,
    damping: 20,
    mass: 0.5,
  });

  const onMouseMove = useCallback(
    (e: React.MouseEvent<T>) => {
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const normalizedX = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const normalizedY = (e.clientY - rect.top) / rect.height - 0.5;

      // Invert Y so tilting up when cursor is at top
      rotateX.set(-normalizedY * maxTilt);
      rotateY.set(normalizedX * maxTilt);
    },
    [maxTilt, rotateX, rotateY],
  );

  const onMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return {
    ref,
    style: {
      rotateX: springRotateX,
      rotateY: springRotateY,
      perspective: 800,
    },
    onMouseMove,
    onMouseLeave,
  };
}

// ---------------------------------------------------------------------------
// useTextReveal
// ---------------------------------------------------------------------------

const REVEAL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*';
const REVEAL_DURATION_MS = 1500;
const CYCLES_PER_CHAR = 6;

interface TextRevealResult {
  text: string;
  trigger: (originalText: string) => void;
}

export function useTextReveal(): TextRevealResult {
  const [text, setText] = useState('');
  const frameRef = useRef<number | null>(null);

  const trigger = useCallback((originalText: string) => {
    // Cancel any running animation
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const chars = originalText.split('');
    const totalChars = chars.length;
    if (totalChars === 0) {
      setText('');
      return;
    }

    const intervalPerChar = REVEAL_DURATION_MS / totalChars;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / REVEAL_DURATION_MS, 1);

      // Number of characters fully resolved
      const resolvedCount = Math.floor(progress * totalChars);

      const display = chars.map((char, i) => {
        if (char === ' ') return ' ';
        if (i < resolvedCount) return char;

        // Still cycling — pick a random character
        const charElapsed = elapsed - i * intervalPerChar;
        if (charElapsed <= 0) return REVEAL_CHARS[Math.floor(Math.random() * REVEAL_CHARS.length)];

        const cycle = Math.floor(charElapsed / (intervalPerChar / CYCLES_PER_CHAR));
        if (cycle >= CYCLES_PER_CHAR) return char;
        return REVEAL_CHARS[Math.floor(Math.random() * REVEAL_CHARS.length)];
      });

      setText(display.join(''));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setText(originalText);
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return { text, trigger };
}

// ---------------------------------------------------------------------------
// useInViewAnimation
// ---------------------------------------------------------------------------

interface InViewAnimationResult<T extends HTMLElement = HTMLElement> {
  ref: React.RefObject<T | null>;
  isInView: boolean;
}

export function useInViewAnimation<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.2,
): InViewAnimationResult<T> {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]: IntersectionObserverEntry[]) => {
        if (entry?.isIntersecting) {
          setIsInView(true);
          // One-shot — disconnect after first trigger
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return { ref, isInView };
}
