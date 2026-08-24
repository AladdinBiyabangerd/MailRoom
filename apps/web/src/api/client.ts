import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import i18n from "@/i18n";
import {
  clearSession,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth-storage";
import { isTokenExpired } from "@/lib/token-utils";

const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL;

/** Explicit offline demo — set VITE_DEMO_MODE=true to skip all network calls. */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

export const ADMIN_API_BASE_URL = ADMIN_API_URL || "/admin/v1";

/** True when the app should call the real admin backend (default). */
export const isAdminApiConfigured = !isDemoMode;

const PUBLIC_AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
];

const AUTH_ENDPOINTS = [
  "/auth/sign-in",
  "/auth/login",
  "/auth/sign-up",
  "/auth/verify-otp",
  "/auth/resend-otp",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/verify-code",
  "/auth/reset-password",
  "/auth/sign-out",
  "/auth/logout",
];

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => pathname.startsWith(path));
}

function clearAuthAndRedirect(): void {
  clearSession();
  const pathname = window.location.pathname;
  if (!isPublicAuthPath(pathname)) {
    window.location.href = "/login";
  }
}

interface RefreshState {
  isRefreshing: boolean;
  failedQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (error: unknown) => void;
  }>;
  proactiveRefreshPromise: Promise<string | null> | null;
}

const refreshStates = new WeakMap<AxiosInstance, RefreshState>();

function getRefreshState(client: AxiosInstance): RefreshState {
  let state = refreshStates.get(client);
  if (!state) {
    state = { isRefreshing: false, failedQueue: [], proactiveRefreshPromise: null };
    refreshStates.set(client, state);
  }
  return state;
}

function processQueue(
  state: RefreshState,
  error: unknown,
  token: string | null = null,
): void {
  state.failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  state.failedQueue = [];
}

function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
  });

  async function performTokenRefresh(): Promise<string | null> {
    const { data } = await client.post<{ accessToken?: string }>("/auth/refresh");
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      return data.accessToken;
    }
    return null;
  }

  function getOrStartProactiveRefresh(): Promise<string | null> {
    const state = getRefreshState(client);
    if (state.proactiveRefreshPromise) {
      return state.proactiveRefreshPromise;
    }
    state.proactiveRefreshPromise = performTokenRefresh().finally(() => {
      state.proactiveRefreshPromise = null;
    });
    return state.proactiveRefreshPromise;
  }

  client.interceptors.request.use(async (config) => {
    if (!config.headers) {
      config.headers = {} as AxiosRequestHeaders;
    }
    config.headers["Accept-Language"] = i18n.language || "en";

    if (config.url?.includes("/auth/refresh")) {
      return config;
    }

    const token = getAccessToken();
    if (token) {
      if (isTokenExpired(token)) {
        try {
          const newToken = await getOrStartProactiveRefresh();
          if (newToken) {
            config.headers["Authorization"] = `Bearer ${newToken}`;
          }
        } catch {
          // Response interceptor handles cleanup on 401.
        }
      } else {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };
      const refreshState = getRefreshState(client);

      if (isAuthEndpoint(originalRequest?.url)) {
        if (error.response?.status === 401) {
          clearAuthAndRedirect();
        }
        return Promise.reject(error);
      }

      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        if (refreshState.isRefreshing) {
          return new Promise((resolve, reject) => {
            refreshState.failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              if (originalRequest.headers && token) {
                originalRequest.headers["Authorization"] = `Bearer ${token}`;
              }
              return client(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        refreshState.isRefreshing = true;

        try {
          const newToken = await performTokenRefresh();
          if (!newToken) throw new Error("Token refresh failed");

          if (originalRequest.headers) {
            originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
          }

          processQueue(refreshState, null, newToken);
          refreshState.isRefreshing = false;
          return client(originalRequest);
        } catch (refreshError) {
          refreshState.isRefreshing = false;
          processQueue(refreshState, refreshError, null);
          clearAuthAndRedirect();
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

export const adminApi = createApiClient(ADMIN_API_BASE_URL);
export const api = adminApi;
