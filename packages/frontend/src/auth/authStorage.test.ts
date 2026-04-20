import { beforeEach, describe, expect, it } from 'vitest'
import type { AuthUser } from './types'
import { clearSession, loadSession, saveSession, updateStoredUser } from './authStorage'

const user: AuthUser = {
  id: 'u1',
  email: 'a@b.c',
  fullName: 'Test',
  phone: null,
  avatarUrl: null,
  role: 'USER',
  status: 'ACTIVE',
  isVerified: true,
}

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saveSession and loadSession roundtrip', () => {
    saveSession({ accessToken: 'acc', refreshToken: 'ref', user })
    expect(loadSession()).toEqual({
      accessToken: 'acc',
      refreshToken: 'ref',
      user,
    })
  })

  it('clearSession removes keys', () => {
    saveSession({ accessToken: 'a', refreshToken: 'r', user })
    clearSession()
    expect(loadSession()).toBeNull()
  })

  it('updateStoredUser changes snapshot', () => {
    saveSession({ accessToken: 'a', refreshToken: 'r', user })
    const next: AuthUser = { ...user, fullName: 'Renamed' }
    updateStoredUser(next)
    expect(loadSession()?.user.fullName).toBe('Renamed')
  })

  it('loadSession returns null on corrupt JSON', () => {
    localStorage.setItem('rento_access_token', 'x')
    localStorage.setItem('rento_refresh_token', 'y')
    localStorage.setItem('rento_user_snapshot', '{not json')
    expect(loadSession()).toBeNull()
    expect(localStorage.getItem('rento_access_token')).toBeNull()
  })
})
