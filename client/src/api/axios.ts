import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { toast } from "sonner";
import { useAuthStore } from "../store/auth.store";
import i18n from "@/i18n";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";

type RetryableAxiosRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============ REFRESH TOKEN SINGLETON ============
// Prevent multiple simultaneous refresh requests
interface RefreshState {
  isRefreshing: boolean;
  refreshPromise: Promise<string | null> | null;
  failedQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (error: unknown) => void;
  }>;
  refreshTimeout: NodeJS.Timeout | null;
}

const refreshState: RefreshState = {
  isRefreshing: false,
  refreshPromise: null,
  failedQueue: [],
  refreshTimeout: null,
};

const REFRESH_TIMEOUT_MS = 10_000; // 10s timeout

const clearRefreshTimeout = () => {
  if (refreshState.refreshTimeout) {
    clearTimeout(refreshState.refreshTimeout);
    refreshState.refreshTimeout = null;
  }
};

const processQueue = (error: unknown | null, token: string | null = null) => {
  refreshState.failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  refreshState.failedQueue = [];
};

// ============ REQUEST INTERCEPTOR ============
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // If request body is FormData, remove Content-Type header to allow
    // axios/browser to set it automatically with the correct multipart boundary
    if (config.data instanceof FormData && config.headers) {
      config.headers.delete("Content-Type");
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============ RESPONSE INTERCEPTOR ============
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Extract server error message before it gets wrapped by AxiosError
    // This allows toast notifications to show the real error (e.g., "File type not allowed")
    // instead of the generic Axios error ("Request failed with status code 415")
    if (error.response?.data?.message) {
      error.message = error.response.data.message;
    } else if (error.response?.data?.error?.message) {
      error.message = error.response.data.error.message;
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Don't retry if:
    // 1. Not a 401
    // 2. Already retried
    // 3. Is a refresh request (prevent infinite recursion)
    // 4. Is a login/register request
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/register")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // If refresh is already in progress, queue this request
    if (refreshState.isRefreshing && refreshState.refreshPromise) {
      return refreshState.refreshPromise
        .then((token) => {
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    // Start refresh
    refreshState.isRefreshing = true;
    refreshState.refreshPromise = new Promise(async (resolveRefresh, rejectRefresh) => {
      // Set timeout to prevent infinite hanging
      const timeout = setTimeout(() => {
        clearRefreshTimeout();
        processQueue(new Error("Refresh timeout"), null);
        useAuthStore.getState().logout();
        toast.error(i18n.t("toasts.sessionExpired"));
        rejectRefresh(new Error("Refresh timeout"));
      }, REFRESH_TIMEOUT_MS);

      refreshState.refreshTimeout = timeout;

      try {
        // Make refresh request with no retry to avoid recursion
        // Use api instance (not plain axios) to ensure withCredentials is true for HTTP-only cookies
        const response = await api.post<any>("/auth/refresh", {}, {
          _retry: true,
        } as any);
        const { accessToken, user } = response.data.data;

        clearRefreshTimeout();

        // Update store with new token and user
        useAuthStore.getState().setSession({ user, accessToken });

        // Resolve all queued requests with new token
        processQueue(null, accessToken);

        resolveRefresh(accessToken);
      } catch (refreshError) {
        clearRefreshTimeout();

        // Refresh failed, logout user
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        toast.error(i18n.t("toasts.sessionExpired"));

        rejectRefresh(refreshError);
      } finally {
        refreshState.isRefreshing = false;
        refreshState.refreshPromise = null;
      }
    });

    return refreshState.refreshPromise
      .then((token) => {
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return api(originalRequest);
      })
      .catch((err) => Promise.reject(err));
  }
);

export default api;
