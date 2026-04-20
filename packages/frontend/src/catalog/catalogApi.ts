import { apiRequest } from '../lib/apiClient'
import type { ICategory, IListing } from '@rento/shared'

export interface CatalogSearchResponse {
  results: IListing[]
  totalCount: number
  page: number
  limit: number
  emptyResults: boolean
  suggestion: string | null
  relaxedMatch: boolean
  popularCategories: ICategory[]
}

export interface CatalogSearchParams {
  q?: string
  city?: string
  categoryId?: string
  minPrice?: number
  maxPrice?: number
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest'
  page?: number
  limit?: number
}

export async function searchCatalog(
  params: CatalogSearchParams,
): Promise<CatalogSearchResponse> {
  const query = new URLSearchParams()
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.city?.trim()) query.set('city', params.city.trim())
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.minPrice != null && Number.isFinite(params.minPrice)) {
    query.set('minPrice', String(params.minPrice))
  }
  if (params.maxPrice != null && Number.isFinite(params.maxPrice)) {
    query.set('maxPrice', String(params.maxPrice))
  }
  if (params.sort) query.set('sort', params.sort)
  if (params.page != null) query.set('page', String(params.page))
  if (params.limit != null) query.set('limit', String(params.limit))

  const suffix = query.toString()
  return apiRequest<CatalogSearchResponse>(`/search${suffix ? `?${suffix}` : ''}`)
}
