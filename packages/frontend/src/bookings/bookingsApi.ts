import { apiRequest } from '../lib/apiClient'

export type CreateBookingResponse = {
  bookingId: string
  status: string
}

export type BookingListItem = {
  id: string
  listingId: string
  listingTitle: string
  status: string
  startAt: string | null
  endAt: string | null
  startDate: string
  endDate: string
  rentAmount: number
  depositAmount: number
  totalAmount: number
  amountHeld: number | null
  paymentHoldId: string | null
  perspective: 'renter' | 'landlord'
  renterLabel?: string
}

export type BookingDetail = BookingListItem & {
  role: 'renter' | 'landlord'
  paymentGateway: string | null
  paymentAuthorizationCode: string | null
}

export async function listBookingsAsRenter(accessToken: string): Promise<{ items: BookingListItem[] }> {
  return apiRequest<{ items: BookingListItem[] }>('/bookings/as-renter', {
    method: 'GET',
    accessToken,
  })
}

export async function listBookingsAsLandlord(accessToken: string): Promise<{ items: BookingListItem[] }> {
  return apiRequest<{ items: BookingListItem[] }>('/bookings/as-landlord', {
    method: 'GET',
    accessToken,
  })
}

export async function getBooking(bookingId: string, accessToken: string): Promise<BookingDetail> {
  return apiRequest<BookingDetail>(`/bookings/${bookingId}`, {
    method: 'GET',
    accessToken,
  })
}

export async function retryBookingPayment(
  bookingId: string,
  body: { cardId: string; stubBalanceRub?: number },
  accessToken: string,
): Promise<CreateBookingResponse> {
  return apiRequest<CreateBookingResponse>(`/bookings/${bookingId}/retry-payment`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  })
}

export async function createBooking(
  body: {
    listingId: string
    startAt: string
    endAt: string
    cardId?: string
    stubBalanceRub?: number
  },
  accessToken: string,
): Promise<CreateBookingResponse> {
  return apiRequest<CreateBookingResponse>('/bookings', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  })
}
