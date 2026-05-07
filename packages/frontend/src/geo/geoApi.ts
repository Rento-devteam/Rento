import { apiRequest } from '../lib/apiClient'

export type GeocodeSuccess = {
  addressText: string
  latitude: number
  longitude: number
}

export async function geocodeByQuery(
  query: string,
  accessToken: string,
): Promise<GeocodeSuccess> {
  return apiRequest<GeocodeSuccess>('/geo/geocode', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ query: query.trim() }),
  })
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  accessToken: string,
): Promise<GeocodeSuccess> {
  return apiRequest<GeocodeSuccess>('/geo/reverse-geocode', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ latitude, longitude }),
  })
}
