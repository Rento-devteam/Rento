import { apiRequest } from '../lib/apiClient'

export type BookingSummaryResponse = {
  listingId: string
  startAt: string
  endAt: string
  rentalPeriod: string
  units: number
  rentalAmount: number
  depositAmount: number
  totalHoldAmount: number
}

export async function getBookingSummary(params: {
  listingId: string
  startAtIso: string
  endAtIso: string
}): Promise<BookingSummaryResponse> {
  const q = new URLSearchParams({
    startAt: params.startAtIso,
    endAt: params.endAtIso,
  })
  return apiRequest<BookingSummaryResponse>(
    `/listings/${params.listingId}/booking-summary?${q.toString()}`,
    { method: 'GET' },
  )
}
