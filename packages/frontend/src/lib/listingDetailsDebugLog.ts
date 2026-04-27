/**
 * Диагностика страницы объявления. В production по умолчанию выключено;
 * включите `VITE_DEBUG_LISTING=true` в `.env` и перезапустите Vite.
 */
export const LISTING_DETAILS_DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_LISTING === 'true'

export function logListingDetails(
  stage: string,
  payload?: Record<string, unknown>,
): void {
  if (!LISTING_DETAILS_DEBUG) return
  const base = typeof window !== 'undefined' ? window.location.pathname : ''
  console.info(`[ListingDetails] ${stage}`, {
    ...payload,
    pathname: base,
    t: new Date().toISOString(),
  })
}
