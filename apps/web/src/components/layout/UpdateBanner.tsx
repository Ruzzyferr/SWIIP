'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready';

interface UpdateInfo {
  version: string;
  percent: number;
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('idle');
  const [info, setInfo] = useState<UpdateInfo>({ version: '', percent: 0 });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const w = window as any;
    if (!w.constchat?.onUpdateAvailable) return;

    const offAvail = w.constchat.onUpdateAvailable((data: { version: string }) => {
      setInfo((prev) => ({ ...prev, version: data.version }));
      setState('downloading'); // autoDownload is true, download starts immediately
      setDismissed(false);
    });

    const offProg = w.constchat.onUpdateDownloadProgress((data: { percent: number }) => {
      setInfo((prev) => ({ ...prev, percent: data.percent }));
      setState('downloading');
    });

    const offDone = w.constchat.onUpdateDownloaded((data: { version: string }) => {
      setInfo((prev) => ({ ...prev, version: data.version, percent: 100 }));
      setState('ready');
      setDismissed(false);
    });

    return () => {
      offAvail?.();
      offProg?.();
      offDone?.();
    };
  }, []);

  const handleRestart = () => {
    const w = window as any;
    w.constchat?.restartForUpdate?.();
  };

  if (state === 'idle' || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div
          className="flex items-center justify-center gap-3 px-4 py-2 text-sm"
          style={{
            background: state === 'ready'
              ? 'var(--color-accent-primary)'
              : 'var(--color-surface-overlay)',
            color: state === 'ready' ? '#fff' : 'var(--color-text-primary)',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          {state === 'downloading' && (
            <>
              <Download size={14} className="animate-bounce" />
              <span>
                {info.version
                  ? `Güncelleme indiriliyor — v${info.version} — %${info.percent}`
                  : `Güncelleme indiriliyor… %${info.percent}`}
              </span>
              <div
                className="w-24 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--color-surface-raised)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${info.percent}%`,
                    background: 'var(--color-accent-primary)',
                  }}
                />
              </div>
            </>
          )}

          {state === 'ready' && (
            <>
              <CheckCircle size={14} />
              <span>
                {info.version
                  ? `Güncelleme hazır — v${info.version} — yeniden başlatın`
                  : 'Güncelleme hazır — yeniden başlatın'}
              </span>
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                style={{ background: 'rgba(255,255,255,0.2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
              >
                <RefreshCw size={12} />
                Yeniden başlat
              </button>
            </>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="ml-2 p-0.5 rounded transition-colors"
            style={{ opacity: 0.7 }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
