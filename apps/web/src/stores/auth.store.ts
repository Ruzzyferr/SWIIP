import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { UserPayload } from '@constchat/protocol';

interface AuthState {
  user: UserPayload | null;
  accessToken: string | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: UserPayload) => void;
  setTokens: (accessToken: string, sessionId?: string) => void;
  setSessionId: (sessionId: string) => void;
  logout: () => void;
  updateUser: (partial: Partial<UserPayload>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set) => ({
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
    })),
    {
      name: 'constchat-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    }
  )
);
