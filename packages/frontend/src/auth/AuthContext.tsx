import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError } from '../lib/apiClient'
import { authApi } from './authApi'
import {
  clearSession,
  loadSession,
  saveSession,
  updateStoredUser,
} from './authStorage'
import type { AuthUser } from './types'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    confirmPassword: string,
    fullName?: string,
  ) => Promise<void>
  applyAuthSuccess: (payload: {
    accessToken: string
    refreshToken: string
    user: AuthUser
  }) => void
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const session = loadSession()
    if (!session) {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
      }
    }

    return {
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      loading: true,
    }
  })

  const applyAuthSuccess = useCallback(
    (payload: {
      accessToken: string
      refreshToken: string
      user: AuthUser
    }) => {
      saveSession(payload)
      setState((s) => ({
        ...s,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
      }))
    },
    [],
  )

  const logout = useCallback(() => {
    clearSession()
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      loading: false,
    })
  }, [])

  const refreshProfile = useCallback(async () => {
    const session = loadSession()
    if (!session?.accessToken) return
    try {
      const user = await authApi.getCurrentUser(session.accessToken)
      updateStoredUser(user)
      setState((s) => ({ ...s, user }))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logout()
      }
    }
  }, [logout])

  useEffect(() => {
    const session = loadSession()
    if (!session) {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const user = await authApi.getCurrentUser(session.accessToken)
        if (cancelled) return
        updateStoredUser(user)
        setState({
          user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          loading: false,
        })
      } catch {
        if (cancelled) return
        clearSession()
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          loading: false,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    applyAuthSuccess(res)
  }, [applyAuthSuccess])

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
      })
    },
    [],
  )

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
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
