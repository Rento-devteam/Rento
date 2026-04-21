import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CreateItemPage } from './CreateItemPage'

describe('CreateItemPage', () => {
  it('renders the form with all required fields', () => {
    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /новое объявление/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^название$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/категория товара/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/состояние товара/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/цена за час/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/цена за сутки/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/бренд/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/год выпуска/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/расскажите о нём/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/размер залога/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /опубликовать/i })).toBeInTheDocument()
  })

  it('allows filling out the form', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/^название$/i), 'Палатка')
    expect(screen.getByLabelText(/^название$/i)).toHaveValue('Палатка')

    await user.selectOptions(screen.getByLabelText(/категория товара/i), 'sport')
    expect(screen.getByLabelText(/категория товара/i)).toHaveValue('sport')

    await user.type(screen.getByLabelText(/цена за сутки/i), '500')
    expect(screen.getByLabelText(/цена за сутки/i)).toHaveValue(500)

    await user.type(screen.getByLabelText(/расскажите о нём/i), 'Отличная палатка')
    expect(screen.getByLabelText(/расскажите о нём/i)).toHaveValue('Отличная палатка')
  })

  it('allows changing rental method', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    const dayRadio = screen.getByLabelText(/посуточная/i)
    const weekRadio = screen.getByLabelText(/недельная/i)

    expect(dayRadio).toBeChecked()
    expect(weekRadio).not.toBeChecked()

    await user.click(weekRadio)

    expect(dayRadio).not.toBeChecked()
    expect(weekRadio).toBeChecked()
  })
})