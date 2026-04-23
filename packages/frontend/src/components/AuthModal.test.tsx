import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthModal } from './AuthModal'

vi.mock('../auth/reloadAfterLogin', () => ({
  reloadHomeAfterLogin: vi.fn(),
}))

import { reloadHomeAfterLogin } from '../auth/reloadAfterLogin'

const login = vi.fn()
const register = vi.fn()
const applyAuthSuccess = vi.fn()
const logout = vi.fn()
const refreshProfile = vi.fn()

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: false,
    login,
    register,
    applyAuthSuccess,
    logout,
    refreshProfile,
  }),
}))

vi.mock('../auth/authApi', () => ({
  authApi: {
    resendConfirmation: vi.fn().mockResolvedValue({ message: 'ok' }),
  },
}))

describe('AuthModal', () => {
  const onClose = vi.fn()
  const onTabChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    login.mockResolvedValue(undefined)
    register.mockResolvedValue(undefined)
  })

  it('shows login fields when initialTab is login', () => {
    render(
      <AuthModal initialTab="login" onClose={onClose} onTabChange={onTabChange} />,
    )
    expect(screen.getByRole('heading', { name: /^вход$/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^пароль$/i)).toBeInTheDocument()
  })

  it('switches to register tab and notifies onTabChange', async () => {
    const user = userEvent.setup()
    render(
      <AuthModal initialTab="login" onClose={onClose} onTabChange={onTabChange} />,
    )
    await user.click(screen.getByRole('button', { name: /зарегистрироваться/i }))
    expect(onTabChange).toHaveBeenCalledWith('register')
    expect(screen.getByRole('heading', { name: /^регистрация$/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/подтвердите пароль/i)).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(
      <AuthModal initialTab="login" onClose={onClose} onTabChange={onTabChange} />,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when close button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <AuthModal initialTab="login" onClose={onClose} onTabChange={onTabChange} />,
    )
    await user.click(screen.getByRole('button', { name: /закрыть/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('submits login and reloads home so catalog uses the new session', async () => {
    const user = userEvent.setup()
    render(
      <AuthModal initialTab="login" onClose={onClose} onTabChange={onTabChange} />,
    )
    await user.type(screen.getByLabelText(/email/i), 'a@b.c')
    await user.type(screen.getByLabelText(/^пароль$/i), 'Secret1!')
    await user.click(screen.getByRole('button', { name: /^войти$/i }))
    expect(login).toHaveBeenCalledWith('a@b.c', 'Secret1!')
    expect(vi.mocked(reloadHomeAfterLogin)).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
