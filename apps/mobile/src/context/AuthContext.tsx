import React, { createContext, useContext, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient, setTokens, clearTokens, loadStoredToken } from '@/lib/api';
import { useAuthStore } from '@/lib/stores';
import { useGatewayBridge } from '@/hooks/useGatewayBridge';
import type { UserPayload } from '@constchat/protocol';

interface AuthContextType {
  user: UserPayload | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const storeSetUser = useAuthStore((s) => s.setUser);
  const storeSetTokens = useAuthStore((s) => s.setTokens);
  const storeLogout = useAuthStore((s) => s.logout);
  const storeSetLoading = useAuthStore((s) => s.setLoading);

  // Wire gateway events to stores when authenticated
  useGatewayBridge();

  // Restore session on mount
  useEffect(() => {
    (async () => {
      storeSetLoading(true);
      const token = await loadStoredToken();
      if (token) {
        try {
          storeSetTokens(token);
          const { data } = await apiClient.get('/users/@me');
          storeSetUser(data);
        } catch {
          await clearTokens();
          storeLogout();
        }
      }
      storeSetLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    await setTokens(data.accessToken, data.refreshToken);
    storeSetTokens(data.accessToken);
    storeSetUser(data.user);
  }, [storeSetTokens, storeSetUser]);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const { data } = await apiClient.post('/auth/register', { email, username, password });
    await setTokens(data.accessToken, data.refreshToken);
    storeSetTokens(data.accessToken);
    storeSetUser(data.user);
  }, [storeSetTokens, storeSetUser]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout API errors
    }
    await clearTokens();
    storeLogout();
  }, [storeLogout]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
