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
          <nav className="app-header__nav" aria-label="Разделы">
            <button type="button">Каталог</button>
            <button type="button">Как это работает</button>
            <button type="button">Поддержка</button>
          </nav>
        </div>

        <div className="app-header__right">
          <button type="button" className="icon-btn" aria-label="Добавить объявление" onClick={() => navigate('/create-item')}>
            <PlusIcon />
          </button>
          <button type="button" className="icon-btn" aria-label="Сообщения">
            <ChatIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Мои бронирования"
            title="Мои бронирования"
            onClick={goBookings}
          >
            <CartIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Брони по моим объявлениям"
            title="Брони по моим объявлениям"
            onClick={goHostingBookings}
          >
            <HostBookingsIcon />
          </button>
          <button type="button" className="icon-btn" aria-label="Избранное">
            <HeartIcon />
          </button>

          {user ? (
            <button
              type="button"
              className="btn btn--ghost"
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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 5h16v11H9l-5 4V5z" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 5h3l2 10h10l3-7H7" />
      <circle cx="10" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  )
}

function HostBookingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  )
}
