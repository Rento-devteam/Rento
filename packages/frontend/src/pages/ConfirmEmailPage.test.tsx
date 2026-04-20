import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { ConfirmEmailPage } from './ConfirmEmailPage'

const confirmEmailMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    accessToken: 'access',
    refreshToken: 'refresh',
    user: {
      id: 'u1',
      email: 'a@b.c',
      fullName: null,
      phone: null,
      avatarUrl: null,
      role: 'USER',
      status: 'ACTIVE',
      isVerified: true,
    },
  }),
)

vi.mock('../auth/authApi', () => ({
  authApi: {
    confirmEmail: (...args: unknown[]) => confirmEmailMock(...args),
  },
}))

function renderPage(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ConfirmEmailPage', () => {
  beforeEach(() => {
    confirmEmailMock.mockClear()
  })

  it('shows error when token is missing', async () => {
    renderPage('/confirm-email')
    await waitFor(() => {
      expect(screen.getByText(/нет токена подтверждения/i)).toBeInTheDocument()
    })
    expect(confirmEmailMock).not.toHaveBeenCalled()
  })

  it('confirms email and shows success', async () => {
    renderPage('/confirm-email?token=abc')
    expect(screen.getByText(/проверяем ссылку/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/email подтверждён/i)).toBeInTheDocument()
    })
    expect(confirmEmailMock).toHaveBeenCalledWith('abc', expect.any(Object))
  })
})
