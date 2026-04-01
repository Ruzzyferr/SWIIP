'use client';

import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', '/'], desc: 'Open this help' },
      { keys: ['Ctrl', 'K'], desc: 'Quick switcher' },
      { keys: ['Ctrl', 'Shift', 'M'], desc: 'Toggle mute' },
      { keys: ['Ctrl', 'Shift', 'D'], desc: 'Toggle deafen' },
      { keys: ['Escape'], desc: 'Close modal / cancel edit' },
    ],
  },
  {
    title: 'Messages',
    shortcuts: [
      { keys: ['Enter'], desc: 'Send message' },
      { keys: ['Shift', 'Enter'], desc: 'New line' },
      { keys: ['Arrow Up'], desc: 'Edit last message (empty input)' },
      { keys: ['Ctrl', 'B'], desc: 'Bold selected text' },
      { keys: ['Ctrl', 'I'], desc: 'Italic selected text' },
      { keys: ['Ctrl', '`'], desc: 'Code selected text' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'V'], desc: 'Paste image from clipboard' },
      { keys: ['Shift', 'Click'], desc: 'Select message' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-t-xl sm:rounded-xl w-full max-w-[min(100%,32rem)] max-h-[min(88dvh,640px)] overflow-y-auto"
        style={{
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Keyboard size={18} style={{ color: 'var(--color-text-secondary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcuts */}
        <div className="px-5 py-4 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-disabled)' }}>
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {shortcut.desc}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          <kbd
                            className="inline-block px-1.5 py-0.5 rounded text-xs font-mono font-medium"
                            style={{
                              background: 'var(--color-surface-raised)',
                              border: '1px solid var(--color-border-default)',
                              color: 'var(--color-text-primary)',
                              minWidth: '24px',
                              textAlign: 'center',
                            }}
                          >
                            {key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && (
                            <span className="text-xs mx-0.5" style={{ color: 'var(--color-text-disabled)' }}>+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
