import type { AxiosInstance } from 'axios';
import type { UserPayload } from '@constchat/protocol';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  user: UserPayload;
  tokens: {
    accessToken: string;
  };
  sessionId?: string;
}

export function createAuthApi(client: AxiosInstance) {
  return {
    login: async (data: LoginRequest): Promise<AuthResponse> => {
      const res = await client.post<AuthResponse>('/auth/login', data);
      return res.data;
    },

    register: async (data: RegisterRequest): Promise<AuthResponse> => {
      const res = await client.post<AuthResponse>('/auth/register', data);
      return res.data;
    },

    logout: async (): Promise<void> => {
      await client.post('/auth/logout');
    },

    refreshTokens: async (): Promise<{ accessToken: string }> => {
      const res = await client.post<{ accessToken: string }>('/auth/refresh');
      return res.data;
    },

    getCurrentUser: async (): Promise<UserPayload> => {
      const res = await client.get<UserPayload>('/users/@me');
      return res.data;
    },

    forgotPassword: async (email: string): Promise<void> => {
      await client.post('/auth/forgot-password', { email });
    },

    resetPassword: async (token: string, password: string): Promise<void> => {
      await client.post('/auth/reset-password', { token, newPassword: password });
    },

    verifyEmailCode: async (code: string): Promise<{ verified: boolean }> => {
      const res = await client.post<{ verified: boolean }>('/auth/verify-email', { code });
      return res.data;
    },

    resendVerificationCode: async (): Promise<{ message: string }> => {
      const res = await client.post<{ message: string }>('/auth/resend-verification');
      return res.data;
    },
  };
}
