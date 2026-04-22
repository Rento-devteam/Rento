import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const useAuthMock = vi.hoisted(() => vi.fn())
const apiRequestMock = vi.hoisted(() => vi.fn())
const resendConfirmationMock = vi.hoisted(() => vi.fn())
const updateCurrentUserMock = vi.hoisted(() => vi.fn())

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../auth/authApi', () => ({
  authApi: {
    resendConfirmation: (...args: unknown[]) => resendConfirmationMock(...args),
    updateCurrentUser: (...args: unknown[]) => updateCurrentUserMock(...args),
  },
}))

vi.mock('../lib/apiClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      user: {
        id: 'u1',
        email: 'test@example.com',
        fullName: 'Иван Иванов',
        phone: '+7 999 123 45 67',
        avatarUrl: null,
        role: 'USER',
        status: 'ACTIVE',
        isVerified: true,
        trustScore: {
          currentScore: 95,
          totalDeals: 20,
          successfulDeals: 10,
          lateReturns: 0,
          disputes: 0,
          calculatedAt: new Date().toISOString(),
        },
      },
      accessToken: 'token-123',
      logout: vi.fn(),
      refreshProfile: vi.fn().mockResolvedValue(undefined),
    })

    apiRequestMock.mockImplementation((path: string) => {
      if (path === '/listings/my') {
        return Promise.resolve([
          {
            id: 'l1',
            title: 'Моя палатка',
            rentalPrice: 500,
            rentalPeriod: 'DAY',
            status: 'ACTIVE',
            photos: [],
          },
        ])
      }
      if (path === '/payment/methods') {
        return Promise.resolve({ items: [] })
      }
      if (path === '/payment/cards/add') {
        return Promise.resolve({
          id: 'card-1',
          last4: '1234',
          cardType: 'Visa',
          isDefault: true,
          addedAt: new Date().toISOString(),
        })
      }
      return Promise.resolve({})
    })
    updateCurrentUserMock.mockReset()
    updateCurrentUserMock.mockResolvedValue({})
  })

  it('renders user info and trust score', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Иван Иванов')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('+7 999 123 45 67')).toBeInTheDocument()
    expect(screen.getByText('95')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith('/listings/my', {
        accessToken: 'token-123',
      })
    })
  })

  it('refreshes profile on mount', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({
      ...useAuthMock(),
      refreshProfile,
    })

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(refreshProfile).toHaveBeenCalled()
    })
  })

  it('shows identity verification card placeholder', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: /Подтверждённый аккаунт/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/ЕСИА/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /^Подтвердить аккаунт$/i })).toBeDisabled()
  })

  it('saves profile when form is submitted', async () => {
    const user = userEvent.setup()
    const refreshProfile = vi.fn().mockResolvedValue(undefined)
    useAuthMock.mockReturnValue({
      ...useAuthMock(),
      refreshProfile,
    })

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const nameInput = screen.getByLabelText(/Имя и фамилия/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Новое имя')

    await user.click(screen.getByRole('button', { name: /^Сохранить$/i }))

    await waitFor(() => {
      expect(updateCurrentUserMock).toHaveBeenCalledWith({ fullName: 'Новое имя' }, 'token-123')
    })
    expect(refreshProfile).toHaveBeenCalled()
  })

  it('renders user listings', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Моя палатка')).toBeInTheDocument()
      expect(screen.getByText(/500 ₽ \/ сутки/i)).toBeInTheDocument()
      expect(screen.getByText('Активно')).toBeInTheDocument()
    })
  })

  it('attaches card from gateway token', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/Токен карты из шлюза/i), 'pm_token_escrow_1')
    await user.click(screen.getByRole('button', { name: /Привязать карту/i }))

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/payment/cards/add',
        expect.objectContaining({
          method: 'POST',
          accessToken: 'token-123',
        }),
      )
    })

    expect(await screen.findByText(/Карта успешно привязана/i)).toBeInTheDocument()
    expect(screen.getByText(/Visa •••• 1234/i)).toBeInTheDocument()
  })

  it('shows email confirmation panel when email is not verified', async () => {
    useAuthMock.mockReturnValue({
      ...useAuthMock(),
      user: {
        id: 'u1',
        email: 'pending@example.com',
        fullName: 'Пётр',
        phone: null,
        avatarUrl: null,
        role: 'USER',
        status: 'PENDING_EMAIL_CONFIRMATION',
        isVerified: false,
        trustScore: undefined,
      },
    })

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const heading = await screen.findByRole('heading', { name: /Подтвердите email/i })
    expect(heading).toBeInTheDocument()
    expect(screen.getAllByText('pending@example.com').length).toBeGreaterThanOrEqual(1)
  })

  it('resends confirmation email when button clicked', async () => {
    const user = userEvent.setup()
    resendConfirmationMock.mockResolvedValue({ message: 'Письмо отправлено' })

    useAuthMock.mockReturnValue({
      ...useAuthMock(),
      user: {
        id: 'u1',
        email: 'pending@example.com',
        fullName: 'Пётр',
        phone: null,
        avatarUrl: null,
        role: 'USER',
        status: 'PENDING_EMAIL_CONFIRMATION',
        isVerified: false,
        trustScore: undefined,
      },
    })

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /Отправить письмо ещё раз/i }))

    await waitFor(() => {
      expect(resendConfirmationMock).toHaveBeenCalledWith('pending@example.com')
    })
    expect(await screen.findByText(/Письмо отправлено/i)).toBeInTheDocument()
  })
})
