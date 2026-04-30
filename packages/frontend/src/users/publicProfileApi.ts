import type { ITrustScore } from '@rento/shared'
import { apiRequest } from '../lib/apiClient'

export type PublicUserProfile = {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
  avatarUrl: string | null
  role: 'USER' | 'MODERATOR' | 'ADMIN'
  status: string
  isVerified: boolean
  trustScore?: ITrustScore
}

export function getPublicUserProfile(userId: string): Promise<PublicUserProfile> {
  return apiRequest<PublicUserProfile>(`/users/${userId}/public`)
}

