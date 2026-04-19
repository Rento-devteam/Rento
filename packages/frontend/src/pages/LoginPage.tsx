import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/apiClient'
import { useAuth } from '../auth/AuthContext'
import { AuthFigmaShell } from '../components/AuthFigmaShell'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Не удалось выполнить вход')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthFigmaShell>
      <h1 className="auth-figma-title">Вход</h1>
      <p className="auth-figma-hint" style={{ textAlign: 'center', marginBottom: 16 }}>
        Введите email и пароль. Если аккаунт не подтверждён, перейдите по ссылке из письма.
      </p>
      {error ? (
        <div className="auth-figma-alert auth-figma-alert--err">{error}</div>
      ) : null}
      <form onSubmit={onSubmit} className="auth-figma-fields">
        <div className="auth-figma-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="auth-figma-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="auth-figma-field">
          <label htmlFor="login-password">Пароль</label>
          <input
            id="login-password"
            className="auth-figma-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="auth-figma-stack">
          <button type="submit" className="auth-figma-btn-primary" disabled={pending}>
            {pending ? 'Вход…' : 'Войти'}
          </button>
        </div>
      </form>
      <Link className="auth-figma-link" to="/register">
        Нет аккаунта? Зарегистрироваться
      </Link>
    </AuthFigmaShell>
  )
}
