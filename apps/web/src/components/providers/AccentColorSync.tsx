'use client';

import { useEffect } from 'react';
import { useAppearanceStore } from '@/stores/appearance.store';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function AccentColorSync() {
  const accentColor = useAppearanceStore((s) => s.accentColor);
  const theme = useAppearanceStore((s) => s.theme);

  // Sync accent color CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const [r, g, b] = hexToRgb(accentColor);

    root.style.setProperty('--color-accent-primary', accentColor);
    root.style.setProperty('--color-accent-muted', `rgba(${r}, ${g}, ${b}, 0.16)`);
    root.style.setProperty('--color-accent-subtle', `rgba(${r}, ${g}, ${b}, 0.08)`);
    root.style.setProperty('--color-accent-strong', `rgba(${r}, ${g}, ${b}, 0.25)`);
    root.style.setProperty('--color-text-accent', accentColor);
  }, [accentColor]);

  // Sync auto theme mode with system preference
  useEffect(() => {
    if (theme !== 'auto') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark: boolean) => {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    };
    apply(mq.matches);

    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return null;
}
