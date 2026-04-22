import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiRequest = vi.hoisted(() => vi.fn())

vi.mock('../lib/apiClient', () => ({
  ApiError: class ApiError extends Error {
    readonly status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
  getApiBaseUrl: () => 'http://localhost:3000',
  apiRequest,
}))

import { searchCatalog } from './catalogApi'

const emptyResponse = {
  results: [],
  totalCount: 0,
  page: 1,
  limit: 24,
  emptyResults: true,
  suggestion: null,
  relaxedMatch: false,
  popularCategories: [],
}

describe('searchCatalog', () => {
  beforeEach(() => {
    apiRequest.mockReset()
    apiRequest.mockResolvedValue(emptyResponse)
  })

  it('calls /search without query when params are empty', async () => {
    await searchCatalog({})
    expect(apiRequest).toHaveBeenCalledWith('/search', undefined)
  })

  it('builds query with trimmed q and city', async () => {
    await searchCatalog({ q: '  drill  ', city: ' Москва ', sort: 'price_asc' })
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringMatching(/^\/search\?/),
      undefined,
    )
    const url = String(apiRequest.mock.calls[0][0])
    const qs = url.replace('/search?', '')
    const params = new URLSearchParams(qs)
    expect(params.get('q')).toBe('drill')
    expect(params.get('city')).toBe('Москва')
    expect(params.get('sort')).toBe('price_asc')
  })

  it('includes categoryId, minPrice, maxPrice, page, limit', async () => {
    await searchCatalog({
      categoryId: 'cat-1',
      minPrice: 100,
      maxPrice: 5000,
      page: 2,
      limit: 10,
    })
    const url = String(apiRequest.mock.calls[0][0])
    const params = new URLSearchParams(url.replace('/search?', ''))
    expect(params.get('categoryId')).toBe('cat-1')
    expect(params.get('minPrice')).toBe('100')
    expect(params.get('maxPrice')).toBe('5000')
    expect(params.get('page')).toBe('2')
    expect(params.get('limit')).toBe('10')
  })

  it('omits minPrice when not finite', async () => {
    await searchCatalog({ minPrice: Number.NaN })
    const url = String(apiRequest.mock.calls[0][0])
    expect(url).toBe('/search')
  })
})
