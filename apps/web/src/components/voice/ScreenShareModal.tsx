'use client';

import { useState } from 'react';
import { Monitor, AppWindow } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { ScreenShareQuality } from '@/stores/voice.store';

interface ScreenShareModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (quality: ScreenShareQuality) => void;
}

const qualityOptions: { value: ScreenShareQuality; label: string; desc: string }[] = [
  { value: '720p30', label: '720p', desc: 'Smoother for slower connections' },
  { value: '1080p30', label: '1080p', desc: 'Better quality' },
  { value: '1080p60', label: '1080p 60FPS', desc: 'Best quality — Source' },
];

export function ScreenShareModal({ open, onClose, onStart }: ScreenShareModalProps) {
  const [quality, setQuality] = useState<ScreenShareQuality>('1080p30');

  const handleStart = () => {
    onStart(quality);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Screen Share" size="md">
      <div className="space-y-6">
        {/* Info */}
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          You'll be prompted by your browser to select a screen or application window to share.
        </p>

        {/* Quality Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
            Stream Quality
          </label>
          <div className="grid grid-cols-3 gap-2">
            {qualityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQuality(opt.value)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all"
                style={{
                  borderColor: quality === opt.value ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)',
                  background: quality === opt.value ? 'var(--color-accent-muted)' : 'var(--color-surface-raised)',
                }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {opt.label}
                </span>
                <span className="text-xs text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              background: 'var(--color-surface-raised)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: 'var(--color-accent-primary)',
              color: '#fff',
            }}
          >
            <Monitor size={16} />
            Go Live
          </button>
        </div>
      </div>
    </Modal>
  );
}
