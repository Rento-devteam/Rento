import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../lib/apiClient'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../auth/authApi'
import { AuthFigmaShell } from '../components/AuthFigmaShell'

export function ConfirmEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { applyAuthSuccess } = useAuth()
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>(
    token ? 'loading' : 'err',
  )
  const [message, setMessage] = useState<string | null>(
    token ? null : 'В ссылке нет токена подтверждения.',
  )

  useEffect(() => {
    if (!token) {
      return
    }

    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await authApi.confirmEmail(token, { signal: ac.signal })
        applyAuthSuccess(res)
        setStatus('ok')
        setMessage('Email подтверждён, вы вошли в аккаунт.')
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        setStatus('err')
        if (err instanceof ApiError) {
          setMessage(err.message)
        } else {
          setMessage('Не удалось подтвердить email.')
        }
      }
    })()

    return () => ac.abort()
  }, [token, applyAuthSuccess])

  return (
    <AuthFigmaShell>
      <h1 className="auth-figma-title">Подтверждение email</h1>
      {status === 'loading' ? (
        <p className="auth-figma-hint" style={{ textAlign: 'center' }}>
          Проверяем ссылку…
        </p>
      ) : null}
      {status === 'ok' ? (
        <>
          <div className="auth-figma-alert auth-figma-alert--ok">{message}</div>
          <div className="auth-figma-stack">
            <Link className="auth-figma-btn-primary" to="/" style={{ textDecoration: 'none' }}>
              На главную
            </Link>
          </div>
        </>
      ) : null}
      {status === 'err' ? (
        <>
          <div className="auth-figma-alert auth-figma-alert--err">{message}</div>
          <p className="auth-figma-hint" style={{ textAlign: 'center', marginBottom: 12 }}>
            Запросите новое письмо на странице регистрации или войдите, если уже подтверждали ранее.
          </p>
          <Link className="auth-figma-link" to="/register">
            К регистрации
          </Link>
        </>
      ) : null}
    </AuthFigmaShell>
  )
}
