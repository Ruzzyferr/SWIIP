'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  placement?: TooltipPlacement;
  delay?: number;
  children: ReactNode;
  disabled?: boolean;
}

interface TooltipPosition {
  top: number;
  left: number;
  transformOrigin: string;
}

function getPosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TooltipPlacement,
  gap = 8
): TooltipPosition {
  const scroll = {
    x: window.scrollX,
    y: window.scrollY,
  };

  switch (placement) {
    case 'top':
      return {
        top: triggerRect.top + scroll.y - tooltipRect.height - gap,
        left:
          triggerRect.left +
          scroll.x +
          triggerRect.width / 2 -
          tooltipRect.width / 2,
        transformOrigin: 'bottom center',
      };
    case 'bottom':
      return {
        top: triggerRect.bottom + scroll.y + gap,
        left:
          triggerRect.left +
          scroll.x +
          triggerRect.width / 2 -
          tooltipRect.width / 2,
        transformOrigin: 'top center',
      };
    case 'left':
      return {
        top:
          triggerRect.top +
          scroll.y +
          triggerRect.height / 2 -
          tooltipRect.height / 2,
        left: triggerRect.left + scroll.x - tooltipRect.width - gap,
        transformOrigin: 'right center',
      };
    case 'right':
      return {
        top:
          triggerRect.top +
          scroll.y +
          triggerRect.height / 2 -
          tooltipRect.height / 2,
        left: triggerRect.right + scroll.x + gap,
        transformOrigin: 'left center',
      };
  }
}

const tooltipVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.1, ease: [0.4, 0, 0.2, 1] as number[] },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: 0.08, ease: [0.4, 0, 1, 1] as number[] },
  },
};

export function Tooltip({
  content,
  placement = 'top',
  delay = 600,
  children,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const show = useCallback(() => {
    if (disabled) return;
    showTimer.current = setTimeout(() => setVisible(true), delay);
  }, [disabled, delay]);

  const hide = useCallback(() => {
    clearTimeout(showTimer.current);
    setVisible(false);
  }, []);

  // Update position when visible
  useEffect(() => {
    if (!visible || !triggerRef.current) return;

    const updatePosition = () => {
      const triggerRect = triggerRef.current!.getBoundingClientRect();
      // Use rough estimate if tooltip not yet rendered
      const tooltipRect = tooltipRef.current?.getBoundingClientRect() ?? {
        width: 120,
        height: 32,
      } as DOMRect;
      setPosition(getPosition(triggerRect, tooltipRect, placement));
    };

    updatePosition();
    // Re-measure after tooltip renders
    const raf = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(raf);
  }, [visible, placement]);

  if (!content) return <>{children}</>;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'contents' }}
      >
        {children}
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {visible && position && (
              <motion.div
                ref={tooltipRef}
                variants={tooltipVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                role="tooltip"
                style={
                  {
                    position: 'absolute',
                    top: position.top,
                    left: position.left,
                    transformOrigin: position.transformOrigin,
                    zIndex: 'var(--z-tooltip)',
                    pointerEvents: 'none',
                  } as any
                }
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap max-w-[240px]"
                css-background="var(--color-surface-floating)"
              >
                <div
                  style={{
                    background: 'var(--color-surface-floating)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border-subtle)',
                    boxShadow: 'var(--shadow-lg)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    maxWidth: '240px',
                    lineHeight: '1.4',
                  }}
                >
                  {content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
