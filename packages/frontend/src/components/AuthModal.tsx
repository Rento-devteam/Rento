import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { reloadHomeAfterLogin } from '../auth/reloadAfterLogin'
import { authApi } from '../auth/authApi'
import { isStrongPassword, PASSWORD_HINT } from '../auth/passwordPolicy'
import { ApiError } from '../lib/apiClient'
import { LOGO_SRC } from './BrandLogo'
import { IconTelegram } from './oauthIcons'

export type AuthTab = 'login' | 'register' | 'telegram'

interface AuthModalProps {
  initialTab: AuthTab
  onClose: () => void
  onTabChange: (tab: AuthTab) => void
}

export function AuthModal({ initialTab, onClose, onTabChange }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function switchTab(next: AuthTab) {
    setTab(next)
    onTabChange(next)
  }

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Вход или регистрация"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal__dialog">
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
          <CloseIcon />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
          <img src={LOGO_SRC} alt="Rento" style={{ width: 80, height: 80, marginBottom: 'var(--sp-4)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }} />
          <h2 className="modal__title" style={{ margin: 0, textAlign: 'center', fontSize: '1.8rem' }}>
            {tab === 'login' ? 'Вход' : tab === 'register' ? 'Регистрация' : 'Вход через Telegram'}
          </h2>
        </div>

        {tab === 'login' ? <LoginForm onSwitch={switchTab} /> : null}
        {tab === 'register' ? <RegisterForm onSwitch={switchTab} /> : null}
        {tab === 'telegram' ? <TelegramPanel onSwitch={switchTab} /> : null}

      </div>
    </div>
  )
}

function LoginForm({ onSwitch }: { onSwitch: (tab: AuthTab) => void }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})
    setPending(true)
    try {
      await login(email, password)
      reloadHomeAfterLogin()
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors({
          email: err.fields.email,
          password: err.fields.password,
        })
        setError(err.message)
      } else {
        setError(err instanceof ApiError ? err.message : 'Не удалось выполнить вход')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <div className="field">
        <label className="field__label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="field__input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setFieldErrors((f) => ({ ...f, email: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.email)}
        />
        {fieldErrors.email ? (
          <p className="field__error" role="alert">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label className="field__label" htmlFor="login-password">
          Пароль
        </label>
        <input
          id="login-password"
          className="field__input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setFieldErrors((f) => ({ ...f, password: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.password)}
        />
        {fieldErrors.password ? (
          <p className="field__error" role="alert">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>
      <div className="stack" style={{ marginTop: 'var(--sp-5)' }}>
        <button type="submit" className="btn btn--brand btn--block" disabled={pending}>
          {pending ? 'Входим…' : 'Войти'}
        </button>
      </div>

      <div className="divider-or">Или войти через</div>
      <button
        type="button"
        className="oauth-btn"
        style={{ width: '100%' }}
        onClick={() => onSwitch('telegram')}
      >
        <IconTelegram />
        Telegram
      </button>

      <div className="modal__footnote" style={{ marginTop: 'var(--sp-5)' }}>
        Нет аккаунта? <button type="button" onClick={() => onSwitch('register')}>Зарегистрироваться</button>
      </div>
    </form>
  )
}

function RegisterForm({ onSwitch }: { onSwitch: (tab: AuthTab) => void }) {
  const { register } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string
    email?: string
    password?: string
    confirmPassword?: string
  }>({})
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const [resendEmail, setResendEmail] = useState('')
  const [resendFeedback, setResendFeedback] = useState<string | null>(null)
  const [resendPending, setResendPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})
    setSuccess(null)

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Пароли не совпадают' })
      return
    }
    if (!isStrongPassword(password)) {
      setFieldErrors({ password: PASSWORD_HINT })
      return
    }

    setPending(true)
    try {
      await register(
        email,
        password,
        confirmPassword,
        fullName.trim() ? fullName.trim() : undefined,
      )
      setSuccess('Аккаунт создан. Подтвердите email по ссылке из письма.')
      setResendEmail(email)
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors({
          fullName: err.fields.fullName,
          email: err.fields.email,
          password: err.fields.password,
          confirmPassword: err.fields.confirmPassword,
        })
        setError(err.message)
      } else {
        setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться')
      }
    } finally {
      setPending(false)
    }
  }

  async function onResend(event: FormEvent) {
    event.preventDefault()
    setResendFeedback(null)
    setResendPending(true)
    try {
      const result = await authApi.resendConfirmation(resendEmail)
      setResendFeedback(result.message)
    } catch (err) {
      setResendFeedback(err instanceof ApiError ? err.message : 'Не удалось отправить письмо')
    } finally {
      setResendPending(false)
    }
  }

  if (success) {
    return (
      <form onSubmit={onResend}>
        <div className="alert alert--success">{success}</div>
        <div className="field">
          <label className="field__label" htmlFor="resend-email">
            Email для повторной отправки
          </label>
          <input
            id="resend-email"
            className="field__input"
            type="email"
            required
            value={resendEmail}
            onChange={(event) => setResendEmail(event.target.value)}
          />
        </div>
        {resendFeedback ? <div className="alert alert--success">{resendFeedback}</div> : null}
        <div className="stack">
          <button type="submit" className="btn btn--primary btn--block" disabled={resendPending}>
            {resendPending ? 'Отправляем…' : 'Отправить письмо ещё раз'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => onSwitch('login')}
          >
            Перейти ко входу
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <div className="field">
        <label className="field__label" htmlFor="reg-name">
          Имя пользователя
        </label>
        <input
          id="reg-name"
          className="field__input"
          type="text"
          autoComplete="nickname"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value)
            setFieldErrors((f) => ({ ...f, fullName: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.fullName)}
        />
        {fieldErrors.fullName ? (
          <p className="field__error" role="alert">
            {fieldErrors.fullName}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label className="field__label" htmlFor="reg-email">
          Email
        </label>
        <input
          id="reg-email"
          className="field__input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setFieldErrors((f) => ({ ...f, email: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.email)}
        />
        {fieldErrors.email ? (
          <p className="field__error" role="alert">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label className="field__label" htmlFor="reg-password">
          Пароль
        </label>
        <input
          id="reg-password"
          className="field__input"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setFieldErrors((f) => ({ ...f, password: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.password)}
        />
        {fieldErrors.password ? (
          <p className="field__error" role="alert">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label className="field__label" htmlFor="reg-confirm">
          Подтвердите пароль
        </label>
        <input
          id="reg-confirm"
          className="field__input"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value)
            setFieldErrors((f) => ({ ...f, confirmPassword: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
        />
        {fieldErrors.confirmPassword ? (
          <p className="field__error" role="alert">
            {fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>
      <div className="stack" style={{ marginTop: 'var(--sp-5)' }}>
        <button type="submit" className="btn btn--brand btn--block" disabled={pending}>
          {pending ? 'Создаём…' : 'Зарегистрироваться'}
        </button>
      </div>

      <div className="divider-or">Или войти через</div>
      <button
        type="button"
        className="oauth-btn"
        style={{ width: '100%' }}
        onClick={() => onSwitch('telegram')}
      >
        <IconTelegram />
        Telegram
      </button>

      <div className="modal__footnote" style={{ marginTop: 'var(--sp-5)' }}>
        Уже есть аккаунт? <button type="button" onClick={() => onSwitch('login')}>Войти</button>
      </div>
    </form>
  )
}

function TelegramPanel({ onSwitch }: { onSwitch: (tab: AuthTab) => void }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onTelegramStart() {
    setError(null)
    setPending(true)
    try {
      const res = await authApi.telegramLoginStart({ redirectUrl: '/telegram/callback' })
      window.open(res.deepLink, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось открыть Telegram')
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <p className="field__hint" style={{ marginBottom: 16, textAlign: 'center' }}>
        Откройте Telegram-бота — он подтвердит вашу личность и вернёт вас в приложение.
      </p>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <button type="button" className="oauth-btn" style={{ width: '100%' }} onClick={onTelegramStart} disabled={pending}>
        <IconTelegram />
        {pending ? 'Открываем…' : 'Открыть Telegram-бота'}
      </button>
      <div className="stack">
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => onSwitch('login')}
        >
          Войти по email
        </button>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
