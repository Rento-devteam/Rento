import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { AuthUser } from '../auth/types'
import { authApi } from '../auth/authApi'
import { apiRequest, ApiError } from '../lib/apiClient'
import type { IListing, RentalPeriod } from '@rento/shared'
import { formatListingRentalPriceRu } from '../lib/rentalPeriodRu'
import { deleteListing } from '../catalog/catalogApi'
import {
  attachCard,
  listPaymentMethods,
  removeCard,
  setDefaultCard,
  type BankCard,
} from '../payments/paymentMethodsApi'
import '../styles/profile.css'

type ProfileEditModalProps = {
  open: boolean
  onClose: () => void
  user: AuthUser
  accessToken: string | null
  refreshProfile: () => Promise<void>
}

function ProfileEditModal({
  open,
  onClose,
  user,
  accessToken,
  refreshProfile,
}: ProfileEditModalProps) {
  const [draftFullName, setDraftFullName] = useState(() => user.fullName ?? '')
  const [draftPhone, setDraftPhone] = useState(() => user.phone ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setDraftFullName(user.fullName ?? '')
      setDraftPhone(user.phone ?? '')
      setProfileMessage(null)
    })
  }, [open, user])

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
      onClose()
    } catch (err: unknown) {
      setProfileMessage({
        type: 'err',
        text: err instanceof ApiError ? err.message : 'Не удалось сохранить данные',
      })
    } finally {
      setProfileSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="modal"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="profile-edit-modal-title" className="modal__title" style={{ marginTop: 0 }}>
          Личные данные
        </h2>
        <form onSubmit={(e) => void handleSaveProfile(e)}>
          <div className="profile-form__grid profile-form__grid--modal-stack">
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
          <div className="profile-form__actions" style={{ marginTop: 'var(--sp-4)' }}>
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
      </div>
    </div>
  )
}

const PROFILE_CARDS_PREVIEW = 3
const PROFILE_LISTINGS_PREVIEW = 3

type ProfileFullListModalProps = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

function ProfileFullListModal({ title, open, onClose, children }: ProfileFullListModalProps) {
  if (!open) return null
  return (
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        className="modal__dialog profile-full-list-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-full-list-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <h2 id="profile-full-list-heading" className="modal__title" style={{ marginTop: 0 }}>
          {title}
        </h2>
        <div className="profile-full-list-modal__body">{children}</div>
      </div>
    </div>
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

function calculateOnTimeReturnsRate(totalDeals: number, lateReturns: number): number {
  if (totalDeals <= 0) return 0
  const onTime = Math.max(0, totalDeals - lateReturns)
  return Math.round((onTime / totalDeals) * 100)
}

function formatAccountId(id: string): string {
  if (id.length <= 14) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function formatStarRating(rating: number): string {
  return Math.min(5, Math.max(0, rating)).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function reviewsLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} оценка`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} оценки`
  return `${count} оценок`
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
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [profileFullListOpen, setProfileFullListOpen] = useState<'cards' | null>(null)
  const [listingsPage, setListingsPage] = useState(1)
  const [listingDeleteTarget, setListingDeleteTarget] = useState<{ id: string; title: string } | null>(
    null,
  )
  const [listingDeleteSubmitting, setListingDeleteSubmitting] = useState(false)
  const [listingDeleteError, setListingDeleteError] = useState<string | null>(null)

  const visibleCards = useMemo(() => cards.slice(0, PROFILE_CARDS_PREVIEW), [cards])
  const listingsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(listings.length / PROFILE_LISTINGS_PREVIEW)),
    [listings.length],
  )
  const currentListingsPage = Math.min(listingsPage, listingsTotalPages)
  const visibleListings = useMemo(() => {
    const start = (currentListingsPage - 1) * PROFILE_LISTINGS_PREVIEW
    return listings.slice(start, start + PROFILE_LISTINGS_PREVIEW)
  }, [listings, currentListingsPage])

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
    if (!user?.id) return

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
    if (!user?.id || !accessToken) return
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

  const openListingDeleteModal = (listingId: string, title: string) => {
    setListingDeleteError(null)
    setListingDeleteTarget({ id: listingId, title })
  }

  const handleListingDeleteConfirm = async () => {
    if (!listingDeleteTarget || !accessToken) return
    setListingDeleteSubmitting(true)
    setListingDeleteError(null)
    try {
      await deleteListing(listingDeleteTarget.id, accessToken)
      setListings((prev) => prev.filter((l) => l.id !== listingDeleteTarget.id))
      setListingDeleteTarget(null)
      setProfileFullListOpen(null)
    } catch (err: unknown) {
      setListingDeleteError(
        err instanceof ApiError ? err.message : 'Не удалось удалить объявление',
      )
    } finally {
      setListingDeleteSubmitting(false)
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

  const activeListingsCount = useMemo(
    () => listings.filter((l) => l.status === 'ACTIVE').length,
    [listings],
  )

  if (!user) return null

  const initials =
    user.fullName?.trim()?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    '?'

  const emailNeedsConfirmation = Boolean(user.email && !user.isVerified)
  const trust = user.trustScore

  const userRatingSource = user as typeof user & {
    averageRating?: number | null
    reviewsCount?: number | null
    rating?: number | null
    ratingCount?: number | null
  }
  const userRating = Math.min(
    5,
    Math.max(0, userRatingSource.averageRating ?? userRatingSource.rating ?? 0),
  )
  const userReviewsCount = Math.max(
    0,
    userRatingSource.reviewsCount ?? userRatingSource.ratingCount ?? 0,
  )
  const userRatingValue = userReviewsCount > 0 ? formatStarRating(userRating) : '—'

  return (
    <main className="profile-page">
      <div className="container profile-page__outer">
        <div className="profile-page__surface">
          <header className="profile-page__masthead">
            <h1 className="profile-page__title">Профиль</h1>
            <div className="profile-page__masthead-actions">
              <button
                type="button"
                className="profile-page__icon-btn"
                aria-label="Редактировать данные профиля"
                onClick={() => setProfileEditOpen(true)}
              >
                <PencilGlyph />
              </button>
              <button type="button" className="btn btn--primary profile-page__logout" onClick={logout}>
                Выйти
              </button>
            </div>
          </header>
          <div className="profile-page__divider" role="presentation" />

          <section className="profile-hero" aria-label="Сводка профиля">
            <div className="profile-hero__identity">
              <div className="profile-hero__avatar-wrap">
                <div className="profile-hero__avatar" aria-hidden={!!user.avatarUrl}>
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
                </div>
              </div>
              <div className="profile-hero__text">
                <p className="profile-hero__name">{user.fullName || 'Без имени'}</p>
                <p className="profile-hero__since">На Rento — ваш личный кабинет</p>
                <p className="profile-hero__account">Аккаунт: {formatAccountId(user.id)}</p>
              </div>
            </div>

            <div className="profile-hero__rating-card">
              <div className="profile-hero__rating-top">
                <span className="profile-hero__rating-value">{userRatingValue}</span>
                <ProfileStarRow rating={userRating} />
              </div>
              <p className="profile-hero__reviews">
                {userReviewsCount > 0 ? reviewsLabel(userReviewsCount) : 'Оценок пока нет'}
              </p>
              <p className="profile-hero__trust-level">
                Рейтинг зависит только от оценок пользователей
              </p>
            </div>

            <div className="profile-hero__wallet-card">
              <div className="profile-hero__wallet-icon" aria-hidden>
                <WalletGlyph muted={false} />
              </div>
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
            {trust ? <div className="profile-trust-score-badge">{trust.currentScore}</div> : null}
            <p className="profile-panel__hint">
              Индекс доверия учитывает только историю возвратов по завершённым сделкам.
            </p>
            {trust ? (
              <>
                <div className="profile-trust" style={{ marginTop: 'var(--sp-3)' }}>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Подтверждение личности</span>
                    <span className="profile-trust__value">Скоро</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Возвраты в срок</span>
                    <span className="profile-trust__value">
                      {calculateOnTimeReturnsRate(trust.totalDeals, trust.lateReturns)}%
                    </span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Всего сделок</span>
                    <span className="profile-trust__value">{trust.totalDeals}</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Успешных сделок</span>
                    <span className="profile-trust__value">{trust.successfulDeals}</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Просроченных возвратов</span>
                    <span className="profile-trust__value">{trust.lateReturns}</span>
                  </div>
                  <div className="profile-trust__item">
                    <span className="profile-trust__label">Отзывы</span>
                    <span className="profile-trust__value">
                      {userReviewsCount > 0 ? `Оценка ${userRatingValue}` : 'Оценка —'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="profile-panel__hint" style={{ marginTop: 'var(--sp-3)' }}>
                Индекс пока не рассчитан. Появится после первой синхронизации данных профиля.
              </p>
            )}
          </section>

          <div className="profile-layout profile-layout--dashboard">
            <aside className="profile-aside" aria-label="Статус и данные">
              <div className="profile-aside__verify">
                <div className="profile-aside__verify-icon" aria-hidden>
                  <ShieldGlyph />
                </div>
                <div>
                  <p className="profile-aside__verify-title">
                    {user.isVerified ? 'Email подтверждён' : 'Статус не подтверждён'}
                  </p>
                  <p className="profile-aside__verify-text">
                    {user.isVerified
                      ? 'Подтверждение личности через Госуслуги появится в следующей версии.'
                      : 'Подтвердите email, чтобы разблокировать все функции сервиса.'}
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
                  <span className="profile-stat-card__value">{trust?.totalDeals ?? 0}</span>
                </div>
                <div className="profile-stat-card">
                  <span className="profile-stat-card__icon profile-stat-card__icon--plus" aria-hidden>
                    +
                  </span>
                  <div>
                    <p className="profile-stat-card__label">Объявления</p>
                    <p className="profile-stat-card__hint">Активные</p>
                  </div>
                  <span className="profile-stat-card__value">{activeListingsCount}</span>
                </div>
              </div>

              <section className="profile-aside__data" aria-labelledby="profile-user-data-title">
                <h2 id="profile-user-data-title" className="profile-aside__data-title">
                  Данные пользователя
                </h2>
                {user.phone ? (
                  <div className="profile-aside__row">
                    <PhoneGlyph />
                    <span>{user.phone}</span>
                  </div>
                ) : (
                  <div className="profile-aside__row">
                    <PhoneGlyph />
                    <span className="profile-aside__muted">Телефон не указан</span>
                  </div>
                )}
                {user.email ? (
                  <div className="profile-aside__row">
                    <MailGlyph />
                    <span>{user.email}</span>
                  </div>
                ) : null}
                <div className="profile-aside__row">
                  <HomeGlyph />
                  <span className="profile-aside__muted">Адрес в профиле пока не хранится</span>
                </div>
                <div className="profile-aside__row">
                  <ShieldGlyph />
                  <span>{accountStatusLabel(user.status)}</span>
                </div>
                {user.role === 'ADMIN' ? (
                  <p className="profile-aside__role">Роль: администратор</p>
                ) : null}
              </section>
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
                  <>
                    <ul className="profile-bank-cards" aria-label="Привязанные банковские карты">
                      {visibleCards.map((card) => (
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
                    {cards.length > PROFILE_CARDS_PREVIEW ? (
                      <button
                        type="button"
                        className="btn btn--ghost profile-expand-more-btn"
                        onClick={() => setProfileFullListOpen('cards')}
                      >
                        Показать все карты ({cards.length})
                        <span className="profile-expand-more-btn__chevron" aria-hidden>
                          ▼
                        </span>
                      </button>
                    ) : null}
                  </>
                )}
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

            <ProfileEditModal
              open={profileEditOpen}
              onClose={() => setProfileEditOpen(false)}
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
                <>
                  <div className="profile-listings-grid">
                    {visibleListings.map((listing) => (
                      <div key={listing.id} className="profile-listing-card profile-listing-card--tile">
                        <Link
                          to={
                            listing.status === 'DRAFT'
                              ? `/listings/${listing.id}/edit`
                              : `/listings/${listing.id}`
                          }
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
                              {formatListingRentalPriceRu(
                                listing.rentalPrice,
                                listing.rentalPeriod as RentalPeriod,
                              )}
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
                            to={`/listings/${listing.id}/edit`}
                            className="btn btn--ghost"
                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                          >
                            Изменить
                          </Link>
                          <Link
                            to={`/listings/${listing.id}/calendar`}
                            className="btn btn--ghost"
                            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                          >
                            Календарь
                          </Link>
                          <button
                            type="button"
                            onClick={() => openListingDeleteModal(listing.id, listing.title)}
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
                  {listingsTotalPages > 1 ? (
                    <div className="profile-listings-pagination">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={currentListingsPage === 1}
                        onClick={() => setListingsPage(Math.max(1, currentListingsPage - 1))}
                      >
                        Назад
                      </button>
                      <span className="profile-listings-pagination__meta">
                        Страница {currentListingsPage} из {listingsTotalPages}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={currentListingsPage === listingsTotalPages}
                        onClick={() =>
                          setListingsPage(Math.min(listingsTotalPages, currentListingsPage + 1))
                        }
                      >
                        Далее
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>

      <ProfileFullListModal
        title="Все привязанные карты"
        open={profileFullListOpen === 'cards'}
        onClose={() => setProfileFullListOpen(null)}
      >
        <ul className="profile-bank-cards" aria-label="Все банковские карты">
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
      </ProfileFullListModal>

      {listingDeleteTarget ? (
        <div
          className="modal"
          role="presentation"
          onClick={() => {
            if (!listingDeleteSubmitting) {
              setListingDeleteTarget(null)
              setListingDeleteError(null)
            }
          }}
        >
          <div
            className="modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-delete-listing-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal__close"
              aria-label="Закрыть"
              disabled={listingDeleteSubmitting}
              onClick={() => {
                setListingDeleteTarget(null)
                setListingDeleteError(null)
              }}
            >
              ×
            </button>
            <h2 id="profile-delete-listing-title" className="modal__title" style={{ marginTop: 0 }}>
              Удалить объявление?
            </h2>
            <p className="modal__subtitle" style={{ marginBottom: 'var(--sp-4)' }}>
              Объявление «
              <strong style={{ wordBreak: 'break-word' }}>{listingDeleteTarget.title}</strong>» будет
              удалено без возможности восстановления. Активные карточки исчезнут из каталога, черновики
              тоже.
            </p>
            {listingDeleteError ? (
              <div className="alert alert--error" style={{ marginBottom: 'var(--sp-3)' }}>
                {listingDeleteError}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn--ghost-solid"
                disabled={listingDeleteSubmitting}
                onClick={() => {
                  setListingDeleteTarget(null)
                  setListingDeleteError(null)
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={listingDeleteSubmitting}
                onClick={() => void handleListingDeleteConfirm()}
              >
                {listingDeleteSubmitting ? 'Удаление…' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function PencilGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function ProfileStarRow({ rating }: { rating: number }) {
  const safeRating = Math.min(5, Math.max(0, rating))
  const filled = Math.round(safeRating)
  const label = `${formatStarRating(safeRating)} из 5`
  return (
    <div className="profile-hero__stars" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={i < filled ? 'profile-hero__star profile-hero__star--on' : 'profile-hero__star'}
          aria-hidden
        >
          ★
        </span>
      ))}
    </div>
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

function WalletGlyph({ muted = true }: { muted?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden
      style={muted ? { opacity: 0.45 } : undefined}
      stroke="currentColor"
      fill="none"
      strokeWidth="1.6"
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
