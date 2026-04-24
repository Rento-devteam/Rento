import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { AuthUser } from '../auth/types'
import { authApi } from '../auth/authApi'
import { apiRequest, ApiError } from '../lib/apiClient'
import type { IListing } from '@rento/shared'
import { deleteListing } from '../catalog/catalogApi'
import {
  attachCard,
  listPaymentMethods,
  removeCard,
  setDefaultCard,
  type BankCard,
} from '../payments/paymentMethodsApi'
import '../styles/profile.css'

type ProfileIdentitySectionProps = {
  accessToken: string | null
}

function ProfileIdentitySection({ accessToken }: ProfileIdentitySectionProps) {
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState<{
    type: 'ok' | 'err'
    text: string
  } | null>(null)

  const startEsiaVerification = async () => {
    if (!accessToken) return
    setVerificationLoading(true)
    setVerificationMessage(null)
    try {
      const response = await apiRequest<{ redirectUrl: string }>('/verify/esia/initiate', {
        method: 'POST',
        accessToken,
      })
      if (!response.redirectUrl) {
        throw new Error('Не получен URL для перехода в ЕСИА')
      }
      setVerificationMessage({ type: 'ok', text: 'Перенаправляем в ЕСИА…' })
      window.location.assign(response.redirectUrl)
    } catch (err: unknown) {
      setVerificationMessage({
        type: 'err',
        text:
          err instanceof ApiError
            ? err.message
            : 'Не удалось начать верификацию через ЕСИА',
      })
    } finally {
      setVerificationLoading(false)
    }
  }

  return (
    <section className="profile-panel profile-panel--identity" aria-labelledby="profile-identity-title">
      <div className="profile-panel__head">
        <div>
          <span className="profile-identity-eyebrow">Повышенное доверие</span>
          <h3 id="profile-identity-title" className="profile-panel__title">
            Подтверждение личности
          </h3>
        </div>
      </div>
      <p className="profile-panel__hint">
        Подтвердите личность через ЕСИА, чтобы повысить Индекс доверия по сценарию UC-03.
      </p>
      <ul className="profile-identity-methods" aria-label="Способы подтверждения личности">
        <li>
          <EsiaGlyph />
          ЕСИА
        </li>
      </ul>
      <button
        type="button"
        className="btn btn--brand"
        onClick={() => void startEsiaVerification()}
        disabled={!accessToken || verificationLoading}
      >
        {verificationLoading ? 'Переход в ЕСИА…' : 'Подтвердить через ЕСИА'}
      </button>
      {verificationMessage ? (
        <p
          className={`profile-resend-msg${verificationMessage.type === 'ok' ? ' profile-resend-msg--ok' : ' profile-resend-msg--err'}`}
          style={{ marginTop: 'var(--sp-3)' }}
        >
          {verificationMessage.text}
        </p>
      ) : null}
    </section>
  )
}

type ProfileTrustScoreCardProps = {
  user: AuthUser
}

function ProfileTrustScoreCard({ user }: ProfileTrustScoreCardProps) {
  const trust = user.trustScore
  if (!trust) return null

  const identityFactor = user.status === 'ACTIVE' ? 'Есть документ' : 'Нет документа'
  const onTimeReturns = Math.max(trust.successfulDeals - trust.lateReturns, 0)
  const onTimePercent =
    trust.successfulDeals > 0
      ? Math.round((onTimeReturns / trust.successfulDeals) * 100)
      : 0

  return (
    <section className="profile-panel" aria-label="Индекс доверия">
      <div className="profile-panel__head">
        <h3 className="profile-panel__title">Индекс доверия</h3>
      </div>
      <div className="profile-trust">
        <div className="profile-trust__item">
          <span className="profile-trust__label">Индекс</span>
          <span className="profile-trust__value">{trust.currentScore}</span>
        </div>
        <div className="profile-trust__item">
          <span className="profile-trust__label">Сделок всего</span>
          <span className="profile-trust__value">{trust.totalDeals}</span>
        </div>
        <div className="profile-trust__item">
          <span className="profile-trust__label">Возвратов в срок</span>
          <span className="profile-trust__value">{onTimePercent}%</span>
        </div>
      </div>
      <ul className="profile-trust-factors" aria-label="Факторы индекса доверия">
        <li>
          <strong>Документ:</strong> {identityFactor}
        </li>
        <li>
          <strong>Отзывы людей:</strong> {trust.successfulDeals} успешных сделок
        </li>
        <li>
          <strong>История возвратов:</strong> {onTimeReturns} в срок / {trust.successfulDeals} подтвержденных
        </li>
      </ul>
    </section>
  )
}

type ProfileDetailsSectionProps = {
  user: AuthUser
  accessToken: string | null
  refreshProfile: () => Promise<void>
}

function ProfileDetailsSection({ user, accessToken, refreshProfile }: ProfileDetailsSectionProps) {
  const [draftFullName, setDraftFullName] = useState(() => user.fullName ?? '')
  const [draftPhone, setDraftPhone] = useState(() => user.phone ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )

  const isProfileDirty = useMemo(() => {
    return (
      draftFullName.trim() !== (user.fullName ?? '').trim() ||
      draftPhone.trim() !== (user.phone ?? '').trim()
    )
  }, [user, draftFullName, draftPhone])

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!accessToken || !isProfileDirty) return
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

  return (
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
          <button
            type="submit"
            className="btn btn--brand"
            disabled={!isProfileDirty || profileSaving || !accessToken}
          >
            {profileSaving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!isProfileDirty || profileSaving || !accessToken}
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
  )
}

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
  const [cards, setCards] = useState<BankCard[]>([])
  const [cardsLoading, setCardsLoading] = useState(true)
  const [cardsError, setCardsError] = useState<string | null>(null)
  const [cardToken, setCardToken] = useState('')
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [cardActionLoading, setCardActionLoading] = useState(false)
  const [cardMessage, setCardMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!user?.id) {
      navigate('/')
      return
    }
    void refreshProfile()
    // Зависимость только от id: после refreshProfile приходит новый объект user и
    // не должно заново дергать API (иначе бесконечный цикл перерисовок).
  }, [user?.id, navigate, refreshProfile])

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
  }, [user?.id, accessToken])

  useEffect(() => {
    if (!user || !accessToken) return
    const token = accessToken

    async function loadCards() {
      setCardsLoading(true)
      setCardsError(null)
      try {
        const items = await listPaymentMethods(token)
        setCards(items)
      } catch (err: unknown) {
        setCardsError(
          err instanceof ApiError ? err.message : 'Не удалось загрузить привязанные карты',
        )
      } finally {
        setCardsLoading(false)
      }
    }

    void loadCards()
  }, [user?.id, accessToken])

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

  const handleAttachCard = async (event: FormEvent) => {
    event.preventDefault()
    if (!accessToken || !cardToken.trim()) return

    setCardActionLoading(true)
    setCardMessage(null)
    try {
      const created = await attachCard({
        accessToken,
        token: cardToken.trim(),
        setAsDefault,
      })
      setCards((prev) => {
        const withoutCreated = prev.filter((card) => card.id !== created.id)
        if (created.isDefault) {
          return [created, ...withoutCreated.map((card) => ({ ...card, isDefault: false }))]
        }
        return [...withoutCreated, created]
      })
      setCardToken('')
      setSetAsDefault(false)
      setCardMessage({ type: 'ok', text: 'Карта успешно привязана' })
    } catch (err: unknown) {
      setCardMessage({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Не удалось привязать карту',
      })
    } finally {
      setCardActionLoading(false)
    }
  }

  const handleSetDefaultCard = async (cardId: string) => {
    if (!accessToken) return
    setCardActionLoading(true)
    setCardMessage(null)
    try {
      await setDefaultCard(accessToken, cardId)
      setCards((prev) => prev.map((card) => ({ ...card, isDefault: card.id === cardId })))
      setCardMessage({ type: 'ok', text: 'Карта выбрана для Escrow по умолчанию' })
    } catch (err: unknown) {
      setCardMessage({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Не удалось обновить карту по умолчанию',
      })
    } finally {
      setCardActionLoading(false)
    }
  }

  const handleRemoveCard = async (cardId: string) => {
    if (!accessToken) return
    setCardActionLoading(true)
    setCardMessage(null)
    try {
      await removeCard(accessToken, cardId)
      setCards((prev) => prev.filter((card) => card.id !== cardId))
      setCardMessage({ type: 'ok', text: 'Карта отвязана' })
    } catch (err: unknown) {
      setCardMessage({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Не удалось отвязать карту',
      })
    } finally {
      setCardActionLoading(false)
    }
  }

  if (!user) return null

  const initials =
    user.fullName?.trim()?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    '?'

  const emailNeedsConfirmation = Boolean(user.email && !user.isVerified)

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
                    Карты для Escrow
                  </h3>
                  <WalletGlyph />
                </div>
                <p className="profile-panel__hint">
                  Привяжите карту через защищенный платежный шлюз. На backend сейчас используется заглушка:
                  для теста используйте любой непустой токен.
                </p>
                <form className="profile-cards-form" onSubmit={(e) => void handleAttachCard(e)}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="field__label" htmlFor="card-token">
                      Токен карты из шлюза
                    </label>
                    <input
                      id="card-token"
                      className="field__input"
                      value={cardToken}
                      onChange={(e) => setCardToken(e.target.value)}
                      placeholder="pm_token_..."
                      maxLength={255}
                    />
                  </div>
                  <label className="profile-cards-form__checkbox">
                    <input
                      type="checkbox"
                      checked={setAsDefault}
                      onChange={(e) => setSetAsDefault(e.target.checked)}
                    />
                    <span>Сделать основной картой для удержаний</span>
                  </label>
                  <button
                    type="submit"
                    className="btn btn--brand"
                    disabled={cardActionLoading || !cardToken.trim()}
                  >
                    {cardActionLoading ? 'Привязка…' : 'Привязать карту'}
                  </button>
                </form>
                {cardMessage ? (
                  <p
                    className={`profile-resend-msg${cardMessage.type === 'ok' ? ' profile-resend-msg--ok' : ' profile-resend-msg--err'}`}
                    style={{ marginTop: 'var(--sp-3)' }}
                  >
                    {cardMessage.text}
                  </p>
                ) : null}
                {cardsError ? <p className="profile-resend-msg profile-resend-msg--err">{cardsError}</p> : null}
                {cardsLoading ? (
                  <div className="skeleton" style={{ height: 70, borderRadius: 'var(--r-md)' }} />
                ) : cards.length === 0 ? (
                  <div className="status" style={{ marginTop: 'var(--sp-3)' }}>
                    Пока нет привязанных карт
                  </div>
                ) : (
                  <ul className="profile-bank-cards" aria-label="Привязанные банковские карты">
                    {cards.map((card) => (
                      <li key={card.id} className="profile-bank-cards__item">
                        <div>
                          <strong>
                            {card.cardType} •••• {card.last4}
                          </strong>
                          <div className="profile-bank-cards__meta">
                            {card.isDefault ? 'Карта по умолчанию' : 'Дополнительная карта'}
                          </div>
                        </div>
                        <div className="profile-bank-cards__actions">
                          {!card.isDefault ? (
                            <button
                              type="button"
                              className="btn btn--ghost"
                              disabled={cardActionLoading}
                              onClick={() => void handleSetDefaultCard(card.id)}
                            >
                              Сделать основной
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={cardActionLoading}
                            onClick={() => void handleRemoveCard(card.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
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

            <ProfileIdentitySection accessToken={accessToken} />
            <ProfileTrustScoreCard user={user} />
            <ProfileDetailsSection
              key={user.id}
              user={user}
              accessToken={accessToken}
              refreshProfile={refreshProfile}
            />
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
