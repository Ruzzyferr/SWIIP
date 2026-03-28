'use client';

import { Moon, Sun, MessageSquare, AlignLeft } from 'lucide-react';
import { useAppearanceStore, type Theme, type MessageDisplay } from '@/stores/appearance.store';

function ThemeCard({
  theme,
  label,
  icon: Icon,
  selected,
  onSelect,
  preview,
}: {
  theme: Theme;
  label: string;
  icon: typeof Moon;
  selected: boolean;
  onSelect: () => void;
  preview: string;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex-1 rounded-xl overflow-hidden transition-all"
      style={{
        border: selected
          ? '2px solid var(--color-accent-primary)'
          : '2px solid var(--color-border-subtle)',
        background: 'var(--color-surface-raised)',
      }}
    >
      <div
        className="h-20 flex items-end p-3"
        style={{ background: preview }}
      >
        <div className="flex gap-1.5">
          <div className="w-12 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
          <div className="w-8 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
      <div className="flex items-center gap-2 p-3">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{
            background: selected ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
            border: selected ? 'none' : '2px solid var(--color-border-default)',
          }}
        >
          {selected && (
            <div className="w-2 h-2 rounded-full bg-white" />
          )}
        </div>
        <Icon size={14} style={{ color: 'var(--color-text-secondary)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </span>
      </div>
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  displayValue,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  displayValue: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-disabled)' }}>
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent-primary)]"
        style={{ height: 6 }}
      />
    </div>
  );
}

export function AppearancePage() {
  const theme = useAppearanceStore((s) => s.theme);
  const setTheme = useAppearanceStore((s) => s.setTheme);
  const messageDisplay = useAppearanceStore((s) => s.messageDisplay);
  const setMessageDisplay = useAppearanceStore((s) => s.setMessageDisplay);
  const chatFontSize = useAppearanceStore((s) => s.chatFontSize);
  const setChatFontSize = useAppearanceStore((s) => s.setChatFontSize);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Appearance
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Customize how Swiip looks on your device.
        </p>
      </div>

      {/* Theme */}
      <section className="space-y-3">
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Theme
        </p>
        <div className="flex gap-4">
          <ThemeCard
            theme="dark"
            label="Dark"
            icon={Moon}
            selected={theme === 'dark'}
            onSelect={() => setTheme('dark')}
            preview="linear-gradient(135deg, #1e1f22, #2b2d31)"
          />
          <ThemeCard
            theme="light"
            label="Light"
            icon={Sun}
            selected={theme === 'light'}
            onSelect={() => setTheme('light')}
            preview="linear-gradient(135deg, #f2f3f5, #ffffff)"
          />
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Message Display */}
      <section className="space-y-3">
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Message Display
        </p>
        <div className="flex gap-3">
          {([
            { id: 'cozy' as MessageDisplay, label: 'Cozy', icon: MessageSquare, desc: 'Shows avatars and full timestamps' },
            { id: 'compact' as MessageDisplay, label: 'Compact', icon: AlignLeft, desc: 'Fits more messages on screen' },
          ]).map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              onClick={() => setMessageDisplay(id)}
              className="flex-1 p-4 rounded-xl text-left transition-all"
              style={{
                border: messageDisplay === id
                  ? '2px solid var(--color-accent-primary)'
                  : '2px solid var(--color-border-subtle)',
                background: 'var(--color-surface-raised)',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={16} style={{ color: 'var(--color-text-secondary)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {label}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {desc}
              </p>
            </button>
          ))}
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Chat Font Size */}
      <section>
        <Slider
          label="Chat Font Size"
          value={chatFontSize}
          min={12}
          max={24}
          step={1}
          onChange={setChatFontSize}
          displayValue={`${chatFontSize}px`}
        />

        {/* Preview */}
        <div
          className="mt-4 p-4 rounded-lg"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-disabled)' }}
          >
            Preview
          </p>
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex-shrink-0"
              style={{ background: 'var(--color-accent-primary)' }}
            />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-semibold" style={{ color: 'var(--color-text-primary)', fontSize: chatFontSize }}>
                  Username
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Today at 12:00
                </span>
              </div>
              <p style={{ color: 'var(--color-text-primary)', fontSize: chatFontSize }}>
                This is a preview of how messages will look with the current font size.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
