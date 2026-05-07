import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { IListing } from '@rento/shared'
import { ApiError } from '../lib/apiClient'
import { getPublicUserProfile, type PublicUserProfile } from '../users/publicProfileApi'
import { getPublicListingsByOwner } from '../catalog/catalogApi'
import { formatListingRentalPriceRu } from '../lib/rentalPeriodRu'
import { userStatusLabelRu } from '../lib/statusRu'
import '../styles/profile.css'

function formatAccountId(id: string): string {
  if (id.length <= 14) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function calculateOnTimeReturnsRate(totalDeals: number, lateReturns: number): number {
  if (totalDeals <= 0) return 0
  const onTime = Math.max(0, totalDeals - lateReturns)
  return Math.round((onTime / totalDeals) * 100)
}

export function PublicUserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listings, setListings] = useState<IListing[]>([])

  useEffect(() => {
    const profileUserId = userId
    if (!profileUserId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getPublicUserProfile(profileUserId!)
        if (!cancelled) setProfile(data)
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить профиль')
          setProfile(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    const profileUserId = userId
    if (!profileUserId) return
    let cancelled = false
    async function loadListings() {
      try {
        const items = await getPublicListingsByOwner(profileUserId!)
        if (!cancelled) setListings(items)
      } catch {
        if (!cancelled) setListings([])
      }
    }
    void loadListings()
    return () => {
      cancelled = true
    }
  }, [userId])

  const initials = useMemo(
    () => (profile?.fullName?.trim()?.[0] ?? profile?.email?.[0] ?? '?').toUpperCase(),
    [profile],
  )

  if (loading)
    return (
      <main className="profile-page">
        <div className="container profile-page__outer">
          <div className="skeleton" style={{ height: 280, borderRadius: 'var(--r-lg)' }} />
        </div>
      </main>
    )

  if (error || !profile) {
    return (
      <main className="container" style={{ padding: 'var(--sp-7) 0' }}>
        <div className="alert alert--error">{error ?? 'Профиль не найден'}</div>
        <Link to="/" className="btn btn--brand" style={{ marginTop: 'var(--sp-3)' }}>
          На главную
        </Link>
      </main>
    )
  }

  return (
    <main className="profile-page">
      <div className="container profile-page__outer">
        <div className="profile-page__surface">
          <header className="profile-page__masthead">
            <h1 className="profile-page__title">Профиль</h1>
            <Link to="/" className="btn btn--ghost profile-page__logout">
              Назад
            </Link>
          </header>
          <div className="profile-page__divider" role="presentation" />

          <section className="profile-hero" aria-label="Сводка профиля">
            <div className="profile-hero__identity">
              <div className="profile-hero__avatar-wrap">
                <div className="profile-hero__avatar" aria-hidden={!!profile.avatarUrl}>
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials}
                </div>
              </div>
              <div className="profile-hero__text">
                <p className="profile-hero__name">{profile.fullName || 'Без имени'}</p>
                <p className="profile-hero__since">На Rento — публичный профиль</p>
                <p className="profile-hero__account">Аккаунт: {formatAccountId(profile.id)}</p>
              </div>
            </div>
            <div className="profile-hero__rating-card">
              <div className="profile-hero__rating-top">
                <span className="profile-hero__rating-value">—</span>
                <div className="profile-hero__stars" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className="profile-hero__star">
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <p className="profile-hero__reviews">
                {profile.trustScore?.totalDeals ? `Сделок: ${profile.trustScore.totalDeals}` : 'Оценок пока нет'}
              </p>
              <p className="profile-hero__trust-level">
                Рейтинг зависит только от оценок пользователей
              </p>
            </div>
            <div className="profile-hero__wallet-card">
              <p className="profile-hero__wallet-label">На удержании</p>
              <p className="profile-hero__wallet-sub">Безопасная сделка (Escrow)</p>
              <p className="profile-hero__wallet-amount">—</p>
              <p className="profile-hero__wallet-hint">Сумма удержания отображается в карточке бронирования</p>
            </div>
          </section>

          <section className="profile-panel profile-panel--trust" aria-label="Индекс доверия">
            <div className="profile-panel__head">
              <h3 className="profile-panel__title">Индекс доверия</h3>
            </div>
            {profile.trustScore ? (
              <>
                <div className="profile-trust-score-badge">{profile.trustScore.currentScore}</div>
                <p className="profile-panel__hint">
                  Индекс доверия учитывает только историю возвратов по завершённым сделкам.
                </p>
                <div className="profile-trust" style={{ marginTop: 'var(--sp-3)' }}>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Подтверждение личности</span>
                    <span className="profile-trust__value">Скоро</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Возвраты в срок</span>
                    <span className="profile-trust__value">
                      {calculateOnTimeReturnsRate(
                        profile.trustScore.totalDeals,
                        profile.trustScore.lateReturns,
                      )}
                      %
                    </span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Всего сделок</span>
                    <span className="profile-trust__value">{profile.trustScore.totalDeals}</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Успешных сделок</span>
                    <span className="profile-trust__value">{profile.trustScore.successfulDeals}</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Просроченных возвратов</span>
                    <span className="profile-trust__value">{profile.trustScore.lateReturns}</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Отзывы</span>
                    <span className="profile-trust__value">Оценка —</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="profile-panel__hint">Индекс пока не рассчитан.</p>
            )}
          </section>

          <div className="profile-layout profile-layout--dashboard">
            <aside className="profile-aside" aria-label="Данные пользователя">
              <div className="profile-aside__verify">
                <div className="profile-aside__verify-icon" aria-hidden>
                  <ShieldGlyph />
                </div>
                <div>
                  <p className="profile-aside__verify-title">
                    {profile.isVerified ? 'Email подтверждён' : 'Статус не подтверждён'}
                  </p>
                  <p className="profile-aside__verify-text">
                    {profile.isVerified
                      ? 'Подтверждение личности через Госуслуги появится в следующей версии.'
                      : 'Подтверждение появится после полной верификации аккаунта.'}
                  </p>
                </div>
                <button type="button" className="btn btn--brand profile-aside__verify-btn" disabled>
                  Через Госуслуги
                </button>
              </div>

              <div className="profile-aside__stats">
                <div className="profile-stat-card">
                  <span className="profile-stat-card__icon profile-stat-card__icon--ok" aria-hidden>
                    ✓
                  </span>
                  <div>
                    <p className="profile-stat-card__label">Сделки</p>
                    <p className="profile-stat-card__hint">История сделок</p>
                  </div>
                  <span className="profile-stat-card__value">{profile.trustScore?.totalDeals ?? 0}</span>
                </div>
                <div className="profile-stat-card">
                  <span className="profile-stat-card__icon profile-stat-card__icon--plus" aria-hidden>
                    +
                  </span>
                  <div>
                    <p className="profile-stat-card__label">Объявления</p>
                    <p className="profile-stat-card__hint">Активные</p>
                  </div>
                  <span className="profile-stat-card__value">—</span>
                </div>
              </div>

              <section className="profile-aside__data" aria-labelledby="public-user-data-title">
                <h2 id="public-user-data-title" className="profile-aside__data-title">
                  Данные пользователя
                </h2>
                <div className="profile-aside__row">
                  <PhoneGlyph />
                  <span>{profile.phone || 'Телефон не указан'}</span>
                </div>
                <div className="profile-aside__row">
                  <MailGlyph />
                  <span>{profile.email || 'Email скрыт'}</span>
                </div>
                <div className="profile-aside__row">
                  <HomeGlyph />
                  <span className="profile-aside__muted">Адрес в публичном профиле не показывается</span>
                </div>
                <div className="profile-aside__row">
                  <ShieldGlyph />
                  <span>{userStatusLabelRu(profile.status)}</span>
                </div>
                {profile.role === 'ADMIN' ? <p className="profile-aside__role">Роль: администратор</p> : null}
              </section>
            </aside>

            <div className="profile-main">
              <section className="profile-listings" aria-labelledby="public-profile-listings-title">
                <div className="profile-listings__head">
                  <h2 id="public-profile-listings-title" className="profile-listings__title">
                    Мои объявления
                  </h2>
                </div>
                {listings.length === 0 ? (
                  <div className="status">У пользователя пока нет опубликованных объявлений.</div>
                ) : (
                  <div className="profile-listings-grid">
                    {listings.map((listing) => (
                      <article key={listing.id} className="profile-listing-card profile-listing-card--tile">
                        <Link to={`/listings/${listing.id}`} className="profile-listing-card__link" aria-label={listing.title} />
                        <div className="profile-listing-card__thumb">
                          {listing.photos?.[0]?.url ? <img src={listing.photos[0].url} alt="" /> : null}
                        </div>
                        <div className="profile-listing-card__body">
                          <h3 className="profile-listing-card__title">{listing.title}</h3>
                          <div className="profile-listing-card__meta">
                            <span>{formatListingRentalPriceRu(listing.rentalPrice, listing.rentalPeriod)}</span>
                            <span>•</span>
                            <span>Активно</span>
                          </div>
                        </div>
                        <div className="profile-listing-card__actions">
                          <Link to={`/listings/${listing.id}`} className="btn btn--ghost" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                            Открыть
                          </Link>
                          <Link to={`/listings/${listing.id}/calendar`} className="btn btn--ghost" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                            Календарь
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function HomeGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden stroke="currentColor" fill="none" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
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

