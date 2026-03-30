'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Interactive Owl Mascot
// ---------------------------------------------------------------------------
// - Watches email text as you type (eyes follow cursor position in input)
// - Covers eyes with wings when password field is focused
// - Shakes head on login error
// - Celebrates on success (happy bounce + sparkle eyes)
// - Blinks randomly
// - Eyes follow mouse when idle

type OwlState = 'idle' | 'watching' | 'hiding' | 'error' | 'success';

interface InteractiveOwlProps {
  state: OwlState;
  /** 0-1 representing how far along the email input text is (for eye tracking) */
  watchProgress?: number;
  size?: number;
}

export function InteractiveOwl({
  state,
  watchProgress = 0.5,
  size = 180,
}: InteractiveOwlProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Random blinking
  useEffect(() => {
    if (state === 'hiding') return; // Don't blink while hiding

    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000;
      blinkTimer.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 150);
      }, delay);
    };

    scheduleBlink();
    return () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, [state]);

  // Eye position based on watch progress
  const eyeOffsetX = state === 'watching' ? (watchProgress - 0.5) * 12 : 0;

  // Spring for smooth eye movement
  const springEyeX = useSpring(eyeOffsetX, { stiffness: 300, damping: 25 });

  useEffect(() => {
    springEyeX.set(eyeOffsetX);
  }, [eyeOffsetX, springEyeX]);

  const scale = size / 180;

  return (
    <motion.div
      style={{ width: size, height: size, position: 'relative' }}
      animate={
        state === 'error'
          ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
          : state === 'success'
          ? { y: [0, -12, 0, -8, 0], scale: [1, 1.05, 1, 1.03, 1] }
          : {}
      }
      transition={
        state === 'error'
          ? { duration: 0.5, ease: 'easeInOut' }
          : state === 'success'
          ? { duration: 0.6, ease: 'easeOut' }
          : {}
      }
    >
      <svg
        viewBox="0 0 180 180"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Glow behind owl */}
        <defs>
          <radialGradient id="owlGlow" cx="50%" cy="60%" r="45%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </radialGradient>
          <filter id="owlShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Background glow */}
        <circle cx="90" cy="100" r="70" fill="url(#owlGlow)" />

        {/* Body */}
        <motion.ellipse
          cx="90"
          cy="115"
          rx="45"
          ry="42"
          fill="#1a2332"
          stroke="#10B981"
          strokeWidth="1.5"
          strokeOpacity="0.3"
          filter="url(#owlShadow)"
          animate={state === 'success' ? { fill: '#1a2f2a' } : { fill: '#1a2332' }}
        />

        {/* Belly pattern */}
        <ellipse cx="90" cy="125" rx="25" ry="22" fill="#141c28" opacity="0.6" />
        <ellipse cx="90" cy="128" rx="18" ry="16" fill="#111822" opacity="0.4" />

        {/* Head */}
        <motion.circle
          cx="90"
          cy="72"
          r="38"
          fill="#1e2d3d"
          stroke="#10B981"
          strokeWidth="1"
          strokeOpacity="0.2"
          filter="url(#owlShadow)"
        />

        {/* Ear tufts */}
        <motion.path
          d="M58 52 L52 28 L68 45 Z"
          fill="#1e2d3d"
          stroke="#10B981"
          strokeWidth="1"
          strokeOpacity="0.3"
          animate={state === 'watching' ? { rotate: -5 } : state === 'error' ? { rotate: 5 } : { rotate: 0 }}
          style={{ transformOrigin: '60px 45px' }}
        />
        <motion.path
          d="M122 52 L128 28 L112 45 Z"
          fill="#1e2d3d"
          stroke="#10B981"
          strokeWidth="1"
          strokeOpacity="0.3"
          animate={state === 'watching' ? { rotate: 5 } : state === 'error' ? { rotate: -5 } : { rotate: 0 }}
          style={{ transformOrigin: '120px 45px' }}
        />

        {/* Eye sockets (facial disc) */}
        <circle cx="72" cy="70" r="18" fill="#141e2b" />
        <circle cx="108" cy="70" r="18" fill="#141e2b" />

        {/* Eye rings */}
        <circle cx="72" cy="70" r="16" fill="none" stroke="#10B981" strokeWidth="1.5" strokeOpacity="0.4" />
        <circle cx="108" cy="70" r="16" fill="none" stroke="#10B981" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* Eyes — whites */}
        <motion.ellipse
          cx="72"
          cy="70"
          rx="11"
          ry={isBlinking ? 1 : 11}
          fill="#e8f0e8"
          animate={{ ry: isBlinking ? 1 : 11 }}
          transition={{ duration: 0.08 }}
        />
        <motion.ellipse
          cx="108"
          cy="70"
          rx="11"
          ry={isBlinking ? 1 : 11}
          fill="#e8f0e8"
          animate={{ ry: isBlinking ? 1 : 11 }}
          transition={{ duration: 0.08 }}
        />

        {/* Pupils — follow text or stay centered */}
        {!isBlinking && state !== 'hiding' && (
          <>
            <motion.circle
              cx="72"
              cy="70"
              r="5.5"
              fill="#0a0f18"
              style={{ x: springEyeX }}
              animate={
                state === 'success'
                  ? { fill: '#10B981', r: 4 }
                  : state === 'error'
                  ? { cy: 72 }
                  : {}
              }
            />
            <motion.circle
              cx="108"
              cy="70"
              r="5.5"
              fill="#0a0f18"
              style={{ x: springEyeX }}
              animate={
                state === 'success'
                  ? { fill: '#10B981', r: 4 }
                  : state === 'error'
                  ? { cy: 72 }
                  : {}
              }
            />

            {/* Pupil highlights */}
            <motion.circle
              cx="74"
              cy="67"
              r="2"
              fill="white"
              opacity="0.8"
              style={{ x: springEyeX }}
            />
            <motion.circle
              cx="110"
              cy="67"
              r="2"
              fill="white"
              opacity="0.8"
              style={{ x: springEyeX }}
            />
          </>
        )}

        {/* Success state — star eyes */}
        {state === 'success' && !isBlinking && (
          <>
            <motion.text
              x="72"
              y="75"
              textAnchor="middle"
              fontSize="14"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              ✨
            </motion.text>
            <motion.text
              x="108"
              y="75"
              textAnchor="middle"
              fontSize="14"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.1 }}
            >
              ✨
            </motion.text>
          </>
        )}

        {/* Beak */}
        <motion.path
          d="M86 82 L90 90 L94 82 Z"
          fill="#d4a030"
          stroke="#c49028"
          strokeWidth="0.5"
          animate={
            state === 'success'
              ? { d: 'M84 82 L90 88 L96 82 Z', fill: '#e8b840' }
              : state === 'error'
              ? { fill: '#c48020' }
              : {}
          }
        />

        {/* Wings — cover eyes when hiding (password mode) */}
        <AnimatePresence>
          {state === 'hiding' && (
            <>
              {/* Left wing covering left eye */}
              <motion.path
                d="M40 90 Q50 55, 82 60 Q75 75, 55 90 Z"
                fill="#1a2838"
                stroke="#10B981"
                strokeWidth="1"
                strokeOpacity="0.3"
                initial={{ x: -30, opacity: 0, rotate: -20 }}
                animate={{ x: 0, opacity: 1, rotate: 0 }}
                exit={{ x: -30, opacity: 0, rotate: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ transformOrigin: '55px 90px' }}
              />
              {/* Right wing covering right eye */}
              <motion.path
                d="M140 90 Q130 55, 98 60 Q105 75, 125 90 Z"
                fill="#1a2838"
                stroke="#10B981"
                strokeWidth="1"
                strokeOpacity="0.3"
                initial={{ x: 30, opacity: 0, rotate: 20 }}
                animate={{ x: 0, opacity: 1, rotate: 0 }}
                exit={{ x: 30, opacity: 0, rotate: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ transformOrigin: '125px 90px' }}
              />
              {/* Wing feather details */}
              <motion.path
                d="M50 78 Q58 65, 72 62"
                fill="none"
                stroke="#10B981"
                strokeWidth="0.5"
                strokeOpacity="0.2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.path
                d="M130 78 Q122 65, 108 62"
                fill="none"
                stroke="#10B981"
                strokeWidth="0.5"
                strokeOpacity="0.2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Feet */}
        <path d="M75 155 L70 162 M75 155 L75 162 M75 155 L80 162" stroke="#d4a030" strokeWidth="2" strokeLinecap="round" />
        <path d="M105 155 L100 162 M105 155 L105 162 M105 155 L110 162" stroke="#d4a030" strokeWidth="2" strokeLinecap="round" />

        {/* Circuit lines on body (tech owl vibe) */}
        <motion.g
          opacity="0.3"
          animate={state === 'success' ? { opacity: 0.7 } : { opacity: 0.3 }}
        >
          <line x1="70" y1="110" x2="65" y2="125" stroke="#10B981" strokeWidth="0.8" />
          <line x1="65" y1="125" x2="70" y2="135" stroke="#10B981" strokeWidth="0.8" />
          <circle cx="65" cy="125" r="1.5" fill="#10B981" />

          <line x1="110" y1="110" x2="115" y2="125" stroke="#10B981" strokeWidth="0.8" />
          <line x1="115" y1="125" x2="110" y2="135" stroke="#10B981" strokeWidth="0.8" />
          <circle cx="115" cy="125" r="1.5" fill="#10B981" />

          <line x1="85" y1="105" x2="95" y2="105" stroke="#10B981" strokeWidth="0.5" />
          <line x1="82" y1="115" x2="98" y2="115" stroke="#10B981" strokeWidth="0.5" />
        </motion.g>
      </svg>
    </motion.div>
  );
}
