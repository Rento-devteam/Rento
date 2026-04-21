import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../auth/authApi'
import { authService } from '../auth/authService'
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

        <div className="modal__brand">
          <span className="brand__mark brand__mark--sm" aria-hidden>
            <img src={LOGO_SRC} alt="" className="brand__mark-img" width={26} height={26} />
          </span>
          <span className="modal__brand-name">Rento</span>
        </div>

        <h2 className="modal__title">
          {tab === 'login' ? 'Вход в аккаунт' : tab === 'register' ? 'Создание аккаунта' : 'Быстрый вход'}
        </h2>
        <p className="modal__subtitle">
          {tab === 'login'
            ? 'Введите почту и пароль или войдите через Telegram.'
            : tab === 'register'
              ? 'Зарегистрируйтесь по email и подтвердите его по ссылке из письма.'
              : 'Откройте нашего Telegram-бота — он авторизует вас автоматически.'}
        </p>

        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'login'}
            className={tab === 'login' ? 'is-active' : ''}
            onClick={() => switchTab('login')}
          >
            Вход
          </button>
          <button
            role="tab"
            aria-selected={tab === 'register'}
            className={tab === 'register' ? 'is-active' : ''}
            onClick={() => switchTab('register')}
          >
            Регистрация
          </button>
          <button
            role="tab"
            aria-selected={tab === 'telegram'}
            className={tab === 'telegram' ? 'is-active' : ''}
            onClick={() => switchTab('telegram')}
          >
            Telegram
          </button>
        </div>

        {tab === 'login' ? <LoginForm onSuccess={onClose} onSwitch={switchTab} /> : null}
        {tab === 'register' ? <RegisterForm onSwitch={switchTab} /> : null}
        {tab === 'telegram' ? <TelegramPanel onSwitch={switchTab} /> : null}

        {tab !== 'telegram' ? (
          <>
            <div className="divider-or">или</div>
            <button
              type="button"
              className="oauth-btn"
              onClick={() => switchTab('telegram')}
            >
              <IconTelegram />
              Продолжить через Telegram
            </button>
          </>
        ) : null}

        <div className="modal__footnote">
          {tab === 'login' ? (
            <>
              Нет аккаунта? <button onClick={() => switchTab('register')}>Зарегистрироваться</button>
            </>
          ) : tab === 'register' ? (
            <>
              Уже есть аккаунт? <button onClick={() => switchTab('login')}>Войти</button>
            </>
          ) : (
            <>
              Нужен email вместо Telegram? <button onClick={() => switchTab('login')}>Вход по email</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LoginForm({
  onSuccess,
  onSwitch,
}: {
  onSuccess: () => void
  onSwitch: (tab: AuthTab) => void
}) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await login(email, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить вход')
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
          onChange={(event) => setEmail(event.target.value)}
        />
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
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="stack">
        <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
          {pending ? 'Входим…' : 'Войти'}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => onSwitch('register')}
        >
          Создать аккаунт
        </button>
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
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const [resendEmail, setResendEmail] = useState('')
  const [resendFeedback, setResendFeedback] = useState<string | null>(null)
  const [resendPending, setResendPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }
    if (!isStrongPassword(password)) {
      setError(PASSWORD_HINT)
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
      setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться')
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
          Имя (необязательно)
        </label>
        <input
          id="reg-name"
          className="field__input"
          type="text"
          autoComplete="nickname"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Как к вам обращаться"
        />
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
          onChange={(event) => setEmail(event.target.value)}
        />
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
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="field__hint">{PASSWORD_HINT}</p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="reg-confirm">
          Подтверждение пароля
        </label>
        <input
          id="reg-confirm"
          className="field__input"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      <div className="stack">
        <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
          {pending ? 'Создаём…' : 'Создать аккаунт'}
        </button>
      </div>
    </form>
  )
}

function TelegramPanel({ onSwitch }: { onSwitch: (tab: AuthTab) => void }) {
  return (
    <div>
      <p className="field__hint" style={{ marginBottom: 16, textAlign: 'center' }}>
        Откройте Telegram-бота — он подтвердит вашу личность и вернёт вас в приложение.
      </p>
      <a
        className="oauth-btn"
        href={authService.getTelegramBotUrl()}
        target="_blank"
        rel="noreferrer"
      >
        <IconTelegram />
        Открыть Telegram-бота
      </a>
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
