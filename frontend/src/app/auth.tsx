import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  AuthState,
  getAuthBootstrap,
  loginLocal,
  LoginLocalPayload,
  logout,
  registerLocal,
  RegisterLocalPayload,
} from "./api";

interface AuthContextValue {
  authState: AuthState | null;
  loading: boolean;
  error: string;
  register: (payload: RegisterLocalPayload) => Promise<void>;
  login: (payload: LoginLocalPayload) => Promise<void>;
  logoutCurrentUser: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const state = await getAuthBootstrap();
      setAuthState(state);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load auth state.");
      setAuthState(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function register(payload: RegisterLocalPayload) {
    setLoading(true);
    setError("");
    try {
      const state = await registerLocal(payload);
      setAuthState(state);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create account.");
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  async function login(payload: LoginLocalPayload) {
    setLoading(true);
    setError("");
    try {
      const state = await loginLocal(payload);
      setAuthState(state);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to login.");
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  async function logoutCurrentUser() {
    setLoading(true);
    setError("");
    try {
      const state = await logout();
      setAuthState(state);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to logout.");
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      loading,
      error,
      register,
      login,
      logoutCurrentUser,
      refresh,
    }),
    [authState, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
