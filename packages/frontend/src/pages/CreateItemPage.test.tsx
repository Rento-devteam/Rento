import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateItemPage } from './CreateItemPage'

const navigateMock = vi.hoisted(() => vi.fn())
const useAuthMock = vi.hoisted(() => vi.fn())
const getCreateMetadataMock = vi.hoisted(() => vi.fn())
const createListingMock = vi.hoisted(() => vi.fn())
const uploadListingPhotoMock = vi.hoisted(() => vi.fn())
const deleteListingPhotoMock = vi.hoisted(() => vi.fn())
const publishListingMock = vi.hoisted(() => vi.fn())
const getOwnedListingForEditMock = vi.hoisted(() => vi.fn())
const updateListingMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({}),
  }
})

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../catalog/catalogApi', () => ({
  getCreateMetadata: (...args: unknown[]) => getCreateMetadataMock(...args),
  createListing: (...args: unknown[]) => createListingMock(...args),
  uploadListingPhoto: (...args: unknown[]) => uploadListingPhotoMock(...args),
  deleteListingPhoto: (...args: unknown[]) => deleteListingPhotoMock(...args),
  publishListing: (...args: unknown[]) => publishListingMock(...args),
  getOwnedListingForEdit: (...args: unknown[]) => getOwnedListingForEditMock(...args),
  updateListing: (...args: unknown[]) => updateListingMock(...args),
}))

describe('CreateItemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      user: { id: 'u1', email: 'test@example.com' },
      accessToken: 'token-123',
    })
    getCreateMetadataMock.mockResolvedValue({
      categories: [{ id: 'cat-1', name: 'Спорт' }],
    })
    createListingMock.mockResolvedValue({
      id: 'listing-1',
      status: 'DRAFT',
      message: 'Draft created',
      nextStep: 'upload_photos',
    })
    uploadListingPhotoMock.mockResolvedValue({
      photo: { id: 'p1', url: 'https://example.com/photo.jpg' },
      totalPhotos: 1,
      message: 'Photo uploaded',
      nextStep: 'publish_listing',
    })
    deleteListingPhotoMock.mockResolvedValue({
      success: true,
      totalPhotos: 0,
      message: 'Photo removed',
    })
    publishListingMock.mockResolvedValue({
      id: 'listing-1',
      status: 'ACTIVE',
      message: 'Listing published successfully',
      nextStep: null,
    })
  })

  it('renders create form fields', async () => {
    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /новое объявление/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^название$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/категория товара/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/размер залога/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(getCreateMetadataMock).toHaveBeenCalledWith('token-123')
    })
  })

  it('creates draft listing and keeps it editable', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getCreateMetadataMock).toHaveBeenCalled())

    await user.type(screen.getByLabelText(/^название$/i), 'Палатка')
    await user.selectOptions(screen.getByLabelText(/категория товара/i), 'cat-1')
    await user.type(screen.getByLabelText(/цена за период/i), '500')
    await user.type(screen.getByLabelText(/расскажите о нём/i), 'Отличная палатка')
    await user.type(screen.getByLabelText(/размер залога/i), '1000')
    await user.selectOptions(screen.getByLabelText(/состояние товара/i), 'good')

    await user.click(screen.getByRole('button', { name: /создать черновик/i }))

    await waitFor(() => expect(createListingMock).toHaveBeenCalledTimes(1))

    expect(screen.getByRole('button', { name: /сохранить черновик/i })).toBeInTheDocument()
  })

  it('uploads photo after draft creation', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getCreateMetadataMock).toHaveBeenCalled())

    await user.type(screen.getByLabelText(/^название$/i), 'Палатка')
    await user.selectOptions(screen.getByLabelText(/категория товара/i), 'cat-1')
    await user.type(screen.getByLabelText(/цена за период/i), '500')
    await user.type(screen.getByLabelText(/расскажите о нём/i), 'Отличная палатка')
    await user.type(screen.getByLabelText(/размер залога/i), '1000')
    await user.selectOptions(screen.getByLabelText(/состояние товара/i), 'good')

    await user.click(screen.getByRole('button', { name: /создать черновик/i }))

    await waitFor(() => expect(createListingMock).toHaveBeenCalled())

    const fileInput = screen.getByLabelText(/добавить фото/i) as HTMLInputElement
    const file = new File(['image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(uploadListingPhotoMock).toHaveBeenCalledWith('listing-1', expect.any(File), 'token-123')
    })
  })

  it('queues photo before draft creation and uploads it after save', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getCreateMetadataMock).toHaveBeenCalled())

    const fileInput = screen.getByLabelText(/добавить фото/i) as HTMLInputElement
    const file = new File(['image-bytes'], 'before-create.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await user.type(screen.getByLabelText(/^название$/i), 'Палатка')
    await user.selectOptions(screen.getByLabelText(/категория товара/i), 'cat-1')
    await user.type(screen.getByLabelText(/цена за период/i), '500')
    await user.type(screen.getByLabelText(/расскажите о нём/i), 'Отличная палатка')
    await user.type(screen.getByLabelText(/размер залога/i), '1000')
    await user.selectOptions(screen.getByLabelText(/состояние товара/i), 'good')
    await user.click(screen.getByRole('button', { name: /создать черновик/i }))

    await waitFor(() => expect(createListingMock).toHaveBeenCalled())
    await waitFor(() => {
      expect(uploadListingPhotoMock).toHaveBeenCalledWith('listing-1', expect.any(File), 'token-123')
    })
  })

  it('allows creating draft without filling description body', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getCreateMetadataMock).toHaveBeenCalled())

    await user.type(screen.getByLabelText(/^название$/i), 'Палатка')
    await user.selectOptions(screen.getByLabelText(/категория товара/i), 'cat-1')
    await user.type(screen.getByLabelText(/цена за период/i), '500')
    await user.type(screen.getByLabelText(/размер залога/i), '1000')
    await user.selectOptions(screen.getByLabelText(/состояние товара/i), 'good')
    await user.click(screen.getByRole('button', { name: /создать черновик/i }))

    expect(screen.getByLabelText(/расскажите о нём/i)).not.toHaveAttribute('required')
    await waitFor(() => expect(createListingMock).toHaveBeenCalledTimes(1))
  })

  it('publishes listing after at least one photo', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <CreateItemPage />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getCreateMetadataMock).toHaveBeenCalled())

    await user.type(screen.getByLabelText(/^название$/i), 'Палатка')
    await user.selectOptions(screen.getByLabelText(/категория товара/i), 'cat-1')
    await user.type(screen.getByLabelText(/цена за период/i), '500')
    await user.type(screen.getByLabelText(/расскажите о нём/i), 'Отличная палатка')
    await user.type(screen.getByLabelText(/размер залога/i), '1000')
    await user.selectOptions(screen.getByLabelText(/состояние товара/i), 'good')
    await user.click(screen.getByRole('button', { name: /создать черновик/i }))

    await waitFor(() => expect(createListingMock).toHaveBeenCalled())

    const fileInput = screen.getByLabelText(/добавить фото/i) as HTMLInputElement
    const file = new File(['image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    await waitFor(() => expect(uploadListingPhotoMock).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /^опубликовать$/i }))

    await waitFor(() => {
      expect(publishListingMock).toHaveBeenCalledWith('listing-1', 'token-123')
    })
  })
})
