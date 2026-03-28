'use client';

import { useState, useEffect, useCallback } from 'react';
import { Monitor, Volume2, VolumeX } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { ScreenShareQuality } from '@/stores/voice.store';


interface ScreenShareModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (quality: ScreenShareQuality, audio: boolean) => void;
}

const qualityOptions: { value: ScreenShareQuality; label: string; desc: string }[] = [
  { value: '720p30', label: '720p', desc: 'Smoother for slower connections' },
  { value: '1080p30', label: '1080p', desc: 'Better quality' },
  { value: '1080p60', label: '1080p 60FPS', desc: 'Best quality — Source' },
];

export function ScreenShareModal({ open, onClose, onStart }: ScreenShareModalProps) {
  const [quality, setQuality] = useState<ScreenShareQuality>('1080p30');
  const [shareAudio, setShareAudio] = useState(false);
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const isDesktop = typeof window !== 'undefined' && window.constchat?.platform === 'desktop';

  // Fetch desktop sources when modal opens on desktop
  useEffect(() => {
    if (!open || !isDesktop || !window.constchat?.getDesktopSources) return;
    setLoadingSources(true);
    window.constchat.getDesktopSources().then((s) => {
      setSources(s);
      // Auto-select first screen
      const firstScreen = s.find((src) => src.id.startsWith('screen:'));
      if (firstScreen) setSelectedSourceId(firstScreen.id);
      setLoadingSources(false);
    }).catch(() => setLoadingSources(false));
  }, [open, isDesktop]);

  const handleStart = useCallback(async () => {
    // On desktop, send selected source and audio preference to main process
    if (isDesktop && window.constchat) {
      await window.constchat.setScreenShareAudio?.(shareAudio);
      if (selectedSourceId) {
        await window.constchat.setSelectedSource?.(selectedSourceId);
      }
    }
    onStart(quality, shareAudio);
    onClose();
  }, [quality, shareAudio, selectedSourceId, isDesktop, onStart, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Screen Share" size="lg">
      <div className="space-y-5">
        {/* Desktop Source Picker */}
        {isDesktop && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
              Choose what to share
            </label>
            {loadingSources ? (
              <div className="flex items-center justify-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
                <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                <span className="ml-2 text-sm">Loading sources...</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => setSelectedSourceId(source.id)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all hover:scale-[1.02]"
                    style={{
                      borderColor: selectedSourceId === source.id ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)',
                      background: selectedSourceId === source.id ? 'var(--color-accent-muted)' : 'var(--color-surface-raised)',
                    }}
                  >
                    <img
                      src={source.thumbnail}
                      alt={source.name}
                      className="w-full rounded"
                      style={{ aspectRatio: '3/2', objectFit: 'cover', background: '#000' }}
                    />
                    <div className="flex items-center gap-1 w-full min-w-0">
                      {source.appIcon && (
                        <img src={source.appIcon} alt="" className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span
                        className="text-xs truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {source.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isDesktop && (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            You'll be prompted by your browser to select a screen or application window to share.
          </p>
        )}

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

        {/* Audio Toggle */}
        {(() => {
          const isWindowCapture = isDesktop && selectedSourceId?.startsWith('window:');
          const audioDisabled = !!isWindowCapture;
          return (
            <div className="space-y-1.5">
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  background: 'var(--color-surface-raised)',
                  opacity: audioDisabled ? 0.5 : 1,
                }}
              >
                <div className="flex items-center gap-2.5">
                  {shareAudio && !audioDisabled ? (
                    <Volume2 size={18} style={{ color: 'var(--color-accent-primary)' }} />
                  ) : (
                    <VolumeX size={18} style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Also share audio
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {isDesktop
                        ? isWindowCapture
                          ? 'Audio sharing is not available for window captures'
                          : 'Captures all system audio (including voice chat)'
                        : 'Share tab or system audio (Chrome/Edge only)'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !audioDisabled && setShareAudio(!shareAudio)}
                  disabled={audioDisabled}
                  className="relative w-10 h-5 rounded-full transition-colors"
                  style={{
                    background: shareAudio && !audioDisabled ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
                    cursor: audioDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: shareAudio && !audioDisabled ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
              {isDesktop && shareAudio && !isWindowCapture && (
                <p className="text-xs px-1" style={{ color: 'var(--color-warning-default, #faa61a)' }}>
                  Warning: Audio sharing captures all system sounds including voice chat. Other participants may hear echo.
                </p>
              )}
            </div>
          );
        })()}

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
            disabled={isDesktop && !selectedSourceId && sources.length > 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: 'var(--color-accent-primary)',
              color: '#fff',
              opacity: isDesktop && !selectedSourceId && sources.length > 0 ? 0.5 : 1,
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
