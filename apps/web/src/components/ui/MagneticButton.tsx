'use client';

import { useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  as?: 'button' | 'a' | 'div';
  href?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function MagneticButton({
  children,
  className = '',
  strength = 0.35,
  as: Tag = 'button',
  href,
  onClick,
  style,
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useSpring(0, { stiffness: 400, damping: 25, mass: 0.5 });
  const y = useSpring(0, { stiffness: 400, damping: 25, mass: 0.5 });
  const scale = useSpring(1, { stiffness: 400, damping: 25 });

  const glowOpacity = useTransform(scale, [1, 1.04], [0, 1]);

  const handleMouseMove = (e: MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;
    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    scale.set(1.04);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
    scale.set(1);
  };

  const handleMouseDown = () => {
    scale.set(0.96);
  };

  const handleMouseUp = () => {
    scale.set(1.04);
  };

  const MotionTag = motion.create(Tag as any);

  return (
    <MotionTag
      ref={ref}
      className={`btn-magnetic ${className}`}
      style={{ x, y, scale, ...style }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={onClick}
      href={href}
    >
      {/* Glow layer */}
      <motion.span
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          opacity: glowOpacity,
          boxShadow: '0 0 30px rgba(var(--ambient-rgb, 16, 185, 129), 0.35), 0 0 60px rgba(var(--ambient-rgb, 16, 185, 129), 0.12)',
        }}
      />
      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {/* Animated gradient border */}
      {isHovered && (
        <motion.span
          className="absolute inset-[-1px] rounded-[inherit] pointer-events-none"
          style={{
            background: 'conic-gradient(from var(--gradient-angle, 0deg), transparent 40%, var(--ambient-primary, #10B981) 50%, transparent 60%)',
            opacity: 0.6,
            zIndex: 0,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
        />
      )}
    </MotionTag>
  );
}
