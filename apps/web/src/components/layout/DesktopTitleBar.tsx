'use client';

import { useEffect, useState } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';


export function DesktopTitleBar() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.constchat?.platform === 'desktop') {
      setIsDesktop(true);
      window.constchat.isMaximized().then(setIsMaximized);
      window.constchat.onMaximizeChange(setIsMaximized);
    }
  }, []);

  if (!isDesktop) return null;

  const btnBase = 'h-8 w-12 flex items-center justify-center transition-colors';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center select-none"
      style={{
        height: 32,
        background: 'var(--color-surface-base)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* App title — left side */}
      <span
        className="text-xs font-semibold ml-3 tracking-wide"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        SWIIP
      </span>

      {/* Spacer (draggable area) */}
      <div className="flex-1" />

      {/* Window controls — right side, no-drag */}
      <div
        className="flex"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.constchat?.minimize()}
          className={btnBase}
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.constchat?.maximize()}
          className={btnBase}
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          onClick={() => window.constchat?.close()}
          className={btnBase}
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
