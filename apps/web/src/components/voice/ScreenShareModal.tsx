'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Monitor, Volume2, VolumeX, MicOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useVoiceStore, type ScreenShareQuality } from '@/stores/voice.store';
import {
  isProcessLoopbackSupported,
  listProcessLoopbackWindows,
  type ProcessLoopbackWindow,
} from '@/lib/audio/process-loopback-track';

// Electron's desktopCapturer source.id format for windows: "window:<HWND>:<idx>".
// Parse the HWND so we can cross-reference it with application-loopback's
// getActiveWindowProcessIds output (which returns hwnd as a decimal string).
function hwndFromSourceId(sourceId: string): string | null {
  if (!sourceId.startsWith('window:')) return null;
  const parts = sourceId.split(':');
  return parts[1] ?? null;
}


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
  const [shareAudio, setShareAudio] = useState(true);
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourceTab, setSourceTab] = useState<'screens' | 'windows'>('screens');
  const [plSupported, setPlSupported] = useState(false);
  const [plWindows, setPlWindows] = useState<ProcessLoopbackWindow[]>([]);
  const isDesktop = typeof window !== 'undefined' && window.constchat?.platform === 'desktop';
  const suppressVoice = useVoiceStore((s) => s.settings.suppressVoiceDuringShare);
  const updateSettings = useVoiceStore((s) => s.updateSettings);
  const setSelectedProcessId = useVoiceStore((s) => s.setSelectedProcessId);

  const screenSources = useMemo(() => sources.filter((s) => s.id.startsWith('screen:')), [sources]);
  const windowSources = useMemo(() => sources.filter((s) => s.id.startsWith('window:')), [sources]);
  const filteredSources = sourceTab === 'screens' ? screenSources : windowSources;

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

  // Auto-select first source when tab changes
  useEffect(() => {
    const list = sourceTab === 'screens' ? screenSources : windowSources;
    if (list.length > 0 && !list.find((s) => s.id === selectedSourceId)) {
      setSelectedSourceId(list[0]!.id);
    }
  }, [sourceTab, screenSources, windowSources, selectedSourceId]);

  // Fetch ProcessLoopback capability + window→PID list when modal opens.
  // The list powers HWND→PID resolution so we can pass the right PID to the
  // native capture module once the user hits Go Live.
  useEffect(() => {
    if (!open || !isDesktop) {
      setPlSupported(false);
      setPlWindows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const supported = await isProcessLoopbackSupported();
      if (cancelled) return;
      setPlSupported(supported);
      if (supported) {
        const list = await listProcessLoopbackWindows();
        if (cancelled) return;
        setPlWindows(list);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isDesktop]);

  const isWindowCapture = isDesktop && !!selectedSourceId?.startsWith('window:');
  const plPidForSelected = useMemo(() => {
    if (!plSupported || !isWindowCapture || !selectedSourceId) return null;
    const hwnd = hwndFromSourceId(selectedSourceId);
    if (!hwnd) return null;
    return plWindows.find((w) => w.hwnd === hwnd)?.processId ?? null;
  }, [plSupported, isWindowCapture, selectedSourceId, plWindows]);
  const processLoopbackActive = shareAudio && plPidForSelected !== null;

  const handleStart = useCallback(async () => {
    // On desktop, send selected source and audio preference to main process
    if (isDesktop && window.constchat) {
      await window.constchat.setScreenShareAudio?.(shareAudio);
      if (selectedSourceId) {
        await window.constchat.setSelectedSource?.(selectedSourceId);
      }
    }
    // Hand the resolved PID to useLiveKitRoom via the voice store. Null means
    // "no ProcessLoopback" — either audio off, unsupported, or full-screen capture.
    setSelectedProcessId(shareAudio ? plPidForSelected : null);
    onStart(quality, shareAudio);
    onClose();
  }, [quality, shareAudio, selectedSourceId, isDesktop, onStart, onClose, plPidForSelected, setSelectedProcessId]);

  return (
    <Modal open={open} onClose={onClose} title="Screen Share" size="lg">
      <div className="space-y-5">
        {/* Desktop Source Picker */}
        {isDesktop && (
          <div className="space-y-2">
            {/* Tab bar */}
            <div className="flex gap-2">
              <button
                onClick={() => setSourceTab('screens')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: sourceTab === 'screens' ? 'var(--color-accent-muted)' : 'var(--color-surface-raised)',
                  color: sourceTab === 'screens' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  border: sourceTab === 'screens' ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-subtle)',
                }}
              >
                Ekranlar
              </button>
              <button
                onClick={() => setSourceTab('windows')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: sourceTab === 'windows' ? 'var(--color-accent-muted)' : 'var(--color-surface-raised)',
                  color: sourceTab === 'windows' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  border: sourceTab === 'windows' ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-subtle)',
                }}
              >
                Pencereler
              </button>
            </div>
            {loadingSources ? (
              <div className="flex items-center justify-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
                <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                <span className="ml-2 text-sm">Loading sources...</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {filteredSources.map((source) => (
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
        <div className="space-y-1.5">
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{
              background: 'var(--color-surface-raised)',
            }}
          >
            <div className="flex items-center gap-2.5">
              {shareAudio ? (
                <Volume2 size={18} style={{ color: 'var(--color-accent-primary)' }} />
              ) : (
                <VolumeX size={18} style={{ color: 'var(--color-text-tertiary)' }} />
              )}
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Sistem sesini de paylaş
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {isDesktop
                    ? isWindowCapture
                      ? processLoopbackActive
                        ? 'Sadece seçili uygulamanın sesi paylaşılır — voice chat karışmaz'
                        : 'Seçili pencerenin sesi izleyenlere gider'
                      : 'Bilgisayarınızda çalan ses (YouTube, oyun, müzik) izleyenlere gider'
                    : 'Tarayıcı seçim ekranında "Sekme/Ekran sesini paylaş" tikini açmayı unutmayın'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShareAudio(!shareAudio)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{
                background: shareAudio ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
                cursor: 'pointer',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: shareAudio ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
          {processLoopbackActive && (
            <div
              className="text-xs p-3 rounded-lg"
              style={{
                color: 'var(--color-accent-primary)',
                background: 'var(--color-accent-muted)',
                border: '1px solid var(--color-accent-primary)',
              }}
            >
              <p className="font-semibold">✓ Temiz uygulama sesi (ProcessLoopback)</p>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Yalnızca seçili uygulamanın sesi yakalanır. Voice chat, müzik veya diğer uygulamalar paylaşıma karışmaz — Teams/Meet gibi.
              </p>
            </div>
          )}
          {isDesktop && shareAudio && !isWindowCapture && (
            <div
              className="text-xs p-3 rounded-lg space-y-1.5"
              style={{
                color: 'var(--color-warning-default, #faa61a)',
                background: 'color-mix(in srgb, var(--color-warning-default, #faa61a) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-warning-default, #faa61a) 30%, transparent)',
              }}
            >
              <p className="font-semibold">⚠️ Voice chat sesi de paylaşıma karışabilir</p>
              <p>
                Tam ekran + ses modu <strong>tüm sistem sesini</strong> yakalar — voice chat dahil.
                İzleyenler aynı sesi iki kez duyabilir. Temiz ses için{' '}
                <strong>Pencereler</strong> sekmesinden tek bir uygulama seç.
              </p>
            </div>
          )}
          {isDesktop && shareAudio && isWindowCapture && !processLoopbackActive && (
            <p className="text-xs px-1" style={{ color: 'var(--color-warning-default, #faa61a)' }}>
              Bu pencere için per-process ses yakalama kullanılamıyor. Yankıyı önlemek için kulaklık kullan.
            </p>
          )}
          {!isDesktop && shareAudio && (
            <p className="text-xs px-1" style={{ color: 'var(--color-warning-default, #faa61a)' }}>
              Tarayıcı "Tüm Ekran" veya "Sekme" seçerken "Sistem sesini paylaş" seçeneğini de işaretleyin.
            </p>
          )}
        </div>

        {/* Suppress-voice-during-share toggle — only when ProcessLoopback can't isolate audio */}
        {isDesktop && shareAudio && !processLoopbackActive && (
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ background: 'var(--color-surface-raised)' }}
          >
            <div className="flex items-center gap-2.5">
              <MicOff
                size={18}
                style={{ color: suppressVoice ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)' }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Paylaşırken voice chat'i yerel olarak sustur
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Paylaşım süresince diğerlerini duymazsın ama sesleri paylaşıma karışmaz. İzleyenler voice chat'i LiveKit üzerinden normal duyar.
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ suppressVoiceDuringShare: !suppressVoice })}
              className="relative w-10 h-5 rounded-full transition-colors shrink-0"
              style={{
                background: suppressVoice ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
                cursor: 'pointer',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: suppressVoice ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        )}

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
