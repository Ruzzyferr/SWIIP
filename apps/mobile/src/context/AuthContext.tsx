import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, loadStoredToken, setTokens, clearTokens } from '@/lib/api';

interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  email: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    (async () => {
      const token = await loadStoredToken();
      if (token) {
        try {
          const { data } = await apiClient.get('/users/@me');
          setState({ user: data, isAuthenticated: true, isLoading: false });
        } catch {
          await clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    await setTokens(data.accessToken, data.refreshToken);
    setState({ user: data.user, isAuthenticated: true, isLoading: false });
  };

  const register = async (email: string, username: string, password: string) => {
    const { data } = await apiClient.post('/auth/register', { email, username, password });
    await setTokens(data.accessToken, data.refreshToken);
    setState({ user: data.user, isAuthenticated: true, isLoading: false });
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout API errors
    }
    await clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
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
