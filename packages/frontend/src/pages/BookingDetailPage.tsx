import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { bookingStatusLabel } from '../bookings/bookingUi'
import {
  cancelBooking,
  confirmBookingReturn,
  getBooking,
  retryBookingPayment,
  type BookingDetail,
} from '../bookings/bookingsApi'
import { listPaymentMethods, type BankCard } from '../payments/paymentMethodsApi'
import { ApiError } from '../lib/apiClient'

const STUB_CARD_BALANCE_KEY = 'rento_stub_card_balance'

function formatMoneyRub(n: number): string {
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
}

function formatDateTimeRu(value: string): string {
  return new Date(value).toLocaleString('ru-RU')
}

export function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const { accessToken, user } = useAuth()

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cards, setCards] = useState<BankCard[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [stubBalance, setStubBalance] = useState(() => {
    if (typeof sessionStorage === 'undefined') return ''
    return sessionStorage.getItem(STUB_CARD_BALANCE_KEY) ?? ''
  })
  const [retrySubmitting, setRetrySubmitting] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnError, setReturnError] = useState<string | null>(null)
  const [returnNotice, setReturnNotice] = useState<string | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const loadBooking = useCallback(async () => {
    if (!bookingId || !accessToken) return
    await Promise.resolve()
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
    if (!bookingId || !accessToken) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      void loadBooking()
    })
    return () => {
      cancelled = true
    }
  }, [bookingId, accessToken, loadBooking])

  useEffect(() => {
    if (!accessToken || !booking || booking.role !== 'renter' || booking.status !== 'PAYMENT_FAILED') {
      return
    }
    const token = accessToken
    let cancelled = false
    async function loadCards() {
      try {
        const items = await listPaymentMethods(token)
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

  const handleConfirmReturn = async () => {
    if (!bookingId || !accessToken) return
    setReturnSubmitting(true)
    setReturnError(null)
    setReturnNotice(null)
    try {
      const updated = await confirmBookingReturn(bookingId, accessToken)
      setBooking(updated)
      if (updated.status === 'COMPLETED') {
        if (updated.settlementStatus === 'SETTLED') {
          setReturnNotice('Сделка завершена, расчёт выполнен.')
        } else if (updated.settlementStatus === 'FAILED') {
          setReturnNotice(
            'Сделка закрыта, но расчёт не прошёл. Нажмите «Повторить расчёт» или обновите страницу.',
          )
        } else {
          setReturnNotice(
            'Возврат подтверждён обеими сторонами. Сделка завершена, выполняется расчёт.',
          )
        }
      } else {
        setReturnNotice('Подтверждение отправлено. Ожидаем подтверждение второй стороны.')
      }
    } catch (err: unknown) {
      setReturnError(err instanceof ApiError ? err.message : 'Не удалось подтвердить завершение аренды')
    } finally {
      setReturnSubmitting(false)
    }
  }

  const handleCancelBookingConfirm = async () => {
    if (!bookingId || !accessToken || !booking) return
    const role = booking.role
    setCancelSubmitting(true)
    setCancelError(null)
    try {
      await cancelBooking(bookingId, accessToken)
      setCancelModalOpen(false)
      const target = role === 'landlord' ? '/bookings/hosting' : '/bookings'
      navigate(target, { replace: true })
    } catch (err: unknown) {
      setCancelError(err instanceof ApiError ? err.message : 'Не удалось отменить бронирование')
    } finally {
      setCancelSubmitting(false)
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

  if (!bookingId) {
    return (
      <main className="bookings-page">
        <div className="container bookings-page__inner">
          <div className="alert alert--error">Сделка не найдена</div>
          <Link to="/bookings" className="btn btn--brand" style={{ marginTop: 'var(--sp-4)' }}>
            Мои бронирования
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
  const canRetrySettlement =
    booking.status === 'COMPLETED' &&
    Boolean(booking.paymentHoldId) &&
    booking.settlementStatus != null &&
    booking.settlementStatus !== 'SETTLED'
  const canConfirmReturn =
    booking.status === 'CONFIRMED' ||
    booking.status === 'ACTIVE' ||
    canRetrySettlement
  const returnHelpText =
    booking.role === 'landlord'
      ? 'Завершить сделку. Средства будут возвращены, только когда арендатор подтвердит это.'
      : 'Сделка будет завершена, когда арендодатель подтвердит это.'
  const depositReleaseDeadline = booking.completedAt
    ? new Date(new Date(booking.completedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null

  const canCancelBooking = [
    'PENDING',
    'PENDING_PAYMENT',
    'PAYMENT_FAILED',
    'CONFIRMED',
    'ACTIVE',
  ].includes(booking.status)

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

        {canCancelBooking ? (
          <section
            className="bookings-page__panel"
            aria-labelledby="cancel-booking-title"
            style={{ marginTop: 'var(--sp-4)' }}
          >
            <h2 id="cancel-booking-title" className="bookings-page__panel-title">
              Отмена аренды
            </h2>
            <p className="bookings-page__fineprint">
              {booking.status === 'CONFIRMED' || booking.status === 'ACTIVE'
                ? 'Блокировка средств на карте будет снята, занятые даты в календаре освободятся.'
                : 'Бронирование будет отменено.'}
            </p>
            <button
              type="button"
              className="btn btn--danger"
              style={{ marginTop: 'var(--sp-3)' }}
              disabled={cancelSubmitting}
              onClick={() => {
                setCancelError(null)
                setCancelModalOpen(true)
              }}
            >
              Отменить аренду
            </button>
          </section>
        ) : null}

        {cancelModalOpen ? (
          <div
            className="modal"
            role="presentation"
            onClick={() => {
              if (!cancelSubmitting) {
                setCancelModalOpen(false)
                setCancelError(null)
              }
            }}
          >
            <div
              className="modal__dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-booking-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal__close"
                aria-label="Закрыть"
                disabled={cancelSubmitting}
                onClick={() => {
                  setCancelModalOpen(false)
                  setCancelError(null)
                }}
              >
                ×
              </button>
              <h2 id="cancel-booking-modal-title" className="modal__title" style={{ marginTop: 0 }}>
                Отменить бронирование?
              </h2>
              <p className="modal__subtitle" style={{ marginBottom: 'var(--sp-4)' }}>
                {booking.status === 'CONFIRMED' || booking.status === 'ACTIVE'
                  ? 'Блокировка средств на карте будет снята, занятые даты в календаре освободятся. Сделку нельзя будет восстановить.'
                  : 'Бронирование будет отменено. Продолжить?'}
              </p>
              {cancelError ? (
                <div className="alert alert--error" style={{ marginBottom: 'var(--sp-3)' }}>
                  {cancelError}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn--ghost-solid"
                  disabled={cancelSubmitting}
                  onClick={() => {
                    setCancelModalOpen(false)
                    setCancelError(null)
                  }}
                >
                  Нет, оставить
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={cancelSubmitting}
                  onClick={() => void handleCancelBookingConfirm()}
                >
                  {cancelSubmitting ? 'Отмена…' : 'Да, отменить'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {booking.status === 'CONFIRMED' || booking.status === 'ACTIVE' ? (
          <div className="alert alert--success" style={{ marginTop: 'var(--sp-4)' }}>
            Средства заблокированы на карте арендатора (Escrow). Календарь объявления обновлён на стороне сервера.
          </div>
        ) : null}

        {canConfirmReturn ? (
          <section className="bookings-page__panel" aria-labelledby="return-confirm-title">
            <h2 id="return-confirm-title" className="bookings-page__panel-title">
              {canRetrySettlement ? 'Расчёт по сделке' : 'Завершение аренды'}
            </h2>
            <p className="bookings-page__fineprint">
              {canRetrySettlement
                ? 'Ранее расчёт не удался (например, из‑за суммы или сети). Нажмите, чтобы повторить списание аренды и разблокировку залога.'
                : returnHelpText}
            </p>
            {canRetrySettlement && booking.settlementError ? (
              <div className="alert alert--error" style={{ marginTop: 'var(--sp-3)' }}>
                {booking.settlementError}
              </div>
            ) : null}
            {returnError ? <div className="alert alert--error">{returnError}</div> : null}
            {returnNotice ? <div className="alert alert--success">{returnNotice}</div> : null}
            <button
              type="button"
              className="btn btn--brand"
              style={{ marginTop: 'var(--sp-3)' }}
              disabled={returnSubmitting}
              onClick={() => void handleConfirmReturn()}
            >
              {returnSubmitting
                ? 'Подтверждение…'
                : canRetrySettlement
                  ? 'Повторить расчёт'
                  : 'Подтвердить завершение аренды'}
            </button>
          </section>
        ) : null}

        {booking.status === 'COMPLETED' ? (
          <section className="bookings-page__panel" aria-labelledby="deposit-release-title">
            <h2 id="deposit-release-title" className="bookings-page__panel-title">
              Возврат залога
            </h2>
            {booking.settlementStatus === 'SETTLED' ? (
              <div className="alert alert--success">
                {booking.role === 'renter'
                  ? booking.depositAmount > 0
                    ? `Сделка завершена. Залог ${formatMoneyRub(booking.depositAmount)} разблокирован.`
                    : 'Сделка завершена. Залог по объявлению не взимался.'
                  : `Сделка завершена. Аренда ${formatMoneyRub(booking.rentAmount)} зачислена.`}
              </div>
            ) : (
              <div className="alert alert--error">
                Расчёт ещё не завершён (статус: {booking.settlementStatus}
                {booking.settlementError ? `: ${booking.settlementError}` : ''}).
                {canRetrySettlement
                  ? ' Используйте кнопку «Повторить расчёт» выше.'
                  : ' Если проблема не исчезнет, обратитесь в поддержку.'}
              </div>
            )}
            <p className="bookings-page__fineprint" style={{ marginTop: 'var(--sp-3)' }}>
              Перевод и разблокировка средств обычно выполняются в течение 24 часов после закрытия сделки.
              {depositReleaseDeadline ? ` Ожидаемый срок: до ${formatDateTimeRu(depositReleaseDeadline)}.` : ''}
            </p>
          </section>
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
