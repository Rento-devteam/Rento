import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getListingDetails, getOwnedListingForEdit } from '../catalog/catalogApi'
import {
  blockDates,
  checkAvailability,
  getCalendar,
  unblockDates,
  type AvailabilityStatus,
  type CalendarSlot,
} from '../calendar/calendarApi'
import { ApiError } from '../lib/apiClient'

// Helpers for date manipulation
function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addMonths(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getDaysInMonthGrid(date: Date): Date[] {
  const start = startOfMonth(date)

  // Adjust for Monday as first day of week (0 = Mon, 6 = Sun)
  let startDay = start.getDay() - 1
  if (startDay === -1) startDay = 6

  const gridStart = new Date(start)
  gridStart.setDate(gridStart.getDate() - startDay)

  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return fallback
}

export function ManageCalendarPage() {
  const { id: listingId } = useParams<{ id: string }>()
  const { user, accessToken } = useAuth()
  const [listingOwnerId, setListingOwnerId] = useState<string | null>(null)
  const [listingMetaError, setListingMetaError] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [slots, setSlots] = useState<Map<string, CalendarSlot>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectStart, setSelectStart] = useState<string | null>(null)
  const [selectEnd, setSelectEnd] = useState<string | null>(null)

  // Action state
  const [actionPending, setActionPending] = useState(false)
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  const isOwner = Boolean(user?.id && listingOwnerId && user.id === listingOwnerId)

  useEffect(() => {
    if (!listingId) return
    const calendarListingId = listingId
    let cancelled = false
    async function loadListingMeta() {
      setListingMetaError(null)
      try {
        if (accessToken) {
          try {
            const owned = await getOwnedListingForEdit(calendarListingId, accessToken)
            if (!cancelled) {
              setListingOwnerId(owned.ownerId)
            }
            return
          } catch (err: unknown) {
            if (!(err instanceof ApiError && err.status === 404)) {
              throw err
            }
          }
        }
        const listing = await getListingDetails(calendarListingId)
        if (!cancelled) {
          setListingOwnerId(listing.ownerId)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setListingOwnerId(null)
          setListingMetaError(getErrorMessage(err, 'Не удалось загрузить объявление'))
        }
      }
    }
    void loadListingMeta()
    return () => {
      cancelled = true
    }
  }, [listingId, accessToken])

  useEffect(() => {
    if (!listingId) return
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Load current month +/- 1 month to cover grid
        const start = toISODate(addMonths(currentMonth, -1))
        const end = toISODate(addMonths(currentMonth, 2))
        const res = await getCalendar(listingId!, start, end)
        
        const map = new Map<string, CalendarSlot>()
        res.items.forEach(item => map.set(item.date, item))
        setSlots(map)
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Не удалось загрузить календарь'))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [listingId, currentMonth])

  const gridDays = useMemo(() => getDaysInMonthGrid(currentMonth), [currentMonth])

  const handleDayClick = (isoDate: string) => {
    if (!isOwner) return
    if (!selectStart || (selectStart && selectEnd)) {
      setSelectStart(isoDate)
      setSelectEnd(null)
      setConflictWarning(null)
    } else {
      // Ensure start is before end
      const d1 = parseISODate(selectStart)
      const d2 = parseISODate(isoDate)
      if (d1.getTime() > d2.getTime()) {
        setSelectEnd(selectStart)
        setSelectStart(isoDate)
      } else {
        setSelectEnd(isoDate)
      }
      setConflictWarning(null)
    }
  }

  const getSlotStatus = (isoDate: string): AvailabilityStatus => {
    return slots.get(isoDate)?.status || 'AVAILABLE'
  }

  const isSelected = (isoDate: string) => {
    if (!selectStart) return false
    if (!selectEnd) return isoDate === selectStart
    const d = parseISODate(isoDate).getTime()
    const s = parseISODate(selectStart).getTime()
    const e = parseISODate(selectEnd).getTime()
    return d >= s && d <= e
  }

  const handleBlock = async () => {
    if (!isOwner || !listingId || !selectStart) return
    const rangeEnd = selectEnd ?? selectStart
    setActionPending(true)
    setError(null)
    setConflictWarning(null)
    try {
      // Check availability first
      const { available, conflicts } = await checkAvailability(listingId, selectStart, rangeEnd)
      if (!available && conflicts.some(c => c.status === 'BOOKED')) {
        setConflictWarning('Диапазон содержит даты с активными бронированиями. Блокировка/разблокировка может повлиять на сделки.')
        setActionPending(false)
        return
      }

      const res = await blockDates(listingId, selectStart, rangeEnd, 'Ручная блокировка', accessToken)
      updateSlots(res.items)
      clearSelection()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setConflictWarning('Диапазон содержит активные сделки. Разблокировка невозможна до завершения сделок.')
      } else {
        setError(getErrorMessage(err, 'Ошибка при блокировке дат'))
      }
    } finally {
      setActionPending(false)
    }
  }

  const handleUnblock = async (force = false, cancelBookings = false) => {
    if (!isOwner || !listingId || !selectStart) return
    const rangeEnd = selectEnd ?? selectStart
    setActionPending(true)
    setError(null)
    try {
      const res = await unblockDates(listingId, selectStart, rangeEnd, force, cancelBookings, accessToken)
      updateSlots(res.items)
      clearSelection()
      setConflictWarning(null)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setConflictWarning('Выбранные даты содержат активные бронирования. Разблокировка отменит существующие сделки. Продолжить?')
      } else {
        setError(getErrorMessage(err, 'Ошибка при разблокировке дат'))
      }
    } finally {
      setActionPending(false)
    }
  }

  const updateSlots = (newItems: CalendarSlot[]) => {
    setSlots(prev => {
      const next = new Map(prev)
      newItems.forEach(item => next.set(item.date, item))
      return next
    })
  }

  const clearSelection = () => {
    setSelectStart(null)
    setSelectEnd(null)
    setConflictWarning(null)
  }

  return (
    <main className="container" style={{ padding: 'var(--sp-7) 0', flex: 1 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--sp-3)',
            marginBottom: 'var(--sp-5)',
          }}
        >
          <h1 className="hero__title" style={{ margin: 0, fontSize: '2.2rem' }}>
            Календарь доступности
          </h1>
          {listingId ? (
            <Link to={`/listings/${listingId}`} className="btn btn--ghost">
              Выйти из календаря
            </Link>
          ) : null}
        </div>

        <div className="calendar-legend">
          <div className="legend-item"><span className="legend-color legend-color--free"></span> Свободно</div>
          <div className="legend-item"><span className="legend-color legend-color--booked"></span> Занято (Сделка)</div>
          <div className="legend-item"><span className="legend-color legend-color--blocked"></span> Заблокировано</div>
        </div>

        {listingMetaError ? (
          <div className="alert alert--error" style={{ marginBottom: 'var(--sp-4)' }}>
            {listingMetaError}
          </div>
        ) : null}

        {!listingMetaError && listingOwnerId && user && !isOwner ? (
          <p className="listing-booking-modal__fineprint" style={{ marginBottom: 'var(--sp-4)' }}>
            Управлять блокировкой дат может только владелец объявления.
          </p>
        ) : null}

        <div className="calendar-card">
          <div className="calendar-header">
            <button 
              className="icon-btn" 
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              aria-label="Предыдущий месяц"
            >
              <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <h2 className="calendar-month">
              {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <button 
              className="icon-btn" 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              aria-label="Следующий месяц"
            >
              <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          <div className="calendar-grid-header">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
              <div key={day} className="calendar-weekday">{day}</div>
            ))}
          </div>

          <div className="calendar-grid">
            {gridDays.map((date, i) => {
              const iso = toISODate(date)
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
              const status = getSlotStatus(iso)
              const selected = isSelected(iso)
              
              let statusClass = 'calendar-day--free'
              if (status === 'BOOKED') statusClass = 'calendar-day--booked'
              if (status === 'BLOCKED_BY_OWNER' || status === 'MAINTENANCE') statusClass = 'calendar-day--blocked'

              return (
                <button
                  key={i}
                  className={`calendar-day ${statusClass} ${!isCurrentMonth ? 'calendar-day--dimmed' : ''} ${selected ? 'calendar-day--selected' : ''}`}
                  onClick={() => handleDayClick(iso)}
                  disabled={loading || !isOwner}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        {isOwner && selectStart && (
          <div className="calendar-actions">
            <h3 style={{ marginBottom: 'var(--sp-3)' }}>
              Выбран диапазон: {parseISODate(selectStart).toLocaleDateString('ru-RU')} — {parseISODate(selectEnd ?? selectStart).toLocaleDateString('ru-RU')}
            </h3>
            
            {error && <div className="alert alert--error">{error}</div>}
            
            {conflictWarning ? (
              <div className="alert alert--error" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <p>{conflictWarning}</p>
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <button 
                    className="btn btn--primary" 
                    onClick={() => handleUnblock(true, true)}
                    disabled={actionPending}
                  >
                    Принудительно разблокировать (отменит сделки)
                  </button>
                  <button 
                    className="btn btn--ghost" 
                    onClick={clearSelection}
                    disabled={actionPending}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                <button 
                  className="btn btn--brand" 
                  onClick={handleBlock}
                  disabled={actionPending}
                >
                  Заблокировать
                </button>
                <button 
                  className="btn btn--ghost" 
                  onClick={() => handleUnblock(false, false)}
                  disabled={actionPending}
                >
                  Разблокировать
                </button>
                <button 
                  className="btn btn--ghost" 
                  onClick={clearSelection}
                  disabled={actionPending}
                  style={{ marginLeft: 'auto' }}
                >
                  Сбросить
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
