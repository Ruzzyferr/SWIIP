'use client';

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
  type?: 'item' | 'separator' | 'label' | 'custom';
  label?: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ContextMenuItem[];
  customContent?: ReactNode;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
}

interface MenuPosition {
  x: number;
  y: number;
}

const menuVariants = {
  hidden: { opacity: 0, scale: 0.92, y: -6, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
      mass: 0.5,
      staggerChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    filter: 'blur(2px)',
    transition: { duration: 0.1 },
  },
};

function ContextMenuContent({
  items,
  position,
  onClose,
}: {
  items: ContextMenuItem[];
  position: MenuPosition;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const actionItems = items.filter((i) => i.type !== 'separator' && i.type !== 'label');

  // Adjust position to keep in viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    setAdjustedPos({
      x: position.x + rect.width > vw ? position.x - rect.width : position.x,
      y: position.y + rect.height > vh ? position.y - rect.height : position.y,
    });
  }, [position]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, actionItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        const item = actionItems[focusedIndex];
        if (item?.onClick && !item.disabled) {
          item.onClick();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedIndex, actionItems, onClose]);

  let actionIdx = 0;

  return (
    <motion.div
      ref={menuRef}
      variants={menuVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        position: 'fixed',
        top: adjustedPos.y,
        left: adjustedPos.x,
        zIndex: 'var(--z-popover)',
        minWidth: '180px',
        maxWidth: '260px',
        background: 'rgba(18, 22, 22, 0.85)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
        padding: '4px',
        outline: 'none',
      }}
      tabIndex={-1}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <div
              key={i}
              style={{
                height: '1px',
                margin: '4px 0',
                background: 'var(--color-border-subtle)',
              }}
              role="separator"
            />
          );
        }

        if (item.type === 'label') {
          return (
            <div
              key={i}
              className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-disabled)' }}
            >
              {item.label}
            </div>
          );
        }

        if (item.type === 'custom' && item.customContent) {
          return (
            <div key={i} className="px-2.5 py-1.5" onMouseDown={(e) => e.stopPropagation()}>
              {item.customContent}
            </div>
          );
        }

        const currentIdx = actionIdx++;
        const isFocused = currentIdx === focusedIndex;

        return (
          <button
            key={i}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) {
                item.onClick?.();
                onClose();
              }
            }}
            onMouseEnter={() => setFocusedIndex(currentIdx)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm',
              'transition-all duration-fast text-left',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
            style={{
              color: item.danger
                ? 'var(--color-danger-default)'
                : 'var(--color-text-primary)',
              background: isFocused
                ? item.danger
                  ? 'var(--color-danger-muted)'
                  : 'var(--color-surface-raised)'
                : 'transparent',
              fontWeight: 500,
            }}
          >
            {item.icon && (
              <span
                className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                style={{ opacity: 0.8 }}
              >
                {item.icon}
              </span>
            )}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut && (
              <span
                className="text-xs ml-auto pl-3"
                style={{ color: 'var(--color-text-disabled)' }}
              >
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </motion.div>
  );
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleClose = useCallback(() => setMenuPos(null), []);

  useEffect(() => {
    if (!menuPos) return;
    const handler = (e: MouseEvent) => {
      // Don't close if click is inside the menu (e.g. dragging a slider)
      if (menuContainerRef.current?.contains(e.target as Node)) return;
      setMenuPos(null);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [menuPos]);

  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return (
    <>
      <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
        {children}
      </div>

      {createPortal(
        <div ref={menuContainerRef}>
          <AnimatePresence>
            {menuPos && (
              <ContextMenuContent
                items={items}
                position={menuPos}
                onClose={handleClose}
              />
            )}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </>
  );
}
