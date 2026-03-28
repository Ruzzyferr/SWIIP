import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type MessageDisplay = 'cozy' | 'compact';

interface AppearanceState {
  theme: Theme;
  messageDisplay: MessageDisplay;
  /** Chat font size in px (12-24, default 16) */
  chatFontSize: number;
  /** UI scale factor (0.75-1.25, default 1) */
  uiScale: number;

  // Actions
  setTheme: (theme: Theme) => void;
  setMessageDisplay: (display: MessageDisplay) => void;
  setChatFontSize: (size: number) => void;
  setUIScale: (scale: number) => void;
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      theme: 'dark',
      messageDisplay: 'cozy',
      chatFontSize: 16,
      uiScale: 1,

      setTheme: (theme) => set({ theme }),
      setMessageDisplay: (messageDisplay) => set({ messageDisplay }),
      setChatFontSize: (chatFontSize) => set({ chatFontSize: Math.max(12, Math.min(24, chatFontSize)) }),
      setUIScale: (uiScale) => set({ uiScale: Math.max(0.75, Math.min(1.25, uiScale)) }),
    }),
    { name: 'appearance-settings' },
  ),
);
