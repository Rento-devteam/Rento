import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

const searchCatalogMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    results: [],
    totalCount: 0,
    page: 1,
    limit: 24,
    emptyResults: true,
    suggestion: null,
    relaxedMatch: false,
    popularCategories: [],
  }),
)

vi.mock('./catalog/catalogApi', () => ({
  searchCatalog: (...args: unknown[]) => searchCatalogMock(...args),
}))

describe('App', () => {
  it('opens auth modal on /login', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('dialog', { name: /вход или регистрация/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /вход в аккаунт/i })).toBeInTheDocument()
  })

  it('does not render main header on confirm-email route', () => {
    render(
      <MemoryRouter initialEntries={['/confirm-email']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })
})
