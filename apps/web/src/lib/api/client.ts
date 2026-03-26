import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// Token storage helpers
// ---------------------------------------------------------------------------

let _accessToken: string | null = null;
let _refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // include httpOnly refresh-token cookie
});

// ---------------------------------------------------------------------------
// Request interceptor — inject access token
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (_accessToken) {
      config.headers.Authorization = `Bearer ${_accessToken}`;
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`
      );
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — token refresh on 401 + error normalization
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[API] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // 401 → try to refresh token once
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh'
    ) {
      originalRequest._retry = true;

      try {
        // Serialize concurrent refresh calls into one
        if (!_refreshPromise) {
          _refreshPromise = apiClient
            .post<{ accessToken: string }>('/auth/refresh')
            .then((res) => res.data.accessToken)
            .finally(() => {
              _refreshPromise = null;
            });
        }

        const newToken = await _refreshPromise;
        setAccessToken(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // Also update the zustand store without a circular import
        if (typeof window !== 'undefined') {
          const { useAuthStore } = await import('@/stores/auth.store');
          useAuthStore.getState().setTokens(newToken);
        }

        return apiClient(originalRequest);
      } catch {
        // Refresh failed — force logout
        if (typeof window !== 'undefined') {
          const { useAuthStore } = await import('@/stores/auth.store');
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    // Normalize error
    const apiErr = error.response?.data;
    throw new ApiError(
      error.response?.status ?? 0,
      apiErr?.error ?? 'UNKNOWN',
      apiErr?.message ?? error.message
    );
  }
);
