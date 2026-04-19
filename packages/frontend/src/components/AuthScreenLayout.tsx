import type { ReactNode } from 'react'

interface AuthScreenLayoutProps {
  children: ReactNode
  /** Подзаголовок слева под логотипом (разные экраны) */
  asideHint?: string
}

export function AuthScreenLayout({ children, asideHint }: AuthScreenLayoutProps) {
  return (
    <div className="auth-screen">
      <div className="auth-screen__aside">
        <div className="auth-screen__aside-inner">
          <p className="auth-screen__brand">Rento</p>
          <h2 className="auth-screen__headline">Аренда без лишних сложностей</h2>
          <p className="auth-screen__sub">
            {asideHint ??
              'Войдите или создайте аккаунт — управляйте объявлениями и бронированиями в одном месте.'}
          </p>
        </div>
        <div className="auth-screen__blob auth-screen__blob--1" aria-hidden />
        <div className="auth-screen__blob auth-screen__blob--2" aria-hidden />
      </div>
      <div className="auth-screen__main">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  )
}
