import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BrandLogo, LOGO_SRC } from './BrandLogo'

function renderLogo(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BrandLogo />
    </MemoryRouter>,
  )
}

describe('BrandLogo', () => {
  it('renders home link with accessible name', () => {
    renderLogo()
    expect(screen.getByRole('link', { name: /на главную/i })).toHaveAttribute('href', '/')
  })

  it('uses Logo.svg for mark', () => {
    const { container } = renderLogo()
    const img = container.querySelector('.brand__mark-img')
    expect(img).toBeTruthy()
    expect(img).toHaveAttribute('src', LOGO_SRC)
    expect(img).toHaveAttribute('alt', '')
  })

  it('respects custom `to` path', () => {
    render(
      <MemoryRouter>
        <BrandLogo to="/catalog" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /на главную/i })).toHaveAttribute('href', '/catalog')
  })
})
