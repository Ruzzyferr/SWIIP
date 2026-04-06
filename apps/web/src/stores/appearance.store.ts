import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'auto';
export type MessageDisplay = 'cozy' | 'compact';

export const ACCENT_COLORS = [
  { name: 'Blue', value: '#5865f2' },
  { name: 'Green', value: '#57f287' },
  { name: 'Yellow', value: '#fee75c' },
  { name: 'Red', value: '#ed4245' },
  { name: 'Pink', value: '#eb459e' },
  { name: 'Purple', value: '#9b59b6' },
  { name: 'Cyan', value: '#1abc9c' },
  { name: 'Orange', value: '#e67e22' },
] as const;

interface AppearanceState {
  theme: Theme;
  messageDisplay: MessageDisplay;
  /** Chat font size in px (12-24, default 16) */
  chatFontSize: number;
  /** UI scale factor (0.75-1.25, default 1) */
  uiScale: number;
  /** Accent color hex */
  accentColor: string;

  // Actions
  setTheme: (theme: Theme) => void;
  setMessageDisplay: (display: MessageDisplay) => void;
  setChatFontSize: (size: number) => void;
  setUIScale: (scale: number) => void;
  setAccentColor: (color: string) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'dark',
      messageDisplay: 'cozy',
      chatFontSize: 16,
      uiScale: 1,
      accentColor: '#5865f2',

      setTheme: (theme) => set({ theme }),
      setMessageDisplay: (messageDisplay) => set({ messageDisplay }),
      setChatFontSize: (chatFontSize) => set({ chatFontSize: Math.max(12, Math.min(24, chatFontSize)) }),
      setUIScale: (uiScale) => set({ uiScale: Math.max(0.75, Math.min(1.25, uiScale)) }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: 'appearance-settings' },
  ),
);
