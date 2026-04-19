import { Link } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__left">
          <BrandLogo />
          <button type="button" className="app-header__admin" disabled>
            Для администратора
          </button>
        </div>
        <div className="app-header__right" aria-label="Панель действий">
          <button type="button" className="app-header__icon-btn" disabled aria-label="Добавить">
            <HeaderIcon kind="plus" />
          </button>
          <button type="button" className="app-header__icon-btn" disabled aria-label="Чат">
            <HeaderIcon kind="chat" />
          </button>
          <button type="button" className="app-header__icon-btn" disabled aria-label="Корзина">
            <HeaderIcon kind="cart" />
          </button>
          <button type="button" className="app-header__icon-btn" disabled aria-label="Избранное">
            <HeaderIcon kind="heart" />
          </button>
          <Link to="/login" className="app-header__auth-link">
            вход/регистрация
          </Link>
        </div>
      </div>
    </header>
  )
}

function HeaderIcon({ kind }: { kind: 'plus' | 'chat' | 'cart' | 'heart' }) {
  if (kind === 'plus') {
    return (
      <svg viewBox="0 0 24 24" className="app-header__icon">
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }
  if (kind === 'chat') {
    return (
      <svg viewBox="0 0 24 24" className="app-header__icon">
        <path d="M4 5h16v11H9l-5 4V5z" />
      </svg>
    )
  }
  if (kind === 'cart') {
    return (
      <svg viewBox="0 0 24 24" className="app-header__icon">
        <path d="M3 5h3l2 10h10l3-7H7" />
        <circle cx="10" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="app-header__icon">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  )
}
