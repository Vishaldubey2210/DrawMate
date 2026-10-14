import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios';
import { clientLogger } from '../utils/logger.js';

const envApiUrl = (import.meta as any).env?.VITE_API_URL;
const apiBase = envApiUrl ? `${envApiUrl.replace(/\/$/, '')}/api` : '/api';

export const api: AxiosInstance = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dedicated unintercepted client for refresh requests to guarantee zero recursion
export const refreshClient: AxiosInstance = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Concurrency queue for in-flight requests during token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: attach auth token & log outgoing request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('drawmate_token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  clientLogger.debug('HTTP', `--> ${config.method?.toUpperCase()} ${config.url}`, config.params);
  return config;
});

export const extractErrorMessage = (err: any): string => {
  const data = err.response?.data;
  if (data) {
    if (Array.isArray(data.details) && data.details.length > 0) {
      const first = data.details[0];
      if (typeof first?.message === 'string' && first.message.trim()) return first.message.trim();
      if (typeof first === 'string' && first.trim()) return first.trim();
    }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
    if (typeof data.error === 'object' && data.error !== null && typeof data.error.message === 'string') {
      return data.error.message.trim();
    }
  }
  if (typeof err.message === 'string' && err.message.trim()) {
    return err.message.trim();
  }
  return 'An unexpected network error occurred';
};

// Response interceptor: structured logging, normalized error handling & silent refresh recovery
api.interceptors.response.use(
  (response: AxiosResponse) => {
    clientLogger.debug('HTTP', `<-- ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  async (error: any) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || '';
    const method = originalRequest?.method?.toUpperCase() || 'GET';

    const message = extractErrorMessage(error);

    clientLogger.warn('HTTP', `<-- [${status || 'ERR'}] ${method} ${url}: ${message}`);

    // Check if the route is an auth endpoint that should not trigger auto-refresh
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password');

    // If 401 Unauthorized on an eligible protected route and not already retried
    if (status === 401 && !isAuthRoute && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // Enqueue concurrent in-flight requests while active refresh is underway
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            originalRequest._retry = true;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await refreshClient.post('/auth/refresh');
        const newAccessToken = refreshRes.data?.accessToken;

        if (refreshRes.data?.success && newAccessToken) {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('drawmate_token', newAccessToken);
          }
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          processQueue(null, newAccessToken);
          return api(originalRequest);
        } else {
          throw new Error('Refresh response did not return a valid access token.');
        }
      } catch (refreshErr: any) {
        processQueue(refreshErr, null);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('drawmate_token');
        }
        const refreshMessage =
          refreshErr.response?.data?.error ||
          refreshErr.message ||
          'Session expired. Please sign in again.';
        return Promise.reject(new Error(refreshMessage));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(new Error(message));
  }
);
