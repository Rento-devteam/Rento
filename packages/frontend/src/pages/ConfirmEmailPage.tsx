import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../lib/apiClient'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../auth/authApi'
import { BrandLogo } from '../components/BrandLogo'

type Status = 'loading' | 'ok' | 'err'

export function ConfirmEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { applyAuthSuccess } = useAuth()
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'err')
  const [message, setMessage] = useState<string | null>(
    token ? null : 'В ссылке нет токена подтверждения.',
  )

  useEffect(() => {
    if (!token) return
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await authApi.confirmEmail(token, { signal: ac.signal })
        applyAuthSuccess(res)
        setStatus('ok')
        setMessage('Email подтверждён — добро пожаловать в Rento.')
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('err')
        setMessage(err instanceof ApiError ? err.message : 'Не удалось подтвердить email.')
      }
    })()
    return () => ac.abort()
  }, [token, applyAuthSuccess])

  return (
    <div className="confirm">
      <div className="confirm__card">
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <BrandLogo />
        </div>

        {status === 'loading' ? (
          <>
            <div className="confirm__icon" aria-hidden>
              <SpinnerIcon />
            </div>
            <h1 className="confirm__title">Проверяем ссылку…</h1>
            <p className="confirm__msg">Это займёт пару секунд.</p>
          </>
        ) : null}

        {status === 'ok' ? (
          <>
            <div className="confirm__icon confirm__icon--success" aria-hidden>
              <CheckIcon />
            </div>
            <h1 className="confirm__title">Готово!</h1>
            <p className="confirm__msg">{message}</p>
            <Link className="btn btn--primary btn--block" to="/">
              На главную
            </Link>
          </>
        ) : null}

        {status === 'err' ? (
          <>
            <div className="confirm__icon confirm__icon--error" aria-hidden>
              <AlertIcon />
            </div>
            <h1 className="confirm__title">Не получилось</h1>
            <p className="confirm__msg">{message}</p>
            <Link className="btn btn--primary btn--block" to="/register">
              К регистрации
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12l4 4 10-10" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 7v6" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  )
}
