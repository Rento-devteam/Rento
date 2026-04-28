import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const useAuthMock = vi.hoisted(() => vi.fn())
const apiRequestMock = vi.hoisted(() => vi.fn())
const resendConfirmationMock = vi.hoisted(() => vi.fn())
const updateCurrentUserMock = vi.hoisted(() => vi.fn())
const deleteListingMock = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }))

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

vi.mock('../catalog/catalogApi', () => ({
  deleteListing: (...args: unknown[]) => deleteListingMock(...args),
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

  it('renders user info and trust index', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Иван Иванов')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('+7 999 123 45 67')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Индекс доверия/i })).toBeInTheDocument()
    expect(screen.getByText('95 / 100')).toBeInTheDocument()
    expect(screen.getByText('Нет данных')).toBeInTheDocument()
    expect(screen.getAllByText('10').length).toBeGreaterThan(0)

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

    await user.click(screen.getByRole('button', { name: /Редактировать данные профиля/i }))

    const nameInput = await screen.findByLabelText(/Имя и фамилия/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Новое имя')

    await user.click(screen.getByRole('button', { name: /^Сохранить$/i }))

    await waitFor(() => {
      expect(updateCurrentUserMock).toHaveBeenCalledWith({ fullName: 'Новое имя' }, 'token-123')
    })
    expect(refreshProfile).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Личные данные/i })).not.toBeInTheDocument()
    })
  })

  it('renders user listings', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Моя палатка')).toBeInTheDocument()
      expect(screen.getByText(/500\s*₽\s*\/\s*сутки/i)).toBeInTheDocument()
      expect(screen.getByText('Активно')).toBeInTheDocument()
    })
  })

  it('opens delete listing modal and deletes on confirm', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await screen.findByText('Моя палатка')
    const listingsSection = screen.getByRole('heading', { name: /Мои объявления/i }).closest('section')
    expect(listingsSection).toBeTruthy()
    const buttons = (listingsSection as HTMLElement).querySelectorAll('button.btn')
    const deleteListingBtn = [...buttons].find((b) => b.textContent?.trim() === 'Удалить')
    expect(deleteListingBtn).toBeTruthy()
    await user.click(deleteListingBtn!)

    expect(await screen.findByRole('heading', { name: /Удалить объявление\?/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Моя палатка/i).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: /^Да, удалить$/i }))

    await waitFor(() => {
      expect(deleteListingMock).toHaveBeenCalledWith('l1', 'token-123')
    })
    await waitFor(() => {
      expect(screen.queryByText('Моя палатка')).not.toBeInTheDocument()
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
