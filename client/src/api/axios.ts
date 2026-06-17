import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/auth.store";
import { toast } from "sonner";
import i18n from "@/i18n";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const refreshTokenClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: CustomAxiosRequestConfig) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(null);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    if (!originalRequest) return Promise.reject(error);

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest)).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await refreshTokenClient.post("/auth/refresh", {});
        const { accessToken: newAccessToken } = response.data.data.tokens;
        useAuthStore.getState().setToken(newAccessToken);
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        useAuthStore.getState().logout();
        toast.error(i18n.t("toasts.sessionExpired"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status !== 401) {
      const message = (error.response?.data as { message?: string })?.message ?? "An error occurred";
      toast.error(message === "An error occurred" ? i18n.t("toasts.genericError") : message);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
