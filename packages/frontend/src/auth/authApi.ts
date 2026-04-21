import { apiRequest } from '../lib/apiClient'
import type {
  AuthSuccessResponse,
  AuthUser,
  CompleteRegistrationResponse,
  RegisterResponse,
} from './types'

/**
 * HTTP-клиент аутентификации (соответствует `packages/backend/src/auth/auth.controller.ts`).
 * Регистрация через Telegram на стороне API выполняется ботом (`POST /telegram/auth` + x-bot-secret);
 * из браузера доступны email-флоу и публичные вспомогательные методы.
 */
export const authApi = {
  register(body: {
    email: string
    password: string
    confirmPassword?: string
    fullName?: string
  }): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>('/register', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  login(body: { email: string; password: string }): Promise<AuthSuccessResponse> {
    return apiRequest<AuthSuccessResponse>('/login', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  confirmEmail(
    token: string,
    init?: { signal?: AbortSignal },
  ): Promise<AuthSuccessResponse> {
    const q = new URLSearchParams({ token })
    return apiRequest<AuthSuccessResponse>(`/confirm-email?${q.toString()}`, {
      signal: init?.signal,
    })
  },

  resendConfirmation(email: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>('/resend-confirmation', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  completeRegistration(email: string): Promise<CompleteRegistrationResponse> {
    const q = new URLSearchParams({ email })
    return apiRequest<CompleteRegistrationResponse>(
      `/complete-registration?${q.toString()}`,
    )
  },

  getCurrentUser(accessToken: string): Promise<AuthUser> {
    return apiRequest<AuthUser>('/users/me', {
      method: 'GET',
      accessToken,
    })
  },

  /** После подтверждения email: привязка Telegram по коду из бота (`telegramId` передаёт бот; для тестов можно вызвать вручную). */
  verifyTelegramLink(body: {
    code: string
    telegramId: string
  }): Promise<AuthSuccessResponse> {
    return apiRequest<AuthSuccessResponse>('/telegram/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  requestTelegramLinkCode(accessToken: string): Promise<{
    code: string
    deepLink: string
    qrCodeUrl: null
  }> {
    return apiRequest('/telegram/link', {
      method: 'POST',
      accessToken,
    })
  },
}
