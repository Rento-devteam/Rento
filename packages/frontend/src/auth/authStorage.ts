import type { AuthUser } from './types'

const ACCESS_KEY = 'rento_access_token'
const REFRESH_KEY = 'rento_refresh_token'
const USER_KEY = 'rento_user_snapshot'

export interface StoredSession {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(ACCESS_KEY, session.accessToken)
  localStorage.setItem(REFRESH_KEY, session.refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

export function loadSession(): StoredSession | null {
  const accessToken = localStorage.getItem(ACCESS_KEY)
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  const rawUser = localStorage.getItem(USER_KEY)
  if (!accessToken || !refreshToken || !rawUser) {
    return null
  }
  try {
    const user = JSON.parse(rawUser) as AuthUser
    return { accessToken, refreshToken, user }
  } catch {
    clearSession()
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

export function updateStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
