import { apiRequest } from '../lib/apiClient'

export type AvailabilityStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED_BY_OWNER' | 'MAINTENANCE'

export interface CalendarSlot {
  date: string
  status: AvailabilityStatus
  reason: string | null
}

export interface CalendarResponse {
  listingId: string
  items: CalendarSlot[]
}

export interface AvailabilityResponse {
  available: boolean
  conflicts: CalendarSlot[]
}

export async function getCalendar(
  listingId: string,
  start?: string,
  end?: string,
): Promise<CalendarResponse> {
  const query = new URLSearchParams()
  if (start) query.set('start', start)
  if (end) query.set('end', end)
  const suffix = query.toString()
  return apiRequest<CalendarResponse>(`/listings/${listingId}/calendar${suffix ? `?${suffix}` : ''}`)
}

export async function checkAvailability(
  listingId: string,
  start: string,
  end: string,
): Promise<AvailabilityResponse> {
  const query = new URLSearchParams({ start, end })
  return apiRequest<AvailabilityResponse>(`/listings/${listingId}/dates/availability?${query.toString()}`)
}

export async function blockDates(
  listingId: string,
  startDate: string,
  endDate: string,
  reason?: string,
  accessToken?: string | null,
): Promise<CalendarResponse> {
  return apiRequest<CalendarResponse>(`/listings/${listingId}/calendar/block`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ startDate, endDate, reason }),
  })
}

export async function unblockDates(
  listingId: string,
  start: string,
  end: string,
  force = false,
  cancelBookings = false,
  accessToken?: string | null,
): Promise<CalendarResponse> {
  const query = new URLSearchParams({ start, end })
  if (force) query.set('force', 'true')
  if (cancelBookings) query.set('cancelBookings', 'true')
  return apiRequest<CalendarResponse>(`/listings/${listingId}/calendar/block?${query.toString()}`, {
    method: 'DELETE',
    accessToken,
  })
}
