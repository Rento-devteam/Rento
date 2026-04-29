import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  createListing,
  getCreateMetadata,
  getOwnedListingForEdit,
  publishListing,
  updateListing,
  deleteListingPhoto,
  uploadListingPhoto,
  type CreateListingResponse,
} from '../catalog/catalogApi'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { ApiError } from '../lib/apiClient'
import {
  LISTING_FORM_PRICE_LABEL,
  listingFormPriceHintRu,
} from '../lib/rentalPeriodRu'

type RentalMethod = 'hour' | 'day' | 'week' | 'month'

type CreateStep = 'form' | 'upload'
type PendingPhoto = { tempId: string; file: File }

const TITLE_MIN = 3
const TITLE_MAX = 180
const DESC_MAX = 8000
const PRICE_MAX = 10_000_000
/** Совпадает с лимитом на сервере (`MAX_LISTING_PHOTOS`). */
const MAX_LISTING_PHOTOS = 10

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

function splitListingDescription(description: string): {
  brand: string
  year: string
  condition: string
  body: string
} {
  const parts = description.split('. ')
  let brand = ''
  let year = ''
  let condition = ''
  const rest: string[] = []
  for (const part of parts) {
    if (part.startsWith('Бренд: ')) {
      brand = part.slice('Бренд: '.length).trim()
    } else if (part.startsWith('Год: ')) {
      year = part.slice('Год: '.length).trim()
    } else if (part.startsWith('Состояние: ')) {
      condition = part.slice('Состояние: '.length).trim()
    } else if (part.length > 0) {
      rest.push(part)
    }
  }
  return { brand, year, condition, body: rest.join('. ') }
}

function validateListingForm(params: {
  title: string
  description: string
  rentalPrice: number
  deposit: number
  brand: string
  year: string
}): string | null {
  const title = params.title.trim()
  if (title.length < TITLE_MIN) {
    return `Название не короче ${TITLE_MIN} символов`
  }
  if (title.length > TITLE_MAX) {
    return `Название не длиннее ${TITLE_MAX} символов`
  }
  const desc = params.description.trim()
  if (desc.length > DESC_MAX) {
    return `Описание не длиннее ${DESC_MAX} символов`
  }
  if (params.rentalPrice <= 0 || params.rentalPrice > PRICE_MAX) {
    return 'Укажите корректную цену аренды'
  }
  if (params.deposit < 0 || params.deposit > PRICE_MAX) {
    return 'Укажите корректный залог'
  }
  if (params.brand.length > 100) {
    return 'Слишком длинное значение бренда'
  }
  if (params.year.trim() && !/^\d{4}$/.test(params.year.trim())) {
    return 'Год укажите четырьмя цифрами, например 2020'
  }
  return null
}

export function CreateItemPage() {
  const navigate = useNavigate()
  const { id: routeListingId } = useParams<{ id?: string }>()
  const isEditMode = Boolean(routeListingId)
  const { accessToken, user } = useAuth()
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [step, setStep] = useState<CreateStep>('form')
  const [createdListing, setCreatedListing] = useState<CreateListingResponse | null>(null)
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ id: string; url: string }>>([])
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([])
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    brand: '',
    year: '',
    description: '',
    condition: '',
    rentalMethod: 'day' as RentalMethod,
    rentalPrice: '',
    deposit: '',
  })

  const formLocked = false
  const effectiveListingId = createdListing?.id ?? routeListingId ?? null
  const listingStatus = createdListing?.status
  const photosEditable =
    listingStatus === 'DRAFT' || listingStatus === 'ACTIVE'
  const totalSelectedPhotos = uploadedPhotos.length + pendingPhotos.length

  const canUploadPhotos = useMemo(
    () =>
      Boolean(accessToken) &&
      (!createdListing || photosEditable) &&
      totalSelectedPhotos < MAX_LISTING_PHOTOS,
    [
      accessToken,
      totalSelectedPhotos,
      createdListing,
      photosEditable,
    ],
  )

  const canRemovePhoto = useMemo(() => {
    if (!createdListing || !photosEditable || !accessToken || !effectiveListingId) return false
    if (listingStatus === 'ACTIVE') return uploadedPhotos.length > 1
    return uploadedPhotos.length > 0
  }, [
    createdListing,
    photosEditable,
    listingStatus,
    uploadedPhotos.length,
    accessToken,
    effectiveListingId,
  ])

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

  useEffect(() => {
    if (!isEditMode || !routeListingId || !accessToken || !user) return
    const editListingId = routeListingId
    const token = accessToken
    let cancelled = false

    async function loadListing() {
      setError(null)
      try {
        const listing = await getOwnedListingForEdit(editListingId, token)
        if (cancelled) return
        const parsed = splitListingDescription(listing.description)
        setFormData({
          title: listing.title,
          category: listing.categoryId,
          brand: parsed.brand,
          year: parsed.year,
          description: parsed.body || listing.description,
          condition: parsed.condition || '',
          rentalMethod:
            listing.rentalPeriod === 'HOUR'
              ? 'hour'
              : listing.rentalPeriod === 'WEEK'
                ? 'week'
                : listing.rentalPeriod === 'MONTH'
                  ? 'month'
                  : 'day',
          rentalPrice: String(Math.round(listing.rentalPrice)),
          deposit: String(Math.round(listing.depositAmount)),
        })
        setUploadedPhotos((listing.photos ?? []).map((p) => ({ id: p.id, url: p.url })))
        const isActive = listing.status === 'ACTIVE'
        setStep(!isActive && (listing.photos?.length ?? 0) > 0 ? 'upload' : 'form')
        setCreatedListing({
          id: listing.id,
          status: listing.status,
          message: '',
          nextStep: 'upload_photos',
        })
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Не удалось загрузить объявление'))
        }
      }
    }

    void loadListing()
    return () => {
      cancelled = true
    }
  }, [isEditMode, routeListingId, accessToken, user])

  const rentalPeriod = useMemo<'HOUR' | 'DAY' | 'WEEK' | 'MONTH'>(() => {
    if (formData.rentalMethod === 'hour') return 'HOUR'
    if (formData.rentalMethod === 'week') return 'WEEK'
    if (formData.rentalMethod === 'month') return 'MONTH'
    return 'DAY'
  }, [formData.rentalMethod])

  const rentalPrice = useMemo(() => Number(formData.rentalPrice || 0), [formData.rentalPrice])

  const removePendingPhoto = (tempId: string) => {
    setPendingPhotos((prev) => prev.filter((p) => p.tempId !== tempId))
  }

  const buildDescription = () => {
    const descriptionParts = [
      formData.brand.trim() ? `Бренд: ${formData.brand.trim()}` : null,
      formData.year.trim() ? `Год: ${formData.year.trim()}` : null,
      formData.condition.trim() ? `Состояние: ${formData.condition.trim()}` : null,
      formData.description.trim(),
    ].filter(Boolean)
    return descriptionParts.join('. ')
  }

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

    const depositNum = Number(formData.deposit === '' ? 0 : formData.deposit)
    const clientErr = validateListingForm({
      title: formData.title,
      description: formData.description,
      rentalPrice,
      deposit: depositNum,
      brand: formData.brand,
      year: formData.year,
    })
    if (clientErr) {
      setError(clientErr)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: formData.title.trim(),
        description: buildDescription(),
        categoryId: formData.category,
        rentalPrice,
        rentalPeriod,
        depositAmount: depositNum,
      }

      if (isEditMode && routeListingId) {
        await updateListing(routeListingId, payload, accessToken)
        setSuccess('Изменения сохранены')
      } else {
        const created = await createListing(payload, accessToken)
        setCreatedListing(created)
        setStep('upload')
        if (pendingPhotos.length > 0) {
          setSuccess('Черновик создан. Загружаем добавленные фото...')
          setUploadingPhoto(true)
          try {
            for (const pending of pendingPhotos) {
              const uploaded = await uploadListingPhoto(created.id, pending.file, accessToken)
              setUploadedPhotos((prev) => [...prev, { id: uploaded.photo.id, url: uploaded.photo.url }])
            }
            setPendingPhotos([])
            setSuccess('Черновик создан, фото загружены. Можно продолжать редактирование.')
          } finally {
            setUploadingPhoto(false)
          }
        } else {
          setSuccess('Черновик создан. Можно сразу добавить фото или продолжить редактирование.')
        }
      }
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          isEditMode ? 'Не удалось сохранить объявление' : 'Не удалось создать объявление',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccess(null)

    if (totalSelectedPhotos >= MAX_LISTING_PHOTOS) {
      setError(`Можно загрузить не более ${MAX_LISTING_PHOTOS} фотографий`)
      event.target.value = ''
      return
    }

    if (!accessToken) {
      setError('Сессия истекла, войдите снова')
      event.target.value = ''
      return
    }

    if (!effectiveListingId) {
      setPendingPhotos((prev) => [
        ...prev,
        { tempId: `${Date.now()}-${Math.random().toString(16).slice(2)}`, file },
      ])
      setSuccess('Фото добавлено. Сохраним его автоматически при создании черновика.')
      event.target.value = ''
      return
    }

    setUploadingPhoto(true)
    try {
      const uploaded = await uploadListingPhoto(effectiveListingId, file, accessToken)
      setUploadedPhotos((prev) => [...prev, { id: uploaded.photo.id, url: uploaded.photo.url }])
      setSuccess(
        createdListing?.status === 'ACTIVE'
          ? 'Фото добавлено. Изменения видны в каталоге и на странице объявления.'
          : 'Фото добавлено в черновик. Можете продолжить редактирование и опубликовать позже.',
      )
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Не удалось загрузить фотографию'))
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!effectiveListingId || !accessToken) return
    setError(null)
    setSuccess(null)
    setDeletingPhotoId(photoId)
    try {
      await deleteListingPhoto(effectiveListingId, photoId, accessToken)
      setUploadedPhotos((prev) => prev.filter((p) => p.id !== photoId))
      setSuccess(
        listingStatus === 'ACTIVE'
          ? 'Фото удалено. Карточка в каталоге обновится.'
          : 'Фото удалено.',
      )
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Не удалось удалить фото'))
    } finally {
      setDeletingPhotoId(null)
    }
  }

  const handlePublish = async () => {
    setError(null)
    setSuccess(null)
    if (!effectiveListingId || !accessToken) {
      setError('Сначала создайте черновик объявления')
      return
    }
    if (uploadedPhotos.length === 0) {
      setError('Добавьте хотя бы одну фотографию перед публикацией')
      return
    }

    setPublishing(true)
    try {
      await publishListing(effectiveListingId, accessToken)
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

  const showPublishBlock =
    createdListing?.status === 'DRAFT' && uploadedPhotos.length > 0

  const submitLabel = () => {
    if (submitting) return 'Сохранение...'
    if (isEditMode) {
      return createdListing?.status === 'ACTIVE' ? 'Сохранить изменения' : 'Сохранить черновик'
    }
    if (createdListing?.status === 'DRAFT') return 'Сохранить черновик'
    return 'Создать черновик'
  }

  const uploadPhotoLightboxSlides = useMemo(
    () =>
      uploadedPhotos.map((p) => ({
        url: p.url,
        alt: formData.title.trim() || 'Фото объявления',
      })),
    [uploadedPhotos, formData.title],
  )

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
        {isEditMode ? 'Редактирование объявления' : 'Новое объявление'}
      </h1>

      <form onSubmit={handleSubmit} className="create-item-form">
        {error ? <div className="alert alert--error">{error}</div> : null}
        {success ? <div className="alert alert--success">{success}</div> : null}

        <div className="create-item-grid">
          <div className="create-item-col">
            <div className="photo-upload">
              <label
                className="photo-upload__inner"
                htmlFor="listing-photo-input"
                style={{
                  cursor: canUploadPhotos && !uploadingPhoto ? 'pointer' : 'not-allowed',
                  opacity: canUploadPhotos ? 1 : 0.65,
                }}
              >
                <svg viewBox="0 0 24 24" className="photo-upload__icon">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm4.5 6H7.5c-.83 0-1.5-.67-1.5-1.5 0-2.5 5.5-3.5 6-3.5s6 1 6 3.5c0 .83-.67 1.5-1.5 1.5z" />
                </svg>
                <span>
                  {!effectiveListingId
                    ? `Добавить фото до создания (${totalSelectedPhotos}/${MAX_LISTING_PHOTOS})`
                    : !createdListing && isEditMode
                      ? 'Загрузка объявления…'
                      : !photosEditable
                        ? 'Фото для этого статуса недоступны'
                        : totalSelectedPhotos >= MAX_LISTING_PHOTOS
                          ? `Загружено максимум фото (${MAX_LISTING_PHOTOS})`
                          : !canUploadPhotos
                          ? 'Добавление фото сейчас недоступно'
                            : uploadingPhoto
                              ? 'Загрузка фото...'
                              : !effectiveListingId
                                ? `Добавить фото до создания (${totalSelectedPhotos}/${MAX_LISTING_PHOTOS})`
                                : `Добавить фото (${totalSelectedPhotos}/${MAX_LISTING_PHOTOS})`}
                </span>
              </label>
              <input
                id="listing-photo-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                aria-label="Добавить фото"
                onChange={handlePhotoChange}
                disabled={!canUploadPhotos || uploadingPhoto}
              />
            </div>

            {uploadedPhotos.length > 0 ? (
              <div className="field">
                <label className="field__label">
                  Загруженные фото ({uploadedPhotos.length}/{MAX_LISTING_PHOTOS})
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-2)' }}>
                  {uploadedPhotos.map((photo, photoIndex) => (
                    <div key={photo.id} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setPhotoLightboxIndex(photoIndex)}
                        aria-label="Открыть фото на весь экран"
                        style={{
                          border: 0,
                          padding: 0,
                          margin: 0,
                          width: '100%',
                          height: 120,
                          borderRadius: 'var(--r-sm)',
                          cursor: 'zoom-in',
                          background: 'var(--bg-surface-strong, #e8ecf7)',
                          display: 'block',
                        }}
                      >
                        <img
                          src={photo.url}
                          alt="Фото объявления"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            borderRadius: 'var(--r-sm)',
                            display: 'block',
                          }}
                        />
                      </button>
                      {canRemovePhoto ? (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            minHeight: 'auto',
                            background: 'rgba(255,255,255,0.92)',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                            zIndex: 2,
                          }}
                          disabled={deletingPhotoId === photo.id || uploadingPhoto}
                          aria-label="Удалить фото"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDeletePhoto(photo.id)
                          }}
                        >
                          {deletingPhotoId === photo.id ? '…' : 'Удалить'}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {pendingPhotos.length > 0 ? (
              <div className="field">
                <label className="field__label">
                  Фото к загрузке после создания ({pendingPhotos.length})
                </label>
                <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                  {pendingPhotos.map((photo) => (
                    <div
                      key={photo.tempId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--sp-2)',
                        background: 'var(--bg-surface-strong, #eef2ff)',
                        borderRadius: 'var(--r-sm)',
                        padding: '8px 10px',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {photo.file.name}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', minHeight: 'auto' }}
                        onClick={() => removePendingPhoto(photo.tempId)}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field">
              <label className="field__label" htmlFor="item-category">
                Категория товара
              </label>
              <select
                id="item-category"
                className="field__input"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                disabled={loadingCategories || formLocked}
              >
                <option value="" disabled>
                  {loadingCategories ? 'Загрузка категорий...' : 'Выберите категорию'}
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
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
                    disabled={formLocked}
                  />
                  Почасовая
                </label>
                <label className="rental-method">
                  <input
                    type="radio"
                    name="rentalMethod"
                    value="day"
                    checked={formData.rentalMethod === 'day'}
                    onChange={() => handleRadioChange('day')}
                    disabled={formLocked}
                  />
                  Посуточная
                </label>
                <label className="rental-method">
                  <input
                    type="radio"
                    name="rentalMethod"
                    value="week"
                    checked={formData.rentalMethod === 'week'}
                    onChange={() => handleRadioChange('week')}
                    disabled={formLocked}
                  />
                  Недельная
                </label>
                <label className="rental-method">
                  <input
                    type="radio"
                    name="rentalMethod"
                    value="month"
                    checked={formData.rentalMethod === 'month'}
                    onChange={() => handleRadioChange('month')}
                    disabled={formLocked}
                  />
                  Помесячная
                </label>
              </div>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="item-condition">
                Состояние товара
              </label>
              <select
                id="item-condition"
                className="field__input"
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                required
                disabled={formLocked}
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
              <label className="field__label" htmlFor="item-rental-price">
                {LISTING_FORM_PRICE_LABEL}
              </label>
              <input
                id="item-rental-price"
                className="field__input"
                type="number"
                name="rentalPrice"
                min="0"
                max={PRICE_MAX}
                value={formData.rentalPrice}
                onChange={handleChange}
                placeholder="0"
                required
                disabled={formLocked}
              />
              <span className="field__hint">{listingFormPriceHintRu(rentalPeriod)}</span>
            </div>
          </div>

          <div className="create-item-col create-item-col--wide">
            <div className="field">
              <label className="field__label" htmlFor="item-title">
                Название
              </label>
              <input
                id="item-title"
                className="field__input"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                maxLength={TITLE_MAX}
                disabled={formLocked}
              />
            </div>

            <div className="create-item-row">
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label" htmlFor="item-brand">
                  Бренд
                </label>
                <input
                  id="item-brand"
                  className="field__input"
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  maxLength={100}
                  disabled={formLocked}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field__label" htmlFor="item-year">
                  Год выпуска
                </label>
                <input
                  id="item-year"
                  className="field__input"
                  type="text"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  placeholder="Например, 2020"
                  maxLength={4}
                  disabled={formLocked}
                />
              </div>
            </div>

            <div className="field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label className="field__label" htmlFor="item-description">
                Расскажите о нём
              </label>
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
                maxLength={DESC_MAX}
                disabled={formLocked}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="item-deposit">
                Размер залога (₽)
              </label>
              <input
                id="item-deposit"
                className="field__input"
                type="number"
                name="deposit"
                min="0"
                max={PRICE_MAX}
                value={formData.deposit}
                onChange={handleChange}
                placeholder="Например, 5000 или 0"
                disabled={formLocked}
              />
            </div>

            {step === 'upload' && !isEditMode ? (
              <div className="alert alert--success">
                Черновик создан. Добавляйте фото и редактируйте объявление в удобном порядке. Перейти в{' '}
                <button type="button" className="btn btn--ghost" onClick={() => navigate('/profile')}>
                  Профиль
                </button>
              </div>
            ) : null}
          </div>

          <div className="create-item-footer">
            {showPublishBlock ? (
              <button
                type="button"
                className="btn btn--brand create-item-submit"
                disabled={publishing || uploadedPhotos.length === 0}
                onClick={() => void handlePublish()}
              >
                {publishing ? 'Публикация...' : 'Опубликовать'}
              </button>
            ) : null}
            <button
              type="submit"
              className="btn btn--brand create-item-submit"
              disabled={submitting}
            >
              {submitLabel()}
            </button>
          </div>
        </div>
      </form>

      <PhotoLightbox
        open={photoLightboxIndex !== null}
        slides={uploadPhotoLightboxSlides}
        index={photoLightboxIndex ?? 0}
        onClose={() => setPhotoLightboxIndex(null)}
        onNavigate={setPhotoLightboxIndex}
      />
    </main>
  )
}
