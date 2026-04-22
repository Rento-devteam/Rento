import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  createListing,
  getCreateMetadata,
  publishListing,
  uploadListingPhoto,
  type CreateListingResponse,
} from '../catalog/catalogApi'
import { ApiError } from '../lib/apiClient'

type RentalMethod = 'hour' | 'day' | 'week'

type CreateStep = 'form' | 'upload'

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export function CreateItemPage() {
  const navigate = useNavigate()
  const { accessToken, user } = useAuth()
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [step, setStep] = useState<CreateStep>('form')
  const [createdListing, setCreatedListing] = useState<CreateListingResponse | null>(null)
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ id: string; url: string }>>([])

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    brand: '',
    year: '',
    description: '',
    condition: '',
    rentalMethod: 'day' as RentalMethod,
    priceHour: '',
    priceDay: '',
    deposit: '',
  })

  useEffect(() => {
    if (!user || !accessToken) {
      navigate('/login')
      return
    }

    async function loadMetadata() {
      if (!accessToken) return
      setLoadingCategories(true)
      setError(null)
      try {
        const meta = await getCreateMetadata(accessToken)
        setCategories(meta.categories.map((c) => ({ id: c.id, name: c.name })))
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Не удалось загрузить категории'))
      } finally {
        setLoadingCategories(false)
      }
    }

    void loadMetadata()
  }, [user, accessToken, navigate])

  const rentalPeriod = useMemo<'HOUR' | 'DAY' | 'WEEK'>(() => {
    if (formData.rentalMethod === 'hour') return 'HOUR'
    if (formData.rentalMethod === 'week') return 'WEEK'
    return 'DAY'
  }, [formData.rentalMethod])

  const rentalPrice = useMemo(() => {
    if (rentalPeriod === 'HOUR') {
      return Number(formData.priceHour || 0)
    }
    return Number(formData.priceDay || 0)
  }, [formData.priceDay, formData.priceHour, rentalPeriod])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!accessToken) {
      setError('Сессия истекла, войдите снова')
      return
    }

    if (!formData.category) {
      setError('Выберите категорию')
      return
    }

    if (rentalPrice <= 0) {
      setError('Укажите корректную цену аренды')
      return
    }

    setSubmitting(true)
    try {
      const descriptionParts = [
        formData.brand.trim() ? `Бренд: ${formData.brand.trim()}` : null,
        formData.year.trim() ? `Год: ${formData.year.trim()}` : null,
        formData.condition.trim() ? `Состояние: ${formData.condition.trim()}` : null,
        formData.description.trim(),
      ].filter(Boolean)

      const created = await createListing(
        {
          title: formData.title.trim(),
          description: descriptionParts.join('. '),
          categoryId: formData.category,
          rentalPrice,
          rentalPeriod,
          depositAmount: Number(formData.deposit || 0),
        },
        accessToken,
      )

      setCreatedListing(created)
      setStep('upload')
      setSuccess('Черновик создан. Необходимо загрузить фотографии.')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Не удалось создать объявление'))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccess(null)

    if (!createdListing?.id || !accessToken) {
      setError('Сначала создайте черновик объявления')
      return
    }

    setUploadingPhoto(true)
    try {
      const uploaded = await uploadListingPhoto(
        createdListing.id,
        file,
        accessToken,
        uploadedPhotos.length,
      )
      setUploadedPhotos((prev) => [...prev, { id: uploaded.photo.id, url: uploaded.photo.url }])
      setSuccess('Объявление готово к публикации. Можете перейти в профиль для дальнейших действий.')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Не удалось загрузить фотографию'))
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  const handlePublish = async () => {
    setError(null)
    setSuccess(null)
    if (!createdListing?.id || !accessToken) {
      setError('Сначала создайте черновик объявления')
      return
    }
    if (uploadedPhotos.length === 0) {
      setError('Добавьте хотя бы одну фотографию перед публикацией')
      return
    }

    setPublishing(true)
    try {
      await publishListing(createdListing.id, accessToken)
      setSuccess('Объявление опубликовано и появится в каталоге на главной.')
      setTimeout(() => navigate('/'), 700)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Не удалось опубликовать объявление'))
    } finally {
      setPublishing(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleRadioChange = (val: RentalMethod) => {
    setFormData((prev) => ({ ...prev, rentalMethod: val }))
  }

  return (
    <main className="container" style={{ padding: 'var(--sp-7) 0', flex: 1 }}>
      <h1
        className="hero__title"
        style={{
          marginBottom: 'var(--sp-7)',
          fontFamily: 'var(--font-display)',
          fontSize: '2.5rem',
        }}
      >
        новое объявление
      </h1>

      <form onSubmit={handleSubmit} className="create-item-form">
        {error ? <div className="alert alert--error">{error}</div> : null}
        {success ? <div className="alert alert--success">{success}</div> : null}

        <div className="create-item-grid">
          <div className="create-item-col">
            <div className="photo-upload">
              <label className="photo-upload__inner" htmlFor="listing-photo-input" style={{ cursor: step === 'upload' ? 'pointer' : 'not-allowed', opacity: step === 'upload' ? 1 : 0.7 }}>
                <svg viewBox="0 0 24 24" className="photo-upload__icon">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm4.5 6H7.5c-.83 0-1.5-.67-1.5-1.5 0-2.5 5.5-3.5 6-3.5s6 1 6 3.5c0 .83-.67 1.5-1.5 1.5z" />
                </svg>
                <span>
                  {step === 'form'
                    ? 'Сначала создайте черновик'
                    : uploadingPhoto
                      ? 'Загрузка фото...'
                      : 'Добавить фото'}
                </span>
              </label>
              <input
                id="listing-photo-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handlePhotoChange}
                disabled={step !== 'upload' || uploadingPhoto}
              />
            </div>

            {uploadedPhotos.length > 0 ? (
              <div className="field">
                <label className="field__label">Загруженные фото</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-2)' }}>
                  {uploadedPhotos.map((photo) => (
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt="Фото объявления"
                      style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 'var(--r-sm)' }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field">
              <label className="field__label" htmlFor="item-category">Категория товара</label>
              <select
                id="item-category"
                className="field__input"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                disabled={loadingCategories || step === 'upload'}
              >
                <option value="" disabled>
                  {loadingCategories ? 'Загрузка категорий...' : 'Выберите категорию'}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label">Способ сдачи</label>
              <div className="rental-methods">
                <label className="rental-method">
                  <input
                    type="radio"
                    name="rentalMethod"
                    value="hour"
                    checked={formData.rentalMethod === 'hour'}
                    onChange={() => handleRadioChange('hour')}
                    disabled={step === 'upload'}
                  />
                  почасовая
                </label>
                <label className="rental-method">
                  <input
                    type="radio"
                    name="rentalMethod"
                    value="day"
                    checked={formData.rentalMethod === 'day'}
                    onChange={() => handleRadioChange('day')}
                    disabled={step === 'upload'}
                  />
                  посуточная
                </label>
                <label className="rental-method">
                  <input
                    type="radio"
                    name="rentalMethod"
                    value="week"
                    checked={formData.rentalMethod === 'week'}
                    onChange={() => handleRadioChange('week')}
                    disabled={step === 'upload'}
                  />
                  недельная
                </label>
              </div>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="item-condition">Состояние товара</label>
              <select
                id="item-condition"
                className="field__input"
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                required
                disabled={step === 'upload'}
              >
                <option value="" disabled>
                  Выберите состояние
                </option>
                <option value="new">Новое</option>
                <option value="excellent">Отличное</option>
                <option value="good">Хорошее</option>
                <option value="fair">Удовлетворительное</option>
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="item-price-hour">цена за час</label>
              <input
                id="item-price-hour"
                className="field__input"
                type="number"
                name="priceHour"
                min="0"
                value={formData.priceHour}
                onChange={handleChange}
                placeholder="0"
                required={formData.rentalMethod === 'hour'}
                disabled={step === 'upload'}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="item-price-day">цена за сутки</label>
              <input
                id="item-price-day"
                className="field__input"
                type="number"
                name="priceDay"
                min="0"
                value={formData.priceDay}
                onChange={handleChange}
                placeholder="0"
                required={formData.rentalMethod !== 'hour'}
                disabled={step === 'upload'}
              />
            </div>
          </div>

          <div className="create-item-col create-item-col--wide">
            <div className="field">
              <label className="field__label" htmlFor="item-title">название</label>
              <input
                id="item-title"
                className="field__input"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                disabled={step === 'upload'}
              />
            </div>

            <div className="create-item-row">
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label" htmlFor="item-brand">бренд</label>
                <input
                  id="item-brand"
                  className="field__input"
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  disabled={step === 'upload'}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label" htmlFor="item-year">год выпуска</label>
                <input
                  id="item-year"
                  className="field__input"
                  type="text"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  placeholder="Укажите дату"
                  disabled={step === 'upload'}
                />
              </div>
            </div>

            <div className="field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label className="field__label" htmlFor="item-description">Расскажите о нём...</label>
              <textarea
                id="item-description"
                className="field__input"
                name="description"
                value={formData.description}
                onChange={handleChange}
                style={{
                  flex: 1,
                  minHeight: 200,
                  paddingTop: 16,
                  paddingBottom: 16,
                  resize: 'vertical',
                  lineHeight: 1.5,
                }}
                required
                disabled={step === 'upload'}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="item-deposit">Размер залога (₽)</label>
              <input
                id="item-deposit"
                className="field__input"
                type="number"
                name="deposit"
                min="0"
                value={formData.deposit}
                onChange={handleChange}
                placeholder="Например, 5000"
                required
                disabled={step === 'upload'}
              />
            </div>

            {step === 'upload' ? (
              <div className="alert alert--success">
                Черновик создан. После загрузки фото объявление готово к публикации. Перейти в{' '}
                <button type="button" className="btn btn--ghost" onClick={() => navigate('/profile')}>
                  профиль
                </button>
              </div>
            ) : null}
          </div>

          <div className="create-item-footer">
            {step === 'upload' ? (
              <button
                type="button"
                className="btn btn--brand create-item-submit"
                disabled={publishing || uploadedPhotos.length === 0}
                onClick={handlePublish}
              >
                {publishing ? 'Публикация...' : 'Опубликовать'}
              </button>
            ) : null}
            <button
              type="submit"
              className="btn btn--brand create-item-submit"
              disabled={submitting || step === 'upload'}
            >
              {submitting ? 'Сохранение...' : step === 'upload' ? 'Черновик создан' : 'Создать черновик'}
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}
