import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { BrandLogo } from './BrandLogo'
import type { AuthTab } from './AuthModal'

interface AppHeaderProps {
  onAuthRequest: (tab: AuthTab) => void
}

export function AppHeader({ onAuthRequest }: AppHeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const goBookings = () => {
    if (user) navigate('/bookings')
    else onAuthRequest('login')
  }

  const goHostingBookings = () => {
    if (user) navigate('/bookings/hosting')
    else onAuthRequest('login')
  }

  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <div className="app-header__left">
          <BrandLogo />
        </div>

        <div className="app-header__right">
          <button type="button" className="icon-btn" aria-label="Добавить объявление" onClick={() => navigate('/create-item')}>
            <PlusIcon />
          </button>
          <button
            type="button"
            className="btn btn--ghost app-header__compact"
            onClick={goBookings}
          >
            Арендую
          </button>
          <button
            type="button"
            className="btn btn--ghost app-header__compact"
            onClick={goHostingBookings}
          >
            Сдаю
          </button>

          {user ? (
            <button
              type="button"
              className="btn btn--primary app-header__compact"
              onClick={() => navigate('/profile')}
              aria-label="Профиль"
            >
              {user.fullName ?? user.email ?? 'Профиль'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onAuthRequest('login')}
              >
                Войти
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onAuthRequest('register')}
              >
                Регистрация
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

