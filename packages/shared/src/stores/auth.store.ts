import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, type StateStorage } from 'zustand/middleware';
import type { UserPayload } from '@constchat/protocol';

interface AuthState {
  user: UserPayload | null;
  accessToken: string | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: UserPayload) => void;
  setTokens: (accessToken: string, sessionId?: string) => void;
  setSessionId: (sessionId: string) => void;
  logout: () => void;
  updateUser: (partial: Partial<UserPayload>) => void;
  setLoading: (loading: boolean) => void;
}

export function createAuthStore(storage?: StateStorage) {
  const storeCreator = immer<AuthState>((set) => ({
    user: null,
    accessToken: null,
    sessionId: null,
    isAuthenticated: false,
    isLoading: false,

    setUser: (user) =>
      set((state) => {
        state.user = user;
        state.isAuthenticated = true;
      }),

    setTokens: (accessToken, sessionId) =>
      set((state) => {
        state.accessToken = accessToken;
        if (sessionId !== undefined) {
          state.sessionId = sessionId;
        }
        state.isAuthenticated = true;
      }),

    setSessionId: (sessionId) =>
      set((state) => {
        state.sessionId = sessionId;
      }),

    logout: () =>
      set((state) => {
        state.user = null;
        state.accessToken = null;
        state.sessionId = null;
        state.isAuthenticated = false;
      }),

    updateUser: (partial) =>
      set((state) => {
        if (state.user) {
          Object.assign(state.user, partial);
        }
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),
  }));

  if (storage) {
    return create<AuthState>()(
      persist(storeCreator, {
        name: 'constchat-auth',
        storage: {
          getItem: (name) => {
            const str = storage.getItem(name);
            return str ? (typeof str === 'string' ? JSON.parse(str) : str) : null;
          },
          setItem: (name, value) => storage.setItem(name, JSON.stringify(value)),
          removeItem: (name) => storage.removeItem(name),
        },
        partialize: (state: AuthState) => ({
          accessToken: state.accessToken,
          sessionId: state.sessionId,
          user: state.user,
        } as unknown as AuthState),
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.isAuthenticated = !!state.accessToken && !!state.user;
          }
        },
      })
    );
  }

  return create<AuthState>()(storeCreator);
}

// Default export — uses localStorage on web, no persist on server/mobile without config
export const useAuthStore = createAuthStore(
  typeof window !== 'undefined'
    ? {
        getItem: (name) => localStorage.getItem(name),
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      }
    : undefined
);
