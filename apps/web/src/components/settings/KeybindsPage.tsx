'use client';

import { useCallback } from 'react';
import { KeyRound } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';

interface Keybind {
  action: string;
  keys: string[];
  context?: string;
}

const KEYBINDS: Keybind[] = [
  { action: 'Toggle Mute', keys: ['M'], context: 'Voice connected, not typing' },
  { action: 'Toggle Mute (global)', keys: ['Ctrl', 'Shift', 'M'] },
  { action: 'Toggle Deafen', keys: ['D'], context: 'Voice connected, not typing' },
  { action: 'Toggle Camera', keys: ['V'], context: 'Voice connected, not typing' },
  { action: 'Push to Talk', keys: ['Configurable'], context: 'Voice connected, PTT mode enabled' },
  { action: 'Voice Debug Overlay', keys: ['Ctrl', 'Shift', 'D'], context: 'Voice connected' },
  { action: 'Close Settings / Modal', keys: ['Escape'] },
  { action: 'Search', keys: ['Ctrl', 'K'] },
  { action: 'Mark Channel as Read', keys: ['Escape'], context: 'In a channel' },
  { action: 'Navigate to DMs', keys: ['Ctrl', 'Shift', 'H'] },
  { action: 'Fullscreen (Screen Share)', keys: ['Double-click'], context: 'On a screen share tile' },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md text-xs font-semibold"
      style={{
        background: 'var(--color-surface-base)',
        border: '1px solid var(--color-border-default)',
        color: 'var(--color-text-primary)',
        boxShadow: '0 1px 0 var(--color-border-strong)',
      }}
    >
      {children}
    </kbd>
  );
}

export function KeybindsPage() {
  const shortcutsEnabled = useVoiceStore((s) => s.settings.keyboardShortcutsEnabled);
  const updateSettings = useVoiceStore((s) => s.updateSettings);

  const toggleShortcuts = useCallback(() => {
    updateSettings({ keyboardShortcutsEnabled: !shortcutsEnabled });
  }, [shortcutsEnabled, updateSettings]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Keybinds
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Keyboard shortcuts for quick actions.
        </p>
      </div>

      {/* Enable/Disable toggle */}
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{ background: 'var(--color-surface-raised)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Voice Keyboard Shortcuts
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Disable to prevent accidental muting while gaming or using other apps
          </p>
        </div>
        <button
          onClick={toggleShortcuts}
          className="relative w-11 h-6 rounded-full transition-colors"
          style={{
            background: shortcutsEnabled ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
          }}
        >
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
            style={{
              background: '#fff',
              transform: shortcutsEnabled ? 'translateX(22px)' : 'translateX(2px)',
            }}
          />
        </button>
      </div>

      <section>
        <p
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          All Shortcuts
        </p>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--color-border-subtle)' }}
        >
          {KEYBINDS.map((bind, i) => (
            <div
              key={bind.action}
              className="flex items-center justify-between px-4 py-3"
              style={{
                background: i % 2 === 0 ? 'var(--color-surface-raised)' : 'var(--color-surface-elevated)',
                borderBottom: i < KEYBINDS.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {bind.action}
                </p>
                {bind.context && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {bind.context}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {bind.keys.map((key, j) => (
                  <span key={j} className="flex items-center gap-1">
                    <KeyCap>{key}</KeyCap>
                    {j < bind.keys.length - 1 && (
                      <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div
        className="p-4 rounded-xl flex items-start gap-3"
        style={{ background: 'var(--color-surface-raised)' }}
      >
        <KeyRound size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-text-accent)' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Push-to-Talk keybind
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Configure Push-to-Talk key in Voice & Video settings.
          </p>
        </div>
      </div>

      {!shortcutsEnabled && (
        <div
          className="p-3 rounded-xl flex items-center gap-2"
          style={{
            background: 'var(--color-warning-muted)',
            border: '1px solid var(--color-warning-default)',
          }}
        >
          <span className="text-xs" style={{ color: 'var(--color-warning-default)' }}>
            Voice shortcuts are currently disabled. You can still mute/deafen using the buttons in the voice panel.
          </span>
        </div>
      )}
    </div>
  );
}
