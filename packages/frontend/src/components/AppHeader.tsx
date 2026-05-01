import { useLocation, useNavigate } from 'react-router-dom'
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

  const openProfile = () => {
    if (user) navigate('/profile')
    else onAuthRequest('login')
  }

  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <div className="app-header__left">
          <BrandLogo />
        </div>

        <div className="app-header__right">
          <button
            type="button"
            className="icon-btn app-header__icon-btn app-header__icon-btn--create"
            aria-label="Добавить объявление"
            onClick={() => navigate('/create-item')}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="icon-btn app-header__icon-btn app-header__icon-btn--profile"
            aria-label="Профиль"
            onClick={openProfile}
          >
            <ProfileIcon />
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

export function MobileDock({ onAuthRequest }: AppHeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const goBookings = () => {
    if (user) navigate('/bookings')
    else onAuthRequest('login')
  }

  const goHostingBookings = () => {
    if (user) navigate('/bookings/hosting')
    else onAuthRequest('login')
  }

  const openProfile = () => {
    if (user) navigate('/profile')
    else onAuthRequest('login')
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  return (
    <nav className="mobile-dock" aria-label="Мобильная навигация">
      <button
        type="button"
        className={`mobile-dock__item ${isActive('/') ? 'is-active' : ''}`}
        onClick={() => navigate('/')}
      >
        <HomeIcon />
        <span>Главная</span>
      </button>
      <button
        type="button"
        className={`mobile-dock__item ${isActive('/bookings') ? 'is-active' : ''}`}
        onClick={goBookings}
      >
        <BookingsIcon />
        <span>Арендую</span>
      </button>
      <button type="button" className="mobile-dock__item mobile-dock__item--primary" onClick={() => navigate('/create-item')}>
        <PlusIcon />
        <span>Сдать</span>
      </button>
      <button
        type="button"
        className={`mobile-dock__item ${isActive('/bookings/hosting') ? 'is-active' : ''}`}
        onClick={goHostingBookings}
      >
        <HostIcon />
        <span>Сдаю</span>
      </button>
      <button
        type="button"
        className={`mobile-dock__item ${isActive('/profile') ? 'is-active' : ''}`}
        onClick={openProfile}
      >
        <ProfileIcon />
        <span>Профиль</span>
      </button>
    </nav>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </svg>
  )
}

function BookingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4.5 7.5h15v12h-15z" />
      <path d="M8 4.5v5M16 4.5v5M4.5 11h15" />
    </svg>
  )
}

function HostIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 10l9-6 9 6v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19c1.5-2.7 4-4 6.5-4s5 1.3 6.5 4" />
    </svg>
  )
}

