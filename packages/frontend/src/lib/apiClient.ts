export class ApiError extends Error {
  readonly status: number
  /** Present on some errors (e.g. 402 payment hold) when backend returns `bookingId` in JSON body. */
  readonly bookingId?: string

  constructor(status: number, message: string, bookingId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.bookingId = bookingId
  }
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) {
    return undefined as T
  }
  return JSON.parse(text) as T
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const msg = (body as { message: unknown }).message
    if (typeof msg === 'string') return msg
    if (Array.isArray(msg)) return msg.filter(Boolean).join(', ')
  }
  return fallback
}

function getBookingIdFromBody(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'bookingId' in body) {
    const id = (body as { bookingId: unknown }).bookingId
    if (typeof id === 'string' && id.length > 0) return id
  }
  return undefined
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit & { accessToken?: string | null },
): Promise<T> {
  const headers = new Headers(init?.headers)
  const isFormDataBody =
    typeof FormData !== 'undefined' && init?.body instanceof FormData
  if (!headers.has('Content-Type') && init?.body && !isFormDataBody) {
    headers.set('Content-Type', 'application/json')
  }
  if (init?.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`)
  }

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  })

  if (!res.ok) {
    const body = await parseJson<unknown>(res).catch(() => null)
    const message = getErrorMessage(body, res.statusText)
    throw new ApiError(res.status, message, getBookingIdFromBody(body))
  }

  return parseJson<T>(res)
}
