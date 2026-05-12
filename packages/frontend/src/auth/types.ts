import type { ITrustScore } from '@rento/shared'

export interface AuthUser {
  id: string
  email: string | null
  fullName: string | null
  phone: string | null
  avatarUrl: string | null
  addressText?: string | null
  addressLatitude?: number | null
  addressLongitude?: number | null
  role: string
  status: string
  isVerified: boolean
  trustScore?: ITrustScore
}

export interface AuthSuccessResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface RegisterResponse {
  userId: string
  status: 'pending_confirmation'
  nextStep: 'confirm_email'
}

export interface CompleteRegistrationResponse {
  status: 'completed' | 'pending_email_confirmation'
  nextStep: string | null
}
