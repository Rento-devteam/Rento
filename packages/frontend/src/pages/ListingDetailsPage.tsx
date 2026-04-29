import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { IListing, RentalPeriod } from '@rento/shared'
import { useAuth } from '../auth/AuthContext'
import { createBooking, retryBookingPayment } from '../bookings/bookingsApi'
import { getBookingSummary, type BookingSummaryResponse } from '../bookings/bookingSummaryApi'
import { getListingDetails, getOwnedListingForEdit } from '../catalog/catalogApi'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { ApiError } from '../lib/apiClient'
import { listPaymentMethods, type BankCard } from '../payments/paymentMethodsApi'
import { listingConditionLabelRu } from '../lib/listingConditionRu'
import { getListingDisplayParts } from '../lib/listingDescriptionParts'
import { logListingDetails } from '../lib/listingDetailsDebugLog'
import { LISTING_RENTAL_PRICE_CAPTION } from '../lib/rentalPeriodRu'

const STUB_CARD_BALANCE_KEY = 'rento_stub_card_balance'

function formatMoneyRub(n: number): string {
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function minDatetimeLocalNow(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMilliseconds(0)
  return toDatetimeLocalValue(d)
}

function defaultRangeForPeriod(period: RentalPeriod): { start: Date; end: Date } {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(12, 0, 0, 0)
  const end = new Date(start)
  switch (period) {
    case 'HOUR':
      end.setHours(end.getHours() + 2)
      break
    case 'DAY':
      end.setDate(end.getDate() + 1)
      break
    case 'WEEK':
      end.setDate(end.getDate() + 7)
      break
    case 'MONTH':
      end.setMonth(end.getMonth() + 1)
      break
    default:
      end.setDate(end.getDate() + 1)
  }
  return { start, end }
}

function periodShort(period: RentalPeriod): string {
  switch (period) {
    case 'HOUR':
      return 'час'
    case 'DAY':
      return 'сутки'
    case 'WEEK':
      return 'неделя'
    case 'MONTH':
      return 'месяц'
    default:
      return 'сутки'
  }
}

function periodFull(period: RentalPeriod): string {
  switch (period) {
    case 'HOUR':
      return 'Почасовая'
    case 'DAY':
      return 'Посуточная'
    case 'WEEK':
      return 'Понедельная'
    case 'MONTH':
      return 'Помесячная'
    default:
      return 'Аренда'
  }
}

function bookingActionErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Не удалось создать бронирование'
  }
  if (err.status === 409) {
    return 'Выбранные даты больше недоступны. Измените период и нажмите «Пересчитать».'
  }
  if (err.status === 402) {
    return err.message || 'Не удалось заблокировать средства на карте'
  }
  if (err.status === 403) {
    return err.message
  }
  if (err.status === 404) {
    return 'Нет подходящей карты: привяжите карту в профиле или выберите другую.'
  }
  if (err.status === 401) {
    return 'Сессия истекла. Войдите снова и повторите попытку.'
  }
  return err.message
}

function formatPublished(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function ListingDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, accessToken } = useAuth()

  const [listing, setListing] = useState<IListing | null>(null)
  const [loading, setLoading] = useState(() => Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookStartLocal, setBookStartLocal] = useState('')
  const [bookEndLocal, setBookEndLocal] = useState('')
  const [bookingSummary, setBookingSummary] = useState<BookingSummaryResponse | null>(null)
  const [bookingSummaryLoading, setBookingSummaryLoading] = useState(false)
  const [bookingSummaryError, setBookingSummaryError] = useState<string | null>(null)
  const [stubCardBalance, setStubCardBalance] = useState(() => {
    if (typeof sessionStorage === 'undefined') return ''
    return sessionStorage.getItem(STUB_CARD_BALANCE_KEY) ?? ''
  })
  const [stubCardEditorOpen, setStubCardEditorOpen] = useState(false)

  const [paymentMethods, setPaymentMethods] = useState<BankCard[]>([])
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false)
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingActionError, setBookingActionError] = useState<string | null>(null)
  const [payFailedBookingId, setPayFailedBookingId] = useState<string | null>(null)

  const persistStubBalance = useCallback((value: string) => {
    setStubCardBalance(value)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STUB_CARD_BALANCE_KEY, value)
    }
  }, [])

  const fetchBookingSummary = useCallback(
    async (listingId: string, startLocal: string, endLocal: string) => {
      const startIso = new Date(startLocal).toISOString()
      const endIso = new Date(endLocal).toISOString()
      setBookingSummaryLoading(true)
      setBookingSummaryError(null)
      try {
        const data = await getBookingSummary({
          listingId,
          startAtIso: startIso,
          endAtIso: endIso,
        })
        setBookingSummary(data)
      } catch (err: unknown) {
        setBookingSummary(null)
        setBookingSummaryError(
          err instanceof ApiError ? err.message : 'Не удалось получить расчёт бронирования',
        )
      } finally {
        setBookingSummaryLoading(false)
      }
    },
    [],
  )

  const openBookingStep1 = useCallback(() => {
    if (!listing) return
    const { start, end } = defaultRangeForPeriod(listing.rentalPeriod)
    const s = toDatetimeLocalValue(start)
    const e = toDatetimeLocalValue(end)
    setBookStartLocal(s)
    setBookEndLocal(e)
    setStubCardEditorOpen(false)
    setBookingActionError(null)
    setPayFailedBookingId(null)
    setBookModalOpen(true)
    void fetchBookingSummary(listing.id, s, e)
  }, [listing, fetchBookingSummary])

  const closeBookingModal = useCallback(() => {
    setBookModalOpen(false)
    setPayFailedBookingId(null)
    setBookingActionError(null)
    setPaymentMethods([])
    setPaymentMethodsError(null)
    setPaymentMethodsLoading(false)
    setSelectedCardId(null)
  }, [])

  const photoLightboxSlides = useMemo(() => {
    if (!listing?.photos || !Array.isArray(listing.photos)) return []
    return listing.photos.map((p) => ({ url: p.url, alt: listing.title }))
  }, [listing])

  useEffect(() => {
    if (!bookModalOpen || !accessToken) return
    const token = accessToken
    let cancelled = false
    async function loadCards() {
      await Promise.resolve()
      if (cancelled) return
      setPaymentMethodsLoading(true)
      setPaymentMethodsError(null)
      try {
        const items = await listPaymentMethods(token)
        if (cancelled) return
        setPaymentMethods(items)
        const def = items.find((c) => c.isDefault) ?? items[0]
        setSelectedCardId(def?.id ?? null)
      } catch (err: unknown) {
        if (cancelled) return
        setPaymentMethods([])
        setPaymentMethodsError(
          err instanceof ApiError ? err.message : 'Не удалось загрузить карты',
        )
      } finally {
        if (!cancelled) setPaymentMethodsLoading(false)
      }
    }
    void loadCards()
    return () => {
      cancelled = true
    }
  }, [bookModalOpen, accessToken])

  const handleConfirmBooking = useCallback(async () => {
    if (!listing || !accessToken || !bookStartLocal || !bookEndLocal) return
    setBookingSubmitting(true)
    setBookingActionError(null)
    try {
      const stubParsed =
        stubCardBalance.trim() === '' ? undefined : Number(stubCardBalance.replace(',', '.'))
      const stubBalanceRub =
        stubParsed != null && Number.isFinite(stubParsed) ? stubParsed : undefined
      const res = await createBooking(
        {
          listingId: listing.id,
          startAt: new Date(bookStartLocal).toISOString(),
          endAt: new Date(bookEndLocal).toISOString(),
          ...(selectedCardId ? { cardId: selectedCardId } : {}),
          ...(stubBalanceRub != null ? { stubBalanceRub } : {}),
        },
        accessToken,
      )
      closeBookingModal()
      navigate(`/bookings/${res.bookingId}`)
    } catch (err: unknown) {
      setBookingActionError(bookingActionErrorMessage(err))
      if (err instanceof ApiError && err.status === 402 && err.bookingId) {
        setPayFailedBookingId(err.bookingId)
      }
    } finally {
      setBookingSubmitting(false)
    }
  }, [
    listing,
    accessToken,
    bookStartLocal,
    bookEndLocal,
    selectedCardId,
    stubCardBalance,
    navigate,
    closeBookingModal,
  ])

  const handleRetryHoldInModal = useCallback(async () => {
    if (!accessToken || !payFailedBookingId || !selectedCardId) return
    setBookingSubmitting(true)
    setBookingActionError(null)
    try {
      const stubParsed =
        stubCardBalance.trim() === '' ? undefined : Number(stubCardBalance.replace(',', '.'))
      const stubBalanceRub =
        stubParsed != null && Number.isFinite(stubParsed) ? stubParsed : undefined
      await retryBookingPayment(
        payFailedBookingId,
        { cardId: selectedCardId, ...(stubBalanceRub != null ? { stubBalanceRub } : {}) },
        accessToken,
      )
      closeBookingModal()
      navigate(`/bookings/${payFailedBookingId}`)
    } catch (err: unknown) {
      setBookingActionError(bookingActionErrorMessage(err))
    } finally {
      setBookingSubmitting(false)
    }
  }, [accessToken, payFailedBookingId, selectedCardId, stubCardBalance, navigate, closeBookingModal])

  useEffect(() => {
    if (!id) {
      logListingDetails('skip-load:no-id', { id })
      return
    }
    const listingId = id
    let cancelled = false

    logListingDetails('load:start', {
      listingId,
      hasAccessToken: Boolean(accessToken),
    })

    async function loadListing() {
      setLoading(true)
      setError(null)
      setLightboxIndex(null)
      try {
        const data = await getListingDetails(listingId)
        if (cancelled) {
          logListingDetails('load:cancelled-after-public', { listingId })
          return
        }
        logListingDetails('load:ok-public', {
          listingId,
          status: data.status,
          photosCount: data.photos?.length ?? 0,
          hasCategory: Boolean(data.category),
        })
        setListing(data)
        setActivePhoto(0)
      } catch (err: unknown) {
        logListingDetails('load:public-error', {
          listingId,
          cancelled,
          isApiError: err instanceof ApiError,
          status: err instanceof ApiError ? err.status : undefined,
          message: err instanceof Error ? err.message : String(err),
        })
        if (
          err instanceof ApiError &&
          err.status === 404 &&
          accessToken &&
          !cancelled
        ) {
          try {
            logListingDetails('load:try-owned', { listingId })
            const owned = await getOwnedListingForEdit(listingId, accessToken)
            if (!cancelled) {
              logListingDetails('load:ok-owned', {
                listingId,
                status: owned.status,
                photosCount: owned.photos?.length ?? 0,
              })
              setListing(owned)
              setActivePhoto(0)
              setError(null)
            }
            return
          } catch (ownedErr: unknown) {
            logListingDetails('load:owned-failed', {
              listingId,
              message:
                ownedErr instanceof Error ? ownedErr.message : String(ownedErr),
            })
            // fall through to public error
          }
        }
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) {
            setError(
              accessToken
                ? 'Объявление не найдено или у вас нет доступа к этому черновику.'
                : 'Объявление не найдено. Если это ваш черновик — войдите в аккаунт, чтобы открыть его.',
            )
          } else if (err instanceof Error) {
            setError(err.message.trim() || 'Не удалось загрузить объявление')
          } else {
            setError('Не удалось загрузить объявление')
          }
          setListing(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          logListingDetails('load:finally', { listingId })
        }
      }
    }

    void loadListing()
    return () => {
      cancelled = true
      logListingDetails('load:cleanup', { listingId })
    }
  }, [id, accessToken])

  useEffect(() => {
    logListingDetails('render-state', {
      id,
      loading,
      error: error === null ? null : error === '' ? '(empty string)' : error,
      hasListing: Boolean(listing),
      listingId: listing?.id,
      listingStatus: listing?.status,
    })
  }, [id, loading, error, listing])

  const periodLabel = useMemo(() => (listing ? periodShort(listing.rentalPeriod) : ''), [listing])
  const periodTitle = useMemo(() => (listing ? periodFull(listing.rentalPeriod) : ''), [listing])
  const displayParts = useMemo(
    () => (listing ? getListingDisplayParts(listing.description ?? '') : null),
    [listing],
  )

  const bookingDatetimeMin = minDatetimeLocalNow()

  if (!id) {
    return (
      <main className="listing-page">
        <div className="listing-page__inner container">
          <div className="status status--error">Объявление не найдено</div>
          <Link to="/" className="btn btn--brand" style={{ marginTop: 'var(--sp-4)' }}>
            На главную
          </Link>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="listing-page listing-page--loading">
        <div className="listing-page__inner container">
          <div className="listing-page__skeleton" aria-hidden />
        </div>
      </main>
    )
  }

  if (error || !listing) {
    const errorMessage = error?.trim()
      ? error
      : 'Объявление не найдено или не удалось загрузить данные.'
    return (
      <main className="listing-page">
        <div className="listing-page__inner container">
          <div className="status status--error">{errorMessage}</div>
          <Link to="/" className="btn btn--brand" style={{ marginTop: 'var(--sp-4)' }}>
            На главную
          </Link>
        </div>
      </main>
    )
  }

  const photos = Array.isArray(listing.photos) ? listing.photos : []
  const categoryName = listing.category?.name?.trim() || 'Категория'
  const hasPhotos = photos.length > 0
  const currentPhoto = hasPhotos ? photos[Math.min(activePhoto, photos.length - 1)] : null
  const isDraft = listing.status === 'DRAFT'

  const conditionLabel =
    displayParts?.condition != null && displayParts.condition !== ''
      ? listingConditionLabelRu(displayParts.condition) ?? displayParts.condition
      : null
  const showCharacteristics = Boolean(displayParts?.brand || displayParts?.year || conditionLabel)
  const needsGapBeforeDescription = Boolean(displayParts?.address || showCharacteristics)
  const isOwner = Boolean(user?.id && listing.ownerId === user.id)

  return (
    <main className="listing-page">
      {bookModalOpen && listing ? (
        <div
          className="listing-booking-modal__backdrop"
          role="presentation"
          onClick={closeBookingModal}
        >
          <div
            className="listing-booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="listing-booking-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="listing-booking-modal__head">
              <h2 id="listing-booking-modal-title" className="listing-booking-modal__title">
                Бронирование и блокировка (Escrow)
              </h2>
              <button
                type="button"
                className="listing-booking-modal__close"
                aria-label="Закрыть"
                onClick={closeBookingModal}
              >
                ×
              </button>
            </div>

            <p className="listing-booking-modal__lead">
              Перед подтверждением сделки вы видите расчёт: аренда, залог и сумма, которую банк должен{' '}
              <strong>заблокировать</strong> на карте (авторизационный холд, не списание).
            </p>

            <div className="listing-booking-modal__dates">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field__label" htmlFor="book-start-at">
                  Начало
                </label>
                <input
                  id="book-start-at"
                  className="field__input"
                  type="datetime-local"
                  min={bookingDatetimeMin}
                  value={bookStartLocal}
                  disabled={Boolean(payFailedBookingId)}
                  onChange={(e) => setBookStartLocal(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field__label" htmlFor="book-end-at">
                  Окончание
                </label>
                <input
                  id="book-end-at"
                  className="field__input"
                  type="datetime-local"
                  min={bookStartLocal || bookingDatetimeMin}
                  value={bookEndLocal}
                  disabled={Boolean(payFailedBookingId)}
                  onChange={(e) => setBookEndLocal(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn--ghost"
              style={{ marginTop: 'var(--sp-3)' }}
              disabled={
                Boolean(payFailedBookingId) ||
                bookingSummaryLoading ||
                !bookStartLocal ||
                !bookEndLocal
              }
              onClick={() => void fetchBookingSummary(listing.id, bookStartLocal, bookEndLocal)}
            >
              {bookingSummaryLoading ? 'Расчёт…' : 'Пересчитать'}
            </button>

            {bookingSummaryError ? (
              <div className="alert alert--error" style={{ marginTop: 'var(--sp-3)' }}>
                {bookingSummaryError}
              </div>
            ) : null}

            {!accessToken ? (
              <div className="alert alert--error" style={{ marginTop: 'var(--sp-3)' }}>
                Войдите в аккаунт, чтобы подтвердить бронь и заблокировать средства на карте.
              </div>
            ) : null}

            {bookingActionError ? (
              <div className="alert alert--error" style={{ marginTop: 'var(--sp-3)' }}>
                {bookingActionError}
              </div>
            ) : null}

            {payFailedBookingId ? (
              <div className="alert alert--warning" style={{ marginTop: 'var(--sp-3)' }}>
                Бронь создана, но холд не прошёл (недостаточно средств или отказ банка). Выберите другую
                привязанную карту или измените демо-баланс и нажмите «Повторить блокировку». Даты в этом окне
                зафиксированы для этой брони.
              </div>
            ) : null}

            {bookingSummary && !bookingSummaryLoading ? (
              <div className="listing-booking-modal__totals">
                <div className="listing-booking-modal__row">
                  <span>Аренда</span>
                  <strong>{formatMoneyRub(bookingSummary.rentalAmount)}</strong>
                </div>
                <div className="listing-booking-modal__row">
                  <span>Залог</span>
                  <strong>{formatMoneyRub(bookingSummary.depositAmount)}</strong>
                </div>
                <div className="listing-booking-modal__row listing-booking-modal__row--total">
                  <span>Итого к блокировке</span>
                  <strong>{formatMoneyRub(bookingSummary.totalHoldAmount)}</strong>
                </div>
                <p className="listing-booking-modal__fineprint">
                  Аренда: ставка {formatMoneyRub(listing.rentalPrice)} за {periodShort(listing.rentalPeriod)} ×{' '}
                  {bookingSummary.units.toLocaleString('ru-RU')} ед. тарифа = {formatMoneyRub(bookingSummary.rentalAmount)}.
                  Интервал: {new Date(bookingSummary.startAt).toLocaleString('ru-RU')} —{' '}
                  {new Date(bookingSummary.endAt).toLocaleString('ru-RU')}.
                </p>
              </div>
            ) : bookingSummaryLoading ? (
              <div className="skeleton" style={{ height: 120, marginTop: 'var(--sp-4)', borderRadius: 'var(--r-md)' }} />
            ) : null}

            {accessToken ? (
              <div className="listing-booking-modal__methods">
                <p className="listing-booking-modal__card-label">Карта для блокировки</p>
                {paymentMethodsLoading ? (
                  <div className="skeleton" style={{ height: 56, borderRadius: 'var(--r-md)' }} />
                ) : paymentMethodsError ? (
                  <div className="alert alert--error">{paymentMethodsError}</div>
                ) : paymentMethods.length === 0 ? (
                  <p className="listing-booking-modal__fineprint">
                    Нет привязанных карт. Добавьте карту в{' '}
                    <Link to="/profile" onClick={closeBookingModal}>
                      профиле
                    </Link>
                    .
                  </p>
                ) : (
                  <ul className="listing-booking-card-select" role="listbox" aria-label="Выбор карты">
                    {paymentMethods.map((card) => (
                      <li key={card.id}>
                        <label className="listing-booking-card-select__row">
                          <input
                            type="radio"
                            name="booking-card"
                            checked={selectedCardId === card.id}
                            onChange={() => setSelectedCardId(card.id)}
                          />
                          <span>
                            {card.cardType} •••• {card.last4}
                            {card.isDefault ? ' · по умолчанию' : ''}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="listing-booking-modal__card-stack">
              <p className="listing-booking-modal__card-label">Демо: условный баланс</p>
              <button
                type="button"
                className={`listing-booking-card${stubCardEditorOpen ? ' listing-booking-card--open' : ''}`}
                onClick={() => setStubCardEditorOpen((v) => !v)}
                aria-expanded={stubCardEditorOpen}
              >
                <span className="listing-booking-card__chip">Заглушка</span>
                <span className="listing-booking-card__title">Проверка «хватит ли лимита»</span>
                <span className="listing-booking-card__pan">Нажмите, чтобы ввести баланс</span>
                <span className="listing-booking-card__hint">
                  Значение уходит в запрос как <code>stubBalanceRub</code> и учитывается только в dev-шлюзе холда.
                </span>
              </button>
              {stubCardEditorOpen ? (
                <div className="listing-booking-card__editor">
                  <label className="field__label" htmlFor="stub-card-balance">
                    Условный баланс карты, ₽
                  </label>
                  <input
                    id="stub-card-balance"
                    className="field__input"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={100}
                    placeholder="50000"
                    value={stubCardBalance}
                    onChange={(e) => persistStubBalance(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="field__hint">
                    Если баланс меньше суммы «Итого к блокировке», шлюз-заглушка вернёт отказ (402).
                  </span>
                </div>
              ) : null}
            </div>

            <div className="listing-booking-modal__footer">
              <button type="button" className="btn btn--ghost" onClick={closeBookingModal}>
                Закрыть
              </button>
              {payFailedBookingId ? (
                <button
                  type="button"
                  className="btn btn--brand"
                  disabled={
                    bookingSubmitting ||
                    !accessToken ||
                    paymentMethods.length === 0 ||
                    !selectedCardId
                  }
                  onClick={() => void handleRetryHoldInModal()}
                >
                  {bookingSubmitting ? 'Повтор…' : 'Повторить блокировку'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--brand"
                  disabled={
                    bookingSubmitting ||
                    !bookingSummary ||
                    bookingSummaryLoading ||
                    !accessToken ||
                    paymentMethods.length === 0
                  }
                  onClick={() => void handleConfirmBooking()}
                >
                  {bookingSubmitting ? 'Подтверждение…' : 'Подтвердить бронь'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="listing-page__inner container">
        <div className="listing-page__top">
          <button type="button" className="listing-page__back" onClick={() => navigate('/')}>
            <ChevronBackIcon />
            Назад
          </button>
          <nav className="listing-page__crumbs" aria-label="Навигация по разделам">
            <Link to="/">Главная</Link>
            <span className="listing-page__crumb-sep" aria-hidden>
              /
            </span>
            <span>Каталог</span>
            <span className="listing-page__crumb-sep" aria-hidden>
              /
            </span>
            <span className="listing-page__crumb-current">{categoryName}</span>
          </nav>
        </div>

        <div className="listing-page__layout">
          {listing.status === 'DRAFT' && isOwner ? (
            <div className="listing-page__draft-banner alert">
              Черновик не показывается в каталоге. Загрузите фото и нажмите «Опубликовать» на странице{' '}
              <Link to={`/listings/${listing.id}/edit`}>редактирования</Link>, либо откройте её из профиля.
            </div>
          ) : null}
          <div className="listing-page__main">
            <div className="listing-page__gallery">
              <div className="listing-page__hero">
                {currentPhoto ? (
                  <button
                    type="button"
                    className="listing-page__hero-trigger"
                    onClick={() => setLightboxIndex(activePhoto)}
                    aria-label="Открыть фото на весь экран"
                  >
                    <img src={currentPhoto.url} alt={listing.title} />
                  </button>
                ) : (
                  <div className="listing-page__hero-empty">Нет фотографий</div>
                )}
                {isDraft ? (
                  <span className="listing-page__hero-badge">Черновик</span>
                ) : null}
              </div>

              {hasPhotos ? (
                <div className="listing-page__thumbs" role="tablist" aria-label="Галерея фото">
                  {photos.map((photo, index) => (
                    <button
                      type="button"
                      key={photo.id}
                      role="tab"
                      aria-selected={index === activePhoto}
                      title="Выбрать фото. Двойной щелчок — просмотр на весь экран."
                      className={`listing-page__thumb${index === activePhoto ? ' is-active' : ''}`}
                      onClick={() => setActivePhoto(index)}
                      onDoubleClick={(e) => {
                        e.preventDefault()
                        setActivePhoto(index)
                        setLightboxIndex(index)
                      }}
                    >
                      <img src={photo.thumbnailUrl ?? photo.url} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
              {hasPhotos && currentPhoto ? (
                <p className="listing-page__gallery-hint">
                  Нажмите на большое фото, чтобы открыть его на весь экран. В миниатюрах двойной щелчок тоже
                  открывает просмотр.
                </p>
              ) : null}
            </div>

            <section className="listing-page__about" aria-label="Адрес, характеристики и описание">
              {displayParts?.address ? (
                <>
                  <h2 id="listing-address-heading" className="listing-page__about-title">
                    Адрес
                  </h2>
                  <p className="listing-page__address">{displayParts.address}</p>
                </>
              ) : null}

              {showCharacteristics ? (
                <>
                  <h2
                    id="listing-meta-heading"
                    className={`listing-page__about-title${displayParts?.address ? ' listing-page__about-title--spaced' : ''}`}
                  >
                    Характеристики
                  </h2>
                  <dl className="listing-page__meta-dl">
                    {displayParts?.brand ? (
                      <div className="listing-page__meta-row">
                        <dt className="listing-page__meta-dt">Бренд</dt>
                        <dd className="listing-page__meta-dd">{displayParts.brand}</dd>
                      </div>
                    ) : null}
                    {displayParts?.year ? (
                      <div className="listing-page__meta-row">
                        <dt className="listing-page__meta-dt">Год</dt>
                        <dd className="listing-page__meta-dd">{displayParts.year}</dd>
                      </div>
                    ) : null}
                    {conditionLabel ? (
                      <div className="listing-page__meta-row">
                        <dt className="listing-page__meta-dt">Состояние</dt>
                        <dd className="listing-page__meta-dd">{conditionLabel}</dd>
                      </div>
                    ) : null}
                  </dl>
                </>
              ) : null}

              <h2
                id="listing-desc-heading"
                className={`listing-page__about-title${needsGapBeforeDescription ? ' listing-page__about-title--spaced' : ''}`}
              >
                Описание
              </h2>
              <div className="listing-page__about-body">
                {displayParts?.description ?? listing.description}
              </div>
            </section>
          </div>

          <aside className="listing-page__aside" aria-label="Условия и действия">
            <div className="listing-page__card">
              <div className="listing-page__card-head">
                <span className="listing-page__category">{categoryName}</span>
                {isDraft ? <span className="listing-page__pill listing-page__pill--draft">Не опубликовано</span> : null}
              </div>

              <h1 className="listing-page__title">{listing.title}</h1>

              <div className="listing-page__price-box">
                <div className="listing-page__price-row">
                  <span className="listing-page__price-value">
                    {Math.round(listing.rentalPrice).toLocaleString('ru-RU')}
                    <span className="listing-page__price-currency"> ₽</span>
                  </span>
                  <span className="listing-page__price-period">/ {periodLabel}</span>
                </div>
                <p className="listing-page__price-caption">{LISTING_RENTAL_PRICE_CAPTION}</p>
              </div>

              <dl className="listing-page__specs">
                <div className="listing-page__spec-row">
                  <dt>Тип аренды</dt>
                  <dd>{periodTitle}</dd>
                </div>
                <div className="listing-page__spec-row">
                  <dt>Залог</dt>
                  <dd>
                    {listing.depositAmount > 0
                      ? `${listing.depositAmount.toLocaleString('ru-RU')} ₽`
                      : 'Не требуется'}
                  </dd>
                </div>
                <div className="listing-page__spec-row">
                  <dt>Размещено</dt>
                  <dd>{formatPublished(listing.createdAt)}</dd>
                </div>
              </dl>

              <div className="listing-page__actions">
                {isOwner ? (
                  <Link
                    to={`/listings/${listing.id}/edit`}
                    className="btn btn--brand btn--block listing-page__cta-primary"
                  >
                    {listing.status === 'DRAFT' ? 'Редактировать и опубликовать' : 'Редактировать объявление'}
                  </Link>
                ) : null}
                <Link
                  to={`/listings/${listing.id}/calendar`}
                  className={`btn btn--accent btn--block${isOwner ? '' : ' listing-page__cta-primary'}`}
                >
                  Календарь и даты
                </Link>
                {listing.status === 'ACTIVE' && !isOwner ? (
                  <button
                    type="button"
                    className="btn btn--brand btn--block"
                    onClick={() => void openBookingStep1()}
                  >
                    Забронировать
                  </button>
                ) : null}
                {!isOwner ? (
                  <button type="button" className="btn btn--ghost btn--block" disabled>
                    Написать арендодателю
                  </button>
                ) : null}
              </div>
              <p className="listing-page__actions-hint">
                {listing.status !== 'ACTIVE'
                  ? 'Бронирование доступно только для опубликованных объявлений. Сообщения между пользователями появятся в следующей версии.'
                  : isOwner
                    ? 'Это ваше объявление — бронировать у себя нельзя.'
                    : 'Сообщения между пользователями появятся в следующей версии.'}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <PhotoLightbox
        open={lightboxIndex !== null}
        slides={photoLightboxSlides}
        index={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(i) => {
          setLightboxIndex(i)
          setActivePhoto(i)
        }}
      />
    </main>
  )
}

function ChevronBackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 6l-6 6 6 6"
      />
    </svg>
  )
}
