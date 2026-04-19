import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../lib/apiClient'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../auth/authApi'
import { isStrongPassword, PASSWORD_HINT } from '../auth/passwordPolicy'
import { AppIconSlot } from '../components/AppIconSlot'
import { AuthFigmaShell } from '../components/AuthFigmaShell'
import { IconTelegram } from '../components/oauthIcons'

function telegramBotUrl(): string {
  return import.meta.env.VITE_TELEGRAM_BOT_DEEPLINK ?? 'https://t.me/rento_bot'
}

type Step = 'form' | 'telegram'

export function RegisterPage() {
  const { register } = useAuth()
  const [step, setStep] = useState<Step>('form')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendFeedback, setResendFeedback] = useState<{
    type: 'ok' | 'err'
    text: string
  } | null>(null)
  const [resendPending, setResendPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirm) {
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
        confirm,
        fullName.trim() ? fullName.trim() : undefined,
      )
      setSuccess(
        'Аккаунт создан. Проверьте почту и перейдите по ссылке для подтверждения.',
      )
      setResendEmail(email)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Не удалось зарегистрироваться')
      }
    } finally {
      setPending(false)
    }
  }

  async function onResend(e: FormEvent) {
    e.preventDefault()
    setResendFeedback(null)
    setResendPending(true)
    try {
      const r = await authApi.resendConfirmation(resendEmail)
      setResendFeedback({ type: 'ok', text: r.message })
    } catch (err) {
      if (err instanceof ApiError) {
        setResendFeedback({ type: 'err', text: err.message })
      } else {
        setResendFeedback({ type: 'err', text: 'Не удалось отправить письмо' })
      }
    } finally {
      setResendPending(false)
    }
  }

  return (
    <AuthFigmaShell showLogo={step !== 'telegram'}>
      {step === 'telegram' ? (
        <>
          <AppIconSlot />
          <h1 className="auth-figma-title">Продолжить с помощью</h1>
          <p className="auth-figma-hint" style={{ textAlign: 'center', marginBottom: 16 }}>
            Регистрация выполняется в Telegram-боте. Нажмите кнопку ниже.
          </p>
          <div className="auth-figma-oauth-list">
            <a
              className="auth-figma-oauth-row"
              href={telegramBotUrl()}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <span className="auth-figma-oauth-icon">
                <IconTelegram />
              </span>
              Зарегистрироваться через Telegram
            </a>
          </div>
          <button
            type="button"
            className="auth-figma-btn-lime"
            onClick={() => setStep('form')}
          >
            Назад
          </button>
        </>
      ) : (
        <>
          <h1 className="auth-figma-title">Регистрация</h1>

          {error ? (
            <div className="auth-figma-alert auth-figma-alert--err">{error}</div>
          ) : null}
          {success ? (
            <div className="auth-figma-alert auth-figma-alert--ok">{success}</div>
          ) : null}

          {!success ? (
            <form onSubmit={onSubmit} className="auth-figma-fields">
              <div className="auth-figma-field">
                <label htmlFor="reg-name">Имя пользователя</label>
                <input
                  id="reg-name"
                  className="auth-figma-input"
                  type="text"
                  autoComplete="nickname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Как к вам обращаться"
                />
              </div>
              <div className="auth-figma-field">
                <label htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  className="auth-figma-input"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="auth-figma-field">
                <label htmlFor="reg-password">Пароль</label>
                <input
                  id="reg-password"
                  className="auth-figma-input"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="auth-figma-hint">{PASSWORD_HINT}</p>
              </div>
              <div className="auth-figma-field">
                <label htmlFor="reg-confirm">Подтвердите пароль</label>
                <input
                  id="reg-confirm"
                  className="auth-figma-input"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <div className="auth-figma-stack">
                <button type="submit" className="auth-figma-btn-primary" disabled={pending}>
                  {pending ? 'Отправка…' : 'Зарегистрироваться'}
                </button>
                <button
                  type="button"
                  className="auth-figma-btn-lime"
                  onClick={() => setStep('telegram')}
                >
                  Войти другим способом
                </button>
              </div>
            </form>
          ) : null}

          {success ? (
            <form onSubmit={onResend} className="auth-figma-fields">
              <p className="auth-figma-section-title">Отправить письмо ещё раз</p>
              <div className="auth-figma-field">
                <label htmlFor="resend-email">Email</label>
                <input
                  id="resend-email"
                  className="auth-figma-input"
                  type="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </div>
              {resendFeedback ? (
                <div
                  className={`auth-figma-alert ${
                    resendFeedback.type === 'err'
                      ? 'auth-figma-alert--err'
                      : 'auth-figma-alert--ok'
                  }`}
                >
                  {resendFeedback.text}
                </div>
              ) : null}
              <div className="auth-figma-stack">
                <button
                  type="submit"
                  className="auth-figma-btn-primary"
                  disabled={resendPending}
                >
                  {resendPending ? 'Отправка…' : 'Отправить снова'}
                </button>
              </div>
            </form>
          ) : null}

          {!success ? (
            <Link className="auth-figma-link" to="/login">
              У меня уже есть аккаунт
            </Link>
          ) : (
            <Link className="auth-figma-link" to="/login">
              Перейти ко входу
            </Link>
          )}
        </>
      )}
    </AuthFigmaShell>
  )
}
