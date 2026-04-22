import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiError, apiRequest, getApiBaseUrl } from './apiClient'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('getApiBaseUrl returns a string', () => {
    expect(typeof getApiBaseUrl()).toBe('string')
    expect(getApiBaseUrl().length).toBeGreaterThan(0)
  })

  it('apiRequest parses JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ hello: 'world' }),
      }),
    )

    const data = await apiRequest<{ hello: string }>('/test')
    expect(data).toEqual({ hello: 'world' })
  })

  it('apiRequest throws ApiError on HTTP error with message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ message: 'Invalid input' }),
      }),
    )

    try {
      await apiRequest('/bad')
      expect.fail('expected ApiError')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(400)
      expect((e as ApiError).message).toBe('Invalid input')
    }
  })

  it('ApiError exposes status', () => {
    const err = new ApiError(401, 'Unauthorized')
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(401)
    expect(err.message).toBe('Unauthorized')
  })

  it('apiRequest maps bookingId from error JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
        text: async () =>
          JSON.stringify({ message: 'Hold declined', bookingId: 'bkg_01test' }),
      }),
    )

    try {
      await apiRequest('/bookings')
      expect.fail('expected ApiError')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(402)
      expect((e as ApiError).bookingId).toBe('bkg_01test')
    }
  })
})
