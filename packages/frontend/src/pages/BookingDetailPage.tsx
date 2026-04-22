import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { bookingStatusLabel } from '../bookings/bookingUi'
import { getBooking, retryBookingPayment, type BookingDetail } from '../bookings/bookingsApi'
import { listPaymentMethods, type BankCard } from '../payments/paymentMethodsApi'
import { ApiError } from '../lib/apiClient'

const STUB_CARD_BALANCE_KEY = 'rento_stub_card_balance'

function formatMoneyRub(n: number): string {
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
}

export function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const { accessToken, user } = useAuth()

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cards, setCards] = useState<BankCard[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [stubBalance, setStubBalance] = useState('')
  const [retrySubmitting, setRetrySubmitting] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const loadBooking = useCallback(async () => {
    if (!bookingId || !accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await getBooking(bookingId, accessToken)
      setBooking(data)
    } catch (err: unknown) {
      setBooking(null)
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить сделку')
    } finally {
      setLoading(false)
    }
  }, [bookingId, accessToken])

  useEffect(() => {
    void loadBooking()
  }, [loadBooking])

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      const s = sessionStorage.getItem(STUB_CARD_BALANCE_KEY)
      if (s != null) setStubBalance(s)
    }
  }, [])

  useEffect(() => {
    if (!accessToken || !booking || booking.role !== 'renter' || booking.status !== 'PAYMENT_FAILED') {
      return
    }
    let cancelled = false
    async function loadCards() {
      try {
        const items = await listPaymentMethods(accessToken)
        if (cancelled) return
        setCards(items)
        const def = items.find((c) => c.isDefault) ?? items[0]
        setSelectedCardId(def?.id ?? null)
      } catch {
        if (!cancelled) {
          setCards([])
        }
      }
    }
    void loadCards()
    return () => {
      cancelled = true
    }
  }, [accessToken, booking])

  const handleRetry = async () => {
    if (!bookingId || !accessToken || !selectedCardId) return
    setRetrySubmitting(true)
    setRetryError(null)
    try {
      const stubParsed = stubBalance.trim() === '' ? undefined : Number(stubBalance.replace(',', '.'))
      const stubBalanceRub =
        stubParsed != null && Number.isFinite(stubParsed) ? stubParsed : undefined
      if (stubBalanceRub != null && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STUB_CARD_BALANCE_KEY, stubBalance)
      }
      await retryBookingPayment(
        bookingId,
        { cardId: selectedCardId, ...(stubBalanceRub != null ? { stubBalanceRub } : {}) },
        accessToken,
      )
      await loadBooking()
    } catch (err: unknown) {
      setRetryError(err instanceof ApiError ? err.message : 'Повтор не удался')
    } finally {
      setRetrySubmitting(false)
    }
  }

  if (!user) {
    return (
      <main className="bookings-page">
        <div className="container bookings-page__inner">
          <p className="status">Войдите, чтобы открыть сделку.</p>
          <Link to="/" className="btn btn--brand">
            На главную
          </Link>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="bookings-page">
        <div className="container bookings-page__inner">
          <div className="skeleton" style={{ height: 200, borderRadius: 'var(--r-md)' }} />
        </div>
      </main>
    )
  }

  if (error || !booking) {
    return (
      <main className="bookings-page">
        <div className="container bookings-page__inner">
          <div className="alert alert--error">{error ?? 'Сделка не найдена'}</div>
          <Link to="/bookings" className="btn btn--brand" style={{ marginTop: 'var(--sp-4)' }}>
            Мои бронирования
          </Link>
        </div>
      </main>
    )
  }

  const showRetry =
    booking.role === 'renter' && booking.status === 'PAYMENT_FAILED' && cards.length > 0

  return (
    <main className="bookings-page">
      <div className="container bookings-page__inner">
        <nav className="bookings-page__crumbs" aria-label="Навигация">
          <Link to="/">Главная</Link>
          <span aria-hidden> / </span>
          {booking.role === 'renter' ? (
            <Link to="/bookings">Мои бронирования</Link>
          ) : (
            <Link to="/bookings/hosting">Брони по объявлениям</Link>
          )}
        </nav>

        <header className="bookings-page__head">
          <h1 className="bookings-page__title">{booking.listingTitle}</h1>
          <p className="bookings-page__subtitle">
            Статус: <strong>{bookingStatusLabel(booking.status)}</strong>
            {booking.role === 'renter' ? ' · вы арендатор' : ' · вы арендодатель'}
          </p>
        </header>

        <section className="bookings-page__panel" aria-label="Суммы и даты">
          <dl className="bookings-page__dl">
            <div>
              <dt>Период</dt>
              <dd>
                {booking.startAt && booking.endAt
                  ? `${new Date(booking.startAt).toLocaleString('ru-RU')} — ${new Date(booking.endAt).toLocaleString('ru-RU')}`
                  : `${booking.startDate} — ${booking.endDate}`}
              </dd>
            </div>
            <div>
              <dt>Аренда</dt>
              <dd>{formatMoneyRub(booking.rentAmount)}</dd>
            </div>
            <div>
              <dt>Залог</dt>
              <dd>{formatMoneyRub(booking.depositAmount)}</dd>
            </div>
            <div>
              <dt>Итого к блокировке</dt>
              <dd>{formatMoneyRub(booking.totalAmount)}</dd>
            </div>
            {booking.amountHeld != null ? (
              <div>
                <dt>Заблокировано</dt>
                <dd>{formatMoneyRub(booking.amountHeld)}</dd>
              </div>
            ) : null}
            {booking.paymentHoldId ? (
              <div>
                <dt>Hold ID</dt>
                <dd style={{ wordBreak: 'break-all' }}>{booking.paymentHoldId}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {booking.status === 'CONFIRMED' || booking.status === 'ACTIVE' ? (
          <div className="alert alert--success" style={{ marginTop: 'var(--sp-4)' }}>
            Средства заблокированы на карте арендатора (Escrow). Календарь объявления обновлён на стороне сервера.
          </div>
        ) : null}

        {showRetry ? (
          <section className="bookings-page__panel" aria-labelledby="retry-pay-title">
            <h2 id="retry-pay-title" className="bookings-page__panel-title">
              Повторить блокировку с другой картой
            </h2>
            <p className="bookings-page__fineprint">
              Выберите привязанную карту. При необходимости укажите демо-баланс для заглушки холда.
            </p>
            <ul className="listing-booking-card-select" style={{ marginTop: 'var(--sp-3)' }}>
              {cards.map((card) => (
                <li key={card.id}>
                  <label className="listing-booking-card-select__row">
                    <input
                      type="radio"
                      name="retry-card"
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
            <div className="field" style={{ marginTop: 'var(--sp-3)' }}>
              <label className="field__label" htmlFor="detail-stub-balance">
                Условный баланс (демо), ₽
              </label>
              <input
                id="detail-stub-balance"
                className="field__input"
                type="number"
                min={0}
                step={100}
                value={stubBalance}
                onChange={(e) => setStubBalance(e.target.value)}
              />
            </div>
            {retryError ? <div className="alert alert--error">{retryError}</div> : null}
            <button
              type="button"
              className="btn btn--brand"
              style={{ marginTop: 'var(--sp-3)' }}
              disabled={retrySubmitting || !selectedCardId}
              onClick={() => void handleRetry()}
            >
              {retrySubmitting ? 'Повтор…' : 'Повторить блокировку'}
            </button>
          </section>
        ) : booking.role === 'renter' && booking.status === 'PAYMENT_FAILED' && cards.length === 0 ? (
          <div className="alert alert--error" style={{ marginTop: 'var(--sp-4)' }}>
            Нет привязанных карт для повтора. Добавьте карту в{' '}
            <Link to="/profile">профиле</Link>.
          </div>
        ) : null}

        <p style={{ marginTop: 'var(--sp-5)' }}>
          <Link to={`/listings/${booking.listingId}`} className="btn btn--ghost">
            К объявлению
          </Link>
        </p>
      </div>
    </main>
  )
}
