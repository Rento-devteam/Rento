import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/apiClient'
import { ManageCalendarPage } from './ManageCalendarPage'

const useParamsMock = vi.hoisted(() => vi.fn())
const useAuthMock = vi.hoisted(() => vi.fn())

const getCalendarMock = vi.hoisted(() => vi.fn())
const checkAvailabilityMock = vi.hoisted(() => vi.fn())
const blockDatesMock = vi.hoisted(() => vi.fn())
const unblockDatesMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: () => useParamsMock(),
  }
})

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../calendar/calendarApi', () => ({
  getCalendar: (...args: unknown[]) => getCalendarMock(...args),
  checkAvailability: (...args: unknown[]) => checkAvailabilityMock(...args),
  blockDates: (...args: unknown[]) => blockDatesMock(...args),
  unblockDates: (...args: unknown[]) => unblockDatesMock(...args),
}))

function makeCalendarItems(fromDay: number, toDay: number) {
  return Array.from({ length: toDay - fromDay + 1 }).map((_, idx) => ({
    date: `2026-04-${String(fromDay + idx).padStart(2, '0')}`,
    status: 'AVAILABLE' as const,
    reason: null,
  }))
}

describe('ManageCalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useParamsMock.mockReturnValue({ id: 'listing-1' })
    useAuthMock.mockReturnValue({ accessToken: 'token-123' })

    getCalendarMock.mockResolvedValue({
      listingId: 'listing-1',
      items: makeCalendarItems(1, 30),
    })
    checkAvailabilityMock.mockResolvedValue({ available: true, conflicts: [] })
    blockDatesMock.mockResolvedValue({
      listingId: 'listing-1',
      items: makeCalendarItems(1, 30),
    })
    unblockDatesMock.mockResolvedValue({
      listingId: 'listing-1',
      items: makeCalendarItems(1, 30),
    })
  })

  it('loads calendar and renders legend', async () => {
    render(<ManageCalendarPage />)

    expect(screen.getByRole('heading', { name: /календарь доступности/i })).toBeInTheDocument()
    expect(screen.getByText(/свободно/i)).toBeInTheDocument()
    expect(screen.getByText(/занято \(сделка\)/i)).toBeInTheDocument()
    expect(screen.getByText(/заблокировано/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(getCalendarMock).toHaveBeenCalledWith('listing-1', expect.any(String), expect.any(String))
    })
  })

  it('blocks selected range when availability is free', async () => {
    const user = userEvent.setup()
    render(<ManageCalendarPage />)

    await waitFor(() => expect(getCalendarMock).toHaveBeenCalled())

    await user.click(screen.getAllByRole('button', { name: '10' })[0])
    await user.click(screen.getAllByRole('button', { name: '12' })[0])

    await user.click(screen.getByRole('button', { name: /заблокировать/i }))

    await waitFor(() => {
      expect(checkAvailabilityMock).toHaveBeenCalledTimes(1)
      expect(blockDatesMock).toHaveBeenCalledTimes(1)
    })

    const [listingId, startDate, endDate, reason, accessToken] = blockDatesMock.mock.calls[0]
    expect(listingId).toBe('listing-1')
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(reason).toBe('Ручная блокировка')
    expect(accessToken).toBe('token-123')
  })

  it('shows force-unblock action on conflict and sends force flags', async () => {
    const user = userEvent.setup()

    unblockDatesMock.mockRejectedValueOnce(
      new ApiError(409, 'Selected dates include active bookings; use force to proceed'),
    )

    render(<ManageCalendarPage />)

    await waitFor(() => expect(getCalendarMock).toHaveBeenCalled())

    await user.click(screen.getAllByRole('button', { name: '15' })[0])
    await user.click(screen.getAllByRole('button', { name: '16' })[0])

    await user.click(screen.getByRole('button', { name: /разблокировать/i }))

    expect(
      await screen.findByRole('button', {
        name: /принудительно разблокировать \(отменит сделки\)/i,
      }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /принудительно разблокировать \(отменит сделки\)/i }),
    )

    await waitFor(() => {
      expect(unblockDatesMock).toHaveBeenLastCalledWith(
        'listing-1',
        expect.any(String),
        expect.any(String),
        true,
        true,
        'token-123',
      )
    })
  })

  it('allows blocking a single selected day', async () => {
    const user = userEvent.setup()
    render(<ManageCalendarPage />)

    await waitFor(() => expect(getCalendarMock).toHaveBeenCalled())

    await user.click(screen.getAllByRole('button', { name: '8' })[0])
    await user.click(screen.getByRole('button', { name: /заблокировать/i }))

    await waitFor(() => {
      expect(blockDatesMock).toHaveBeenCalledTimes(1)
    })

    const [, startDate, endDate] = blockDatesMock.mock.calls[0]
    expect(startDate).toBe(endDate)
  })
})
