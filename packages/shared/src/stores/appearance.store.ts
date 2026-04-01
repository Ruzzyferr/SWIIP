import { create } from 'zustand';
import { persist, type StateStorage } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type MessageDisplay = 'cozy' | 'compact';

interface AppearanceState {
  theme: Theme;
  messageDisplay: MessageDisplay;
  chatFontSize: number;
  uiScale: number;

  setTheme: (theme: Theme) => void;
  setMessageDisplay: (display: MessageDisplay) => void;
  setChatFontSize: (size: number) => void;
  setUIScale: (scale: number) => void;
}

export function createAppearanceStore(storage?: StateStorage) {
  const storeLogic = (set: any) => ({
    theme: 'dark' as Theme,
    messageDisplay: 'cozy' as MessageDisplay,
    chatFontSize: 16,
    uiScale: 1,

    setTheme: (theme: Theme) => set({ theme }),
    setMessageDisplay: (messageDisplay: MessageDisplay) => set({ messageDisplay }),
    setChatFontSize: (chatFontSize: number) =>
      set({ chatFontSize: Math.max(12, Math.min(24, chatFontSize)) }),
    setUIScale: (uiScale: number) =>
      set({ uiScale: Math.max(0.75, Math.min(1.25, uiScale)) }),
  });

  if (storage) {
    return create<AppearanceState>()(
      persist(storeLogic, {
        name: 'appearance-settings',
        storage: {
          getItem: (name) => {
            const str = storage.getItem(name);
            return str ? (typeof str === 'string' ? JSON.parse(str) : str) : null;
          },
          setItem: (name, value) => storage.setItem(name, JSON.stringify(value)),
          removeItem: (name) => storage.removeItem(name),
        },
      })
    );
  }

  return create<AppearanceState>()(storeLogic);
}

export const useAppearanceStore = createAppearanceStore(
  typeof window !== 'undefined'
    ? {
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      }
    : undefined
);
