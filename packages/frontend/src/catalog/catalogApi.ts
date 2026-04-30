import { apiRequest } from '../lib/apiClient'
import type { ICategory, IListing, IListingPhoto } from '@rento/shared'

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

export interface CreateMetadataResponse {
  categories: ICategory[]
}

export interface CreateListingDto {
  title: string
  description: string
  categoryId: string
  rentalPrice: number
  rentalPeriod: 'HOUR' | 'DAY' | 'WEEK' | 'MONTH'
  depositAmount: number
}

export interface CreateListingResponse {
  id: string
  status: IListing['status']
  message: string
  nextStep: 'upload_photos'
}

export interface UploadPhotoResponse {
  photo: IListingPhoto
  totalPhotos: number
  message: string
  nextStep: 'publish_listing'
}

export interface PublishListingResponse {
  id: string
  status: IListing['status']
  message: string
  nextStep: null
}

export async function searchCatalog(
  params: CatalogSearchParams,
  accessToken?: string | null,
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
  return apiRequest<CatalogSearchResponse>(
    `/search${suffix ? `?${suffix}` : ''}`,
    accessToken ? { accessToken } : undefined,
  )
}

export async function getCreateMetadata(accessToken: string): Promise<CreateMetadataResponse> {
  return apiRequest<CreateMetadataResponse>('/listings/create', { accessToken })
}

export async function createListing(
  dto: CreateListingDto,
  accessToken: string,
): Promise<CreateListingResponse> {
  return apiRequest<CreateListingResponse>('/listings', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(dto),
  })
}

export async function uploadListingPhoto(
  listingId: string,
  file: File,
  accessToken: string,
  order?: number,
): Promise<UploadPhotoResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (order != null) {
    formData.append('order', String(order))
  }

  return apiRequest<UploadPhotoResponse>(`/listings/${listingId}/photos`, {
    method: 'POST',
    accessToken,
    headers: {},
    body: formData,
  })
}

export async function deleteListingPhoto(
  listingId: string,
  photoId: string,
  accessToken: string,
): Promise<{ success: boolean; totalPhotos: number; message: string }> {
  return apiRequest<{ success: boolean; totalPhotos: number; message: string }>(
    `/listings/${listingId}/photos/${photoId}`,
    {
      method: 'DELETE',
      accessToken,
    },
  )
}

export async function publishListing(
  listingId: string,
  accessToken: string,
): Promise<PublishListingResponse> {
  return apiRequest<PublishListingResponse>(`/listings/${listingId}/publish`, {
    method: 'POST',
    accessToken,
  })
}

export async function getListingDetails(listingId: string): Promise<IListing> {
  const response = await apiRequest<IListing & { nextStep?: string; message?: string }>(
    `/listings/${listingId}`,
  )
  return response
}

export async function getOwnedListingForEdit(
  listingId: string,
  accessToken: string,
): Promise<IListing> {
  return apiRequest<IListing>(`/listings/owned/${listingId}`, { accessToken })
}

export async function getPublicListingsByOwner(ownerId: string): Promise<IListing[]> {
  return apiRequest<IListing[]>(`/listings/owner/${ownerId}/public`)
}

export type UpdateListingPayload = Partial<CreateListingDto>

export async function updateListing(
  listingId: string,
  dto: UpdateListingPayload,
  accessToken: string,
): Promise<IListing> {
  return apiRequest<IListing>(`/listings/owned/${listingId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(dto),
  })
}

export async function deleteListing(
  listingId: string,
  accessToken: string,
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/listings/${listingId}`, {
    method: 'DELETE',
    accessToken,
  })
}
