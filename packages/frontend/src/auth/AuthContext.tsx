import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "../lib/apiClient";
import { authApi } from "./authApi";
import {
  AUTH_SESSION_CHANGED_EVENT,
  clearSession,
  loadSession,
  saveSession,
  updateStoredUser,
} from "./authStorage";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from "./auth-context";
import type { AuthUser } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const session = loadSession();
    if (!session) {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
      };
    }

    return {
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      loading: true,
    };
  });

  const applyAuthSuccess = useCallback(
    (payload: {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }) => {
      saveSession(payload);
      setState((s) => ({
        ...s,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
      }));
    },
    [],
  );

  const logout = useCallback(() => {
    const session = loadSession();
    if (session?.refreshToken) {
      void authApi.logout(session.refreshToken).catch(() => undefined);
    }
    clearSession();
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      loading: false,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) return;
    try {
      const user = await authApi.getCurrentUser(session.accessToken);
      updateStoredUser(user);
      setState((s) => ({ ...s, user }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout();
      }
    }
  }, [logout]);

  useEffect(() => {
    function syncSessionFromStorage() {
      const session = loadSession();
      if (!session) {
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          loading: false,
        });
        return;
      }

      setState((s) => ({
        ...s,
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        loading: false,
      }));
    }

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncSessionFromStorage);
    return () =>
      window.removeEventListener(
        AUTH_SESSION_CHANGED_EVENT,
        syncSessionFromStorage,
      );
  }, []);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const user = await authApi.getCurrentUser(session.accessToken);
        if (cancelled) return;
        updateStoredUser(user);
        const currentSession = loadSession();
        setState({
          user,
          accessToken: currentSession?.accessToken ?? session.accessToken,
          refreshToken: currentSession?.refreshToken ?? session.refreshToken,
          loading: false,
        });
      } catch {
        if (cancelled) return;
        clearSession();
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          loading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login({ email, password });
      applyAuthSuccess(res);
    },
    [applyAuthSuccess],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      confirmPassword: string,
      fullName?: string,
    ) => {
      await authApi.register({
        email,
        password,
        confirmPassword,
        ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
      });
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      applyAuthSuccess,
      logout,
      refreshProfile,
    }),
    [state, login, register, applyAuthSuccess, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
