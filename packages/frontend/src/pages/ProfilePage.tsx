import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../auth/authApi'
import { apiRequest, ApiError } from '../lib/apiClient'
import type { IListing } from '@rento/shared'
import { deleteListing } from '../catalog/catalogApi'
import '../styles/profile.css'

function accountStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_EMAIL_CONFIRMATION':
      return 'Ожидает подтверждения email'
    case 'PENDING_TELEGRAM_LINK':
      return 'Привяжите Telegram'
    case 'ACTIVE':
      return 'Активен'
    case 'SUSPENDED':
      return 'Приостановлен'
    case 'BANNED':
      return 'Заблокирован'
    default:
      return status
  }
}

export function ProfilePage() {
  const { user, accessToken, logout, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [listings, setListings] = useState<IListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [draftFullName, setDraftFullName] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    void refreshProfile()
  }, [user, navigate, refreshProfile])

  useEffect(() => {
    if (!user) return
    setDraftFullName(user.fullName ?? '')
    setDraftPhone(user.phone ?? '')
  }, [user?.id, user?.fullName, user?.phone])

  useEffect(() => {
    if (!user) return

    async function loadMyListings() {
      try {
        const res = await apiRequest<IListing[]>('/listings/my', {
          accessToken,
        })
        setListings(res)
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.message)
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Не удалось загрузить ваши объявления')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadMyListings()
  }, [user, accessToken])

  const handleDelete = async (listingId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить это объявление?')) return
    try {
      await deleteListing(listingId, accessToken!)
      setListings((prev) => prev.filter((l) => l.id !== listingId))
    } catch {
      alert('Не удалось удалить объявление')
    }
  }

  const handleResendConfirmation = async () => {
    if (!user?.email) return
    setResendState('loading')
    setResendMessage(null)
    try {
      const { message } = await authApi.resendConfirmation(user.email)
      setResendState('ok')
      setResendMessage(message)
    } catch (err: unknown) {
      setResendState('err')
      setResendMessage(
        err instanceof ApiError ? err.message : 'Не удалось отправить письмо',
      )
    }
  }

  const isProfileDirty = useMemo(() => {
    if (!user) return false
    return (
      draftFullName.trim() !== (user.fullName ?? '').trim() ||
      draftPhone.trim() !== (user.phone ?? '').trim()
    )
  }, [user, draftFullName, draftPhone])

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !accessToken || !isProfileDirty) return
    const body: { fullName?: string; phone?: string } = {}
    if (draftFullName.trim() !== (user.fullName ?? '').trim()) {
      body.fullName = draftFullName.trim()
    }
    if (draftPhone.trim() !== (user.phone ?? '').trim()) {
      body.phone = draftPhone.trim()
    }
    if (Object.keys(body).length === 0) return

    setProfileSaving(true)
    setProfileMessage(null)
    try {
      await authApi.updateCurrentUser(body, accessToken)
      await refreshProfile()
      setProfileMessage({ type: 'ok', text: 'Изменения сохранены' })
    } catch (err: unknown) {
      setProfileMessage({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Не удалось сохранить данные',
      })
    } finally {
      setProfileSaving(false)
    }
  }

  if (!user) return null

  const initials =
    user.fullName?.trim()?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    '?'

  const emailNeedsConfirmation = Boolean(user.email && !user.isVerified)
  const trust = user.trustScore

  return (
    <main className="profile-page">
      <div className="profile-page__inner container">
        <header className="profile-page__toolbar">
          <div className="profile-page__title-block">
            <p className="profile-page__eyebrow">Личный кабинет</p>
            <h1 className="profile-page__title">Профиль</h1>
            <p className="profile-page__subtitle">
              Управляйте объявлениями, настройками аккаунта и доступом к сервису.
            </p>
          </div>
        </header>

        <div className="profile-layout">
          <aside className="profile-sidebar">
            <div className="profile-sidebar__avatar" aria-hidden={!!user.avatarUrl}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" />
              ) : (
                initials
              )}
            </div>
            <h2 className="profile-sidebar__name">{user.fullName || 'Без имени'}</h2>

            <div className="profile-sidebar__chips">
              <span className="profile-chip">{user.role === 'ADMIN' ? 'Админ' : 'Пользователь'}</span>
              {user.isVerified ? (
                <span className="profile-chip profile-chip--ok">Email подтверждён</span>
              ) : user.email ? (
                <span className="profile-chip profile-chip--warn">Email не подтверждён</span>
              ) : null}
            </div>

            <div className="profile-sidebar__meta">
              {user.email ? (
                <div className="profile-sidebar__row">
                  <MailGlyph />
                  <span>{user.email}</span>
                </div>
              ) : null}
              {user.phone ? (
                <div className="profile-sidebar__row">
                  <PhoneGlyph />
                  <span>{user.phone}</span>
                </div>
              ) : (
                <div className="profile-sidebar__row">
                  <PhoneGlyph />
                  <span style={{ color: 'var(--ink-400)' }}>Телефон не указан</span>
                </div>
              )}
              <div className="profile-sidebar__row">
                <ShieldGlyph />
                <span>{accountStatusLabel(user.status)}</span>
              </div>
            </div>

            <div className="profile-sidebar__footer">
              <button type="button" className="btn btn--ghost" style={{ width: '100%' }} onClick={logout}>
                Выйти
              </button>
            </div>
          </aside>

          <div className="profile-main">
            <div className="profile-cards">
              <section className="profile-panel profile-panel--muted" aria-labelledby="profile-wallet-title">
                <div className="profile-panel__head">
                  <h3 id="profile-wallet-title" className="profile-panel__title">
                    Кошелёк
                  </h3>
                  <WalletGlyph />
                </div>
                <p className="profile-panel__hint">
                  Баланс, пополнение и история платежей появятся здесь в следующей версии.
                </p>
                <div className="profile-wallet__amount">— ₽</div>
                <button type="button" className="btn btn--ghost" disabled style={{ marginTop: 'var(--sp-3)' }}>
                  Скоро
                </button>
              </section>

              <section className="profile-panel profile-panel--identity" aria-labelledby="profile-identity-title">
                <div className="profile-panel__head">
                  <div>
                    <span className="profile-identity-eyebrow">Повышенное доверие</span>
                    <h3 id="profile-identity-title" className="profile-panel__title">
                      Подтверждённый аккаунт
                    </h3>
                  </div>
                  <span className="profile-identity-badge profile-identity-badge--soon">Скоро</span>
                </div>
                <p className="profile-panel__hint">
                  В дизайне эта карточка отмечает владельца, который подтвердил личность через{' '}
                  <strong>Telegram</strong> или <strong>ЕСИА</strong> (Госуслуги). Подключение этих сценариев пока в
                  разработке — статус «подтверждён по Telegram / ЕСИА» недоступен.
                </p>
                <ul className="profile-identity-methods" aria-label="Будущие способы подтверждения">
                  <li>
                    <TelegramMiniGlyph />
                    Telegram
                  </li>
                  <li>
                    <EsiaGlyph />
                    ЕСИА
                  </li>
                </ul>
                <button type="button" className="btn btn--brand" disabled>
                  Подтвердить аккаунт
                </button>
              </section>

              {emailNeedsConfirmation ? (
                <section
                  className="profile-panel profile-panel--alert profile-cards__span"
                  aria-labelledby="profile-email-title"
                >
                  <div className="profile-panel__head">
                    <h3 id="profile-email-title" className="profile-panel__title">
                      Подтвердите email
                    </h3>
                  </div>
                  <p className="profile-panel__hint">
                    На адрес <strong>{user.email}</strong> отправлено письмо со ссылкой. Без подтверждения часть
                    функций может быть недоступна.
                  </p>
                  <button
                    type="button"
                    className="btn btn--brand"
                    disabled={resendState === 'loading'}
                    onClick={() => void handleResendConfirmation()}
                  >
                    {resendState === 'loading' ? 'Отправка…' : 'Отправить письмо ещё раз'}
                  </button>
                  {resendMessage ? (
                    <p
                      className={`profile-resend-msg${resendState === 'ok' ? ' profile-resend-msg--ok' : ''}${resendState === 'err' ? ' profile-resend-msg--err' : ''}`}
                      style={{ marginTop: 'var(--sp-3)' }}
                    >
                      {resendMessage}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>

            <section className="profile-panel profile-panel--form" aria-labelledby="profile-edit-title">
              <h3 id="profile-edit-title" className="profile-panel__title">
                Личные данные
              </h3>
              <form onSubmit={(e) => void handleSaveProfile(e)}>
                <div className="profile-form__grid">
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field__label" htmlFor="profile-fullName">
                      Имя и фамилия
                    </label>
                    <input
                      id="profile-fullName"
                      className="field__input"
                      type="text"
                      autoComplete="name"
                      maxLength={120}
                      value={draftFullName}
                      onChange={(e) => setDraftFullName(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field__label" htmlFor="profile-phone">
                      Телефон
                    </label>
                    <input
                      id="profile-phone"
                      className="field__input"
                      type="tel"
                      autoComplete="tel"
                      maxLength={30}
                      placeholder="+7 …"
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                    />
                    <span className="field__hint">Не более 30 символов.</span>
                  </div>
                </div>
                {profileMessage ? (
                  <p
                    className={`profile-resend-msg${profileMessage.type === 'ok' ? ' profile-resend-msg--ok' : ' profile-resend-msg--err'}`}
                    style={{ marginTop: 'var(--sp-3)' }}
                  >
                    {profileMessage.text}
                  </p>
                ) : null}
                <div className="profile-form__actions">
                  <button type="submit" className="btn btn--brand" disabled={!isProfileDirty || profileSaving}>
                    {profileSaving ? 'Сохранение…' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={!isProfileDirty || profileSaving}
                    onClick={() => {
                      setDraftFullName(user.fullName ?? '')
                      setDraftPhone(user.phone ?? '')
                      setProfileMessage(null)
                    }}
                  >
                    Сбросить
                  </button>
                </div>
              </form>
            </section>

            {trust ? (
              <section className="profile-panel" aria-label="Рейтинг доверия">
                <div className="profile-panel__head">
                  <h3 className="profile-panel__title">Рейтинг доверия</h3>
                </div>
                <div className="profile-trust">
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Баллы</span>
                    <span className="profile-trust__value">{trust.currentScore}</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Сделок</span>
                    <span className="profile-trust__value">{trust.totalDeals}</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Успешных</span>
                    <span className="profile-trust__value">{trust.successfulDeals}</span>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="profile-listings" aria-labelledby="profile-listings-title">
              <div className="profile-listings__head">
                <h2 id="profile-listings-title" className="profile-listings__title">
                  Мои объявления
                </h2>
                <Link to="/create-item" className="btn btn--brand">
                  Добавить
                </Link>
              </div>

              {error ? <div className="alert alert--error">{error}</div> : null}

              {loading ? (
                <div className="skeleton" style={{ height: 120, borderRadius: 'var(--r-md)' }} />
              ) : listings.length === 0 ? (
                <div className="status">У вас пока нет объявлений.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  {listings.map((listing) => (
                    <div key={listing.id} className="profile-listing-card">
                      <Link
                        to={`/listings/${listing.id}`}
                        className="profile-listing-card__link"
                        aria-label={listing.title}
                      />
                      <div className="profile-listing-card__thumb">
                        {listing.photos?.[0]?.url ? (
                          <img src={listing.photos[0].url} alt="" />
                        ) : null}
                      </div>
                      <div className="profile-listing-card__body">
                        <h3 className="profile-listing-card__title">{listing.title}</h3>
                        <div className="profile-listing-card__meta">
                          <span>
                            {listing.rentalPrice.toLocaleString('ru-RU')} ₽ /{' '}
                            {listing.rentalPeriod === 'HOUR'
                              ? 'час'
                              : listing.rentalPeriod === 'DAY'
                                ? 'сутки'
                                : listing.rentalPeriod === 'WEEK'
                                  ? 'неделя'
                                  : 'месяц'}
                          </span>
                          <span>•</span>
                          <span
                            style={{
                              color:
                                listing.status === 'ACTIVE'
                                  ? 'var(--success-fg, #15803d)'
                                  : 'var(--ink-500)',
                            }}
                          >
                            {listing.status === 'ACTIVE' ? 'Активно' : 'Черновик'}
                          </span>
                        </div>
                      </div>
                      <div className="profile-listing-card__actions">
                        <Link
                          to={`/listings/${listing.id}/calendar`}
                          className="btn btn--ghost"
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                        >
                          Календарь
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(listing.id)}
                          className="btn btn--ghost"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            color: 'var(--danger-fg, #b91c1c)',
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

function TelegramMiniGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="18" height="18">
      <circle cx="12" cy="12" r="10" fill="#229ED9" />
      <path
        fill="#fff"
        d="M17.5 7.5l-2.2 10.4c-.2.9-.7 1.1-1.4.7l-3.9-2.9-1.9 1.8c-.2.2-.4.4-.8.4l.3-4.1 7.2-6.5c.3-.3-.1-.5-.5-.3l-8.9 5.6-3.8-1.2c-.8-.25-.8-.8.2-1.2L16.4 6.4c.7-.3 1.3.2 1.1 1.1z"
      />
    </svg>
  )
}

function EsiaGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="18" height="18" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#0B4F9C" />
      <path
        d="M8 8h8M8 12h5M8 16h6"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MailGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden stroke="currentColor" fill="none" strokeWidth="1.7" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden stroke="currentColor" fill="none" strokeWidth="1.7" strokeLinecap="round">
      <path d="M6 3h4l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 6 5a2 2 0 0 1 2-2z" />
    </svg>
  )
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden stroke="currentColor" fill="none" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z" />
    </svg>
  )
}

function WalletGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ opacity: 0.45 }} stroke="currentColor" fill="none" strokeWidth="1.6">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
