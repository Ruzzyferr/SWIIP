'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  trigger?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export function TextReveal({
  text,
  className = '',
  delay = 0,
  duration = 1200,
  trigger = true,
  as: Tag = 'span',
}: TextRevealProps) {
  // Start by showing the real text — only scramble once animation actually begins
  const [displayText, setDisplayText] = useState(text);
  const [animating, setAnimating] = useState(false);
  const frameRef = useRef<number>(0);
  const startedRef = useRef(false);

  // Keep displayText in sync if text prop changes before animation
  useEffect(() => {
    if (!startedRef.current) {
      setDisplayText(text);
    }
  }, [text]);

  const scramble = useCallback(() => {
    const totalFrames = Math.floor(duration / 16);
    const chars = text.split('');
    let frame = 0;
    setAnimating(true);

    const animate = () => {
      frame++;
      const progress = frame / totalFrames;

      const result = chars.map((char, i) => {
        if (char === ' ') return ' ';
        const charProgress = i / chars.length;
        // Character has fully resolved
        if (progress > charProgress + 0.3) return char;
        // Character is currently scrambling
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      });

      setDisplayText(result.join(''));

      if (frame < totalFrames) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure final text is always the real text
        setDisplayText(text);
        setAnimating(false);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  }, [text, duration]);

  useEffect(() => {
    if (!trigger || startedRef.current) return;

    const timeout = setTimeout(() => {
      startedRef.current = true;
      scramble();
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        // If cleanup runs mid-animation, show the real text instead of garbled
        setDisplayText(text);
        setAnimating(false);
      }
    };
  }, [trigger, delay, scramble]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={trigger ? { opacity: 1 } : {}}
      transition={{ duration: 0.3, delay: delay / 1000 }}
    >
      <Tag className={className}>
        {displayText.split('').map((char, i) => (
          <span
            key={i}
            style={{
              color: animating && char !== text[i] ? 'var(--color-accent-primary)' : 'inherit',
              transition: 'color 0.15s ease',
            }}
          >
            {char}
          </span>
        ))}
      </Tag>
    </motion.span>
  );
}

/* Word-by-word stagger variant */
interface WordStaggerProps {
  text: string;
  className?: string;
  delay?: number;
  wordDelay?: number;
}

export function WordStagger({
  text,
  className = '',
  delay = 0,
  wordDelay = 0.08,
}: WordStaggerProps) {
  const words = text.split(' ');

  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            delay: delay + i * wordDelay,
          }}
        >
          {word}
          {i < words.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </span>
  );
}
