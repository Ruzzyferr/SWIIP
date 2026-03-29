'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*';

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
  duration = 1500,
  trigger = true,
  as: Tag = 'span',
}: TextRevealProps) {
  const [displayText, setDisplayText] = useState(text);
  const [started, setStarted] = useState(false);
  const frameRef = useRef<number>(0);

  const scramble = useCallback(() => {
    const totalFrames = Math.floor(duration / 16);
    const chars = text.split('');
    let frame = 0;

    const animate = () => {
      frame++;
      const progress = frame / totalFrames;

      const result = chars.map((char, i) => {
        if (char === ' ') return ' ';
        const charProgress = i / chars.length;
        if (progress > charProgress + 0.3) return char;
        if (progress > charProgress) {
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      });

      setDisplayText(result.join(''));

      if (frame < totalFrames) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayText(text);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  }, [text, duration]);

  useEffect(() => {
    if (!trigger || started) return;

    const timeout = setTimeout(() => {
      setStarted(true);
      scramble();
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [trigger, delay, scramble, started]);

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
            className={char !== text[i] ? 'text-decode-char' : ''}
            style={{
              color: char !== text[i] ? 'var(--color-accent-primary)' : 'inherit',
              transition: 'color 0.1s',
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
