import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientConfig {
  baseURL: string;
  /** Called when the access token changes (e.g., after refresh) */
  onTokenRefreshed?: (newToken: string) => void;
  /** Called when auth fails and user should be redirected to login */
  onAuthFailure?: () => void;
  /** Whether to include cookies (web: true, mobile: false) */
  withCredentials?: boolean;
  /** Custom refresh token header for mobile */
  refreshTokenHeader?: string;
  /** Get stored refresh token (mobile) */
  getRefreshToken?: () => Promise<string | null>;
}

let _accessToken: string | null = null;
let _refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: config.withCredentials ?? false,
  });

  // Request interceptor
  client.interceptors.request.use((reqConfig: InternalAxiosRequestConfig) => {
    if (_accessToken) {
      reqConfig.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return reqConfig;
  });

  // Response interceptor
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorResponse>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
        _rateLimitRetry?: boolean;
      };

      // 429 → retry after delay
      if (error.response?.status === 429 && !originalRequest._rateLimitRetry) {
        originalRequest._rateLimitRetry = true;
        const retryAfter = error.response.headers['retry-after'];
        const delayMs = retryAfter
          ? parseFloat(retryAfter) > 100
            ? Math.max(0, new Date(retryAfter).getTime() - Date.now())
            : parseFloat(retryAfter) * 1000
          : 1000;
        await new Promise((r) => setTimeout(r, delayMs));
        return client.request(originalRequest);
      }

      // 401 → refresh token
      const skipRefreshUrls = ['/auth/login', '/auth/register', '/auth/refresh'];
      const isAuthEndpoint = skipRefreshUrls.some((u) => originalRequest.url?.startsWith(u));
      if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
        originalRequest._retry = true;
        try {
          if (!_refreshPromise) {
            _refreshPromise = (async () => {
              const refreshHeaders: Record<string, string> = {};
              if (config.getRefreshToken && config.refreshTokenHeader) {
                const refreshToken = await config.getRefreshToken();
                if (refreshToken) {
                  refreshHeaders[config.refreshTokenHeader] = refreshToken;
                }
              }
              const res = await client.post<{ accessToken: string }>(
                '/auth/refresh',
                {},
                { headers: refreshHeaders },
              );
              return res.data.accessToken;
            })().finally(() => {
              _refreshPromise = null;
            });
          }
          const newToken = await _refreshPromise;
          setAccessToken(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          config.onTokenRefreshed?.(newToken);
          return client(originalRequest);
        } catch {
          config.onAuthFailure?.();
          return Promise.reject(error);
        }
      }

      const apiErr = error.response?.data;
      throw new ApiError(
        error.response?.status ?? 0,
        apiErr?.error ?? 'UNKNOWN',
        apiErr?.message ?? error.message,
      );
    },
  );

  return client;
}
