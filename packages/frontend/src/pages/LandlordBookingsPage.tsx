import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { bookingStatusLabel } from '../bookings/bookingUi'
import { listBookingsAsLandlord, type BookingListItem } from '../bookings/bookingsApi'
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

export function LandlordBookingsPage() {
  const { accessToken, user } = useAuth()
  const [items, setItems] = useState<BookingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) {
      setLoading(false)
      setItems([])
      return
    }
    const token = accessToken
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await listBookingsAsLandlord(token)
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
  }, [accessToken])

  if (!user) {
    return (
      <main className="bookings-page">
        <div className="container bookings-page__inner">
          <p className="status">Войдите, чтобы видеть брони по вашим объявлениям.</p>
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
          <h1 className="bookings-page__title">Брони по моим объявлениям</h1>
          <p className="bookings-page__subtitle">
            Арендаторы, даты и статус блокировки средств по вашим вещам.
          </p>
        </header>

        <nav className="bookings-page__tabs" aria-label="Режим списка бронирований">
          <Link to="/bookings">Арендую</Link>
          <span aria-current="page">Сдаю</span>
        </nav>

        {error ? <div className="alert alert--error">{error}</div> : null}

        {loading ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 'var(--r-md)' }} />
        ) : items.length === 0 ? (
          <p className="status">Пока никто не бронировал ваши опубликованные объявления.</p>
        ) : (
          <ul className="bookings-page__list">
            {items.map((b) => (
              <li key={b.id} className="bookings-page__card">
                <div className="bookings-page__card-main">
                  <Link to={`/bookings/${b.id}`} className="bookings-page__card-title">
                    {b.listingTitle}
                  </Link>
                  <p className="bookings-page__card-meta">
                    {formatRange(b)}
                    {b.renterLabel ? ` · ${b.renterLabel}` : ''}
                  </p>
                  <p className="bookings-page__card-amounts">
                    Аренда {formatMoneyRub(b.rentAmount)} · Залог {formatMoneyRub(b.depositAmount)} · Итого{' '}
                    {formatMoneyRub(b.totalAmount)}
                  </p>
                </div>
                <div className="bookings-page__card-side">
                  <span className="bookings-page__status">{bookingStatusLabel(b.status)}</span>
                  <Link
                    to={`/listings/${b.listingId}`}
                    className="btn btn--ghost"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    Объявление
                  </Link>
                  <Link
                    to={`/bookings/${b.id}`}
                    className="btn btn--ghost"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    Сделка
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
