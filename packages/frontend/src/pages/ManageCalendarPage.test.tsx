import type { IListing } from '@rento/shared'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/apiClient'
import { ManageCalendarPage } from './ManageCalendarPage'

const useParamsMock = vi.hoisted(() => vi.fn())
const useAuthMock = vi.hoisted(() => vi.fn())

const getCalendarMock = vi.hoisted(() => vi.fn())
const checkAvailabilityMock = vi.hoisted(() => vi.fn())
const blockDatesMock = vi.hoisted(() => vi.fn())
const unblockDatesMock = vi.hoisted(() => vi.fn())
const getListingDetailsMock = vi.hoisted(() => vi.fn())
const getOwnedListingForEditMock = vi.hoisted(() => vi.fn())

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

vi.mock('../catalog/catalogApi', () => ({
  getListingDetails: (...args: unknown[]) => getListingDetailsMock(...args),
  getOwnedListingForEdit: (...args: unknown[]) => getOwnedListingForEditMock(...args),
}))

const ownerAuthUser = {
  id: 'owner-user-1',
  email: 'owner@test.com',
  fullName: 'Owner',
  phone: null,
  avatarUrl: null,
  role: 'USER',
  status: 'ACTIVE',
  isVerified: true,
}

const ownerListingStub = { ownerId: 'owner-user-1' } as Pick<IListing, 'ownerId'> as IListing

function makeCalendarItems(fromDay: number, toDay: number) {
  return Array.from({ length: toDay - fromDay + 1 }).map((_, idx) => ({
    date: `2026-04-${String(fromDay + idx).padStart(2, '0')}`,
    status: 'AVAILABLE' as const,
    reason: null,
  }))
}

function renderCalendarPage() {
  return render(
    <MemoryRouter>
      <ManageCalendarPage />
    </MemoryRouter>,
  )
}

describe('ManageCalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useParamsMock.mockReturnValue({ id: 'listing-1' })
    useAuthMock.mockReturnValue({ accessToken: 'token-123', user: ownerAuthUser })
    getListingDetailsMock.mockResolvedValue(ownerListingStub)
    getOwnedListingForEditMock.mockRejectedValue(new ApiError(404, 'Not found'))

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
    renderCalendarPage()

    expect(screen.getByRole('heading', { name: /календарь доступности/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /выйти из календаря/i })).toHaveAttribute(
      'href',
      '/listings/listing-1',
    )
    expect(screen.getByText(/свободно/i)).toBeInTheDocument()
    expect(screen.getByText(/занято \(сделка\)/i)).toBeInTheDocument()
    expect(screen.getByText(/заблокировано/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(getOwnedListingForEditMock).toHaveBeenCalledWith('listing-1', 'token-123')
      expect(getListingDetailsMock).toHaveBeenCalledWith('listing-1')
      expect(getCalendarMock).toHaveBeenCalledWith('listing-1', expect.any(String), expect.any(String))
    })
  })

  it('blocks selected range when availability is free', async () => {
    const user = userEvent.setup()
    renderCalendarPage()

    await waitFor(() => {
      expect(getOwnedListingForEditMock).toHaveBeenCalled()
      expect(getListingDetailsMock).toHaveBeenCalled()
      expect(getCalendarMock).toHaveBeenCalled()
    })

    await user.click(screen.getAllByRole('button', { name: '10' })[0])
    await user.click(screen.getAllByRole('button', { name: '12' })[0])

    await user.click(screen.getByRole('button', { name: /заблокировать/i }))

    await waitFor(() => {
      expect(checkAvailabilityMock).toHaveBeenCalledTimes(1)
      expect(blockDatesMock).toHaveBeenCalledTimes(1)
    })

    const [listingId, startDate, endDate, , accessToken] = blockDatesMock.mock.calls[0]
    expect(listingId).toBe('listing-1')
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(accessToken).toBe('token-123')
  })

  it('shows force-unblock action on conflict and sends force flags', async () => {
    const user = userEvent.setup()

    unblockDatesMock.mockRejectedValueOnce(
      new ApiError(409, 'Selected dates include active bookings; use force to proceed'),
    )

    renderCalendarPage()

    await waitFor(() => {
      expect(getOwnedListingForEditMock).toHaveBeenCalled()
      expect(getListingDetailsMock).toHaveBeenCalled()
      expect(getCalendarMock).toHaveBeenCalled()
    })

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
    renderCalendarPage()

    await waitFor(() => {
      expect(getOwnedListingForEditMock).toHaveBeenCalled()
      expect(getListingDetailsMock).toHaveBeenCalled()
      expect(getCalendarMock).toHaveBeenCalled()
    })

    await user.click(screen.getAllByRole('button', { name: '8' })[0])
    await user.click(screen.getByRole('button', { name: /заблокировать/i }))

    await waitFor(() => {
      expect(blockDatesMock).toHaveBeenCalledTimes(1)
    })

    const [, startDate, endDate] = blockDatesMock.mock.calls[0]
    expect(startDate).toBe(endDate)
  })

  it('does not offer block actions when the viewer is not the listing owner', async () => {
    useAuthMock.mockReturnValue({
      accessToken: 'token-456',
      user: { ...ownerAuthUser, id: 'other-user' },
    })

    renderCalendarPage()

    await waitFor(() => {
      expect(getOwnedListingForEditMock).toHaveBeenCalled()
      expect(getListingDetailsMock).toHaveBeenCalled()
      expect(getCalendarMock).toHaveBeenCalled()
    })

    expect(screen.getAllByRole('button', { name: '10' })[0]).toBeDisabled()
    expect(screen.queryByRole('button', { name: /заблокировать/i })).not.toBeInTheDocument()
    expect(screen.getByText(/только владелец объявления/i)).toBeInTheDocument()
  })
})
