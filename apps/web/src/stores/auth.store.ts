import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { UserPayload } from '@constchat/protocol';

interface AuthState {
  user: UserPayload | null;
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: UserPayload) => void;
  setTokens: (accessToken: string, refreshToken?: string, sessionId?: string) => void;
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
      refreshToken: null,
      sessionId: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) =>
        set((state) => {
          state.user = user;
          state.isAuthenticated = true;
        }),

      setTokens: (accessToken, refreshToken, sessionId) =>
        set((state) => {
          state.accessToken = accessToken;
          if (refreshToken !== undefined) {
            state.refreshToken = refreshToken;
          }
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
          state.refreshToken = null;
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
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
