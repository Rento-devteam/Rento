import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface AuthFigmaShellProps {
  children: ReactNode
  /** Показать фирменный знак под кнопкой закрытия */
  showLogo?: boolean
}

export function AuthFigmaShell({ children, showLogo = true }: AuthFigmaShellProps) {
  const navigate = useNavigate()

  return (
    <div className="auth-figma-page">
      <div className="auth-figma-modal">
        <button
          type="button"
          className="auth-figma-close"
          onClick={() => navigate('/')}
          aria-label="Закрыть"
        >
          ×
        </button>
        {showLogo ? (
          <div className="auth-figma-logo-wrap">
            <img src="/Logo.svg" alt="" className="rento-auth-logo-image" />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
