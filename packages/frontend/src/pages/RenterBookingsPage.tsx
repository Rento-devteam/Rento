import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { bookingStatusLabel } from '../bookings/bookingUi'
import { listBookingsAsRenter, type BookingListItem } from '../bookings/bookingsApi'
import { ApiError } from '../lib/apiClient'

function formatMoneyRub(n: number): string {
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
}

function formatRange(b: BookingListItem): string {
  if (b.startAt && b.endAt) {
    return `${new Date(b.startAt).toLocaleString('ru-RU')} — ${new Date(b.endAt).toLocaleString('ru-RU')}`
  }
  return `${b.startDate} — ${b.endDate}`
}

export function RenterBookingsPage() {
  const location = useLocation()
  const { accessToken, user } = useAuth()
  const [items, setItems] = useState<BookingListItem[]>([])
  const [loading, setLoading] = useState(() => Boolean(accessToken))
  const [error, setError] = useState<string | null>(null)

  const displayItems = accessToken ? items : []
  const displayError = accessToken ? error : null
  const displayLoading = accessToken ? loading : false

  useEffect(() => {
    if (!accessToken) return
    const token = accessToken
    let cancelled = false
    async function load() {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      setError(null)
      try {
        const res = await listBookingsAsRenter(token)
        if (!cancelled) setItems(res.items)
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Не удалось загрузить бронирования')
          setItems([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken, location.key])

  if (!user) {
    return (
      <main className="bookings-page">
        <div className="container bookings-page__inner">
          <p className="status">Войдите, чтобы видеть свои бронирования.</p>
          <Link to="/" className="btn btn--brand">
            На главную
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="bookings-page">
      <div className="container bookings-page__inner">
        <header className="bookings-page__head">
          <h1 className="bookings-page__title">Мои бронирования</h1>
          <p className="bookings-page__subtitle">
            Сделки, где вы арендатор: статус, суммы и переход к карточке сделки.
          </p>
        </header>

        <nav className="bookings-page__tabs" aria-label="Режим списка бронирований">
          <span aria-current="page">Арендую</span>
          <Link to="/bookings/hosting">Сдаю</Link>
        </nav>

        {displayError ? <div className="alert alert--error">{displayError}</div> : null}

        {displayLoading ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 'var(--r-md)' }} />
        ) : displayItems.length === 0 ? (
          <p className="status">Пока нет бронирований.</p>
        ) : (
          <ul className="bookings-page__list">
            {displayItems.map((b) => (
              <li
                key={b.id}
                className={`bookings-page__card ${b.status === 'COMPLETED' ? 'bookings-page__card--completed' : ''}`}
              >
                <div className="bookings-page__card-main">
                  <Link to={`/bookings/${b.id}`} className="bookings-page__card-title">
                    {b.listingTitle}
                  </Link>
                  <p className="bookings-page__card-meta">{formatRange(b)}</p>
                  <p className="bookings-page__card-amounts">
                    Аренда {formatMoneyRub(b.rentAmount)} · Залог {formatMoneyRub(b.depositAmount)} · Итого{' '}
                    {formatMoneyRub(b.totalAmount)}
                  </p>
                </div>
                <div className="bookings-page__card-side">
                  {b.status === 'COMPLETED' ? (
                    <span className="bookings-page__done-pill">Сделка завершена</span>
                  ) : null}
                  <span className="bookings-page__status">{bookingStatusLabel(b.status)}</span>
                  <Link
                    to={`/bookings/${b.id}`}
                    className="btn btn--ghost"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    Открыть
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
