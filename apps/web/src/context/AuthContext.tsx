import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentAdminRequest,
  loginRequest,
  logoutRequest,
  mapToAdminUser,
  refreshTokenRequest,
  verifyOtpRequest,
  type LoginRequest,
} from "@/api/auth";
import { isDemoMode } from "@/api/client";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  setAccessToken,
  setStoredUser,
  type AdminUser,
} from "@/lib/auth-storage";
import { isTokenExpired, isValidToken } from "@/lib/token-utils";

interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginRequest) => Promise<"SUCCESS" | "REQUIRES_ACTIVATION">;
  verifyOtp: (email: string, otpCode: number) => Promise<void>;
  establishSession: (accessToken: string, user: AdminUser) => void;
  logout: () => Promise<void>;
  activationEmail: string | null;
  setActivationEmail: (email: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activationEmail, setActivationEmail] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = getStoredUser();
        const token = getAccessToken();

        if (!storedUser || !token) return;

        if (isDemoMode && token === "demo-token") {
          setUser(storedUser);
          return;
        }

        if (isValidToken(token)) {
          setUser(storedUser);
          try {
            const me = await getCurrentAdminRequest();
            setStoredUser(me);
            setUser(me);
          } catch {
            // Keep cached user when /auth/me is unavailable.
          }
          return;
        }

        if (isTokenExpired(token)) {
          try {
            const response = await refreshTokenRequest();
            if (response.accessToken) {
              const nextUser = mapToAdminUser(response);
              setAccessToken(response.accessToken);
              setStoredUser(nextUser);
              setUser(nextUser);
            }
          } catch {
            clearSession();
          }
          return;
        }

        clearSession();
      } finally {
        setLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  const establishSession = useCallback((accessToken: string, nextUser: AdminUser) => {
    setAccessToken(accessToken);
    setStoredUser(nextUser);
    setUser(nextUser);
    setActivationEmail(null);
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const result = await loginRequest(payload);
    if (result.type === "REQUIRES_ACTIVATION") {
      setActivationEmail(result.email);
      return "REQUIRES_ACTIVATION";
    }
    establishSession(result.accessToken, result.user);
    return "SUCCESS";
  }, [establishSession]);

  const verifyOtp = useCallback(async (email: string, otpCode: number) => {
    const response = await verifyOtpRequest({ email, otpCode });
    establishSession(
      response.accessToken,
      mapToAdminUser(response),
    );
  }, [establishSession]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Local session is cleared regardless.
    } finally {
      clearSession();
      setUser(null);
      setActivationEmail(null);
      window.location.href = "/login";
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user && getAccessToken()),
      loading,
      login,
      verifyOtp,
      establishSession,
      logout,
      activationEmail,
      setActivationEmail,
    }),
    [user, loading, login, verifyOtp, establishSession, logout, activationEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
