import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { IListing, RentalPeriod } from '@rento/shared'
import { getListingDetails } from '../catalog/catalogApi'
import { ApiError } from '../lib/apiClient'
import { getListingDisplayParts } from '../lib/listingDescriptionParts'

function periodShort(period: RentalPeriod): string {
  switch (period) {
    case 'HOUR':
      return 'час'
    case 'DAY':
      return 'сутки'
    case 'WEEK':
      return 'неделя'
    case 'MONTH':
      return 'месяц'
  }
}

function periodFull(period: RentalPeriod): string {
  switch (period) {
    case 'HOUR':
      return 'Почасовая'
    case 'DAY':
      return 'Посуточная'
    case 'WEEK':
      return 'Понедельная'
    case 'MONTH':
      return 'Помесячная'
  }
}

function formatPublished(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function ListingDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [listing, setListing] = useState<IListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    if (!id) {
      setError('Объявление не найдено')
      setLoading(false)
      return
    }

    async function loadListing() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const data = await getListingDetails(id)
        setListing(data)
        setActivePhoto(0)
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) {
          setError('Объявление не найдено или уже недоступно')
        } else if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Не удалось загрузить объявление')
        }
      } finally {
        setLoading(false)
      }
    }

    void loadListing()
  }, [id])

  const periodLabel = useMemo(() => (listing ? periodShort(listing.rentalPeriod) : ''), [listing])
  const periodTitle = useMemo(() => (listing ? periodFull(listing.rentalPeriod) : ''), [listing])
  const displayParts = useMemo(
    () => (listing ? getListingDisplayParts(listing.description) : null),
    [listing],
  )

  if (loading) {
    return (
      <main className="listing-page listing-page--loading">
        <div className="listing-page__inner container">
          <div className="listing-page__skeleton" aria-hidden />
        </div>
      </main>
    )
  }

  if (error || !listing) {
    return (
      <main className="listing-page">
        <div className="listing-page__inner container">
          <div className="status status--error">{error ?? 'Объявление не найдено'}</div>
          <Link to="/" className="btn btn--brand" style={{ marginTop: 'var(--sp-4)' }}>
            На главную
          </Link>
        </div>
      </main>
    )
  }

  const photos = listing.photos
  const hasPhotos = photos.length > 0
  const currentPhoto = hasPhotos ? photos[Math.min(activePhoto, photos.length - 1)] : null
  const isDraft = listing.status === 'DRAFT'

  const showCharacteristics = Boolean(
    displayParts?.brand || displayParts?.year || displayParts?.condition,
  )
  const needsGapBeforeDescription = Boolean(displayParts?.address || showCharacteristics)

  return (
    <main className="listing-page">
      <div className="listing-page__inner container">
        <div className="listing-page__top">
          <button type="button" className="listing-page__back" onClick={() => navigate(-1)}>
            <ChevronBackIcon />
            Назад
          </button>
          <nav className="listing-page__crumbs" aria-label="Навигация по разделам">
            <Link to="/">Главная</Link>
            <span className="listing-page__crumb-sep" aria-hidden>
              /
            </span>
            <span>Каталог</span>
            <span className="listing-page__crumb-sep" aria-hidden>
              /
            </span>
            <span className="listing-page__crumb-current">{listing.category.name}</span>
          </nav>
        </div>

        <div className="listing-page__layout">
          <div className="listing-page__main">
            <div className="listing-page__gallery">
              <div className="listing-page__hero">
                {currentPhoto ? (
                  <img src={currentPhoto.url} alt={listing.title} />
                ) : (
                  <div className="listing-page__hero-empty">Нет фотографий</div>
                )}
                {isDraft ? (
                  <span className="listing-page__hero-badge">Черновик</span>
                ) : null}
              </div>

              {hasPhotos ? (
                <div className="listing-page__thumbs" role="tablist" aria-label="Галерея фото">
                  {photos.map((photo, index) => (
                    <button
                      type="button"
                      key={photo.id}
                      role="tab"
                      aria-selected={index === activePhoto}
                      className={`listing-page__thumb${index === activePhoto ? ' is-active' : ''}`}
                      onClick={() => setActivePhoto(index)}
                    >
                      <img src={photo.thumbnailUrl ?? photo.url} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <section className="listing-page__about" aria-label="Адрес, характеристики и описание">
              {displayParts?.address ? (
                <>
                  <h2 id="listing-address-heading" className="listing-page__about-title">
                    Адрес
                  </h2>
                  <p className="listing-page__address">{displayParts.address}</p>
                </>
              ) : null}

              {showCharacteristics ? (
                <>
                  <h2
                    id="listing-meta-heading"
                    className={`listing-page__about-title${displayParts?.address ? ' listing-page__about-title--spaced' : ''}`}
                  >
                    Характеристики
                  </h2>
                  <dl className="listing-page__meta-dl">
                    {displayParts?.brand ? (
                      <div className="listing-page__meta-row">
                        <dt className="listing-page__meta-dt">Бренд</dt>
                        <dd className="listing-page__meta-dd">{displayParts.brand}</dd>
                      </div>
                    ) : null}
                    {displayParts?.year ? (
                      <div className="listing-page__meta-row">
                        <dt className="listing-page__meta-dt">Год</dt>
                        <dd className="listing-page__meta-dd">{displayParts.year}</dd>
                      </div>
                    ) : null}
                    {displayParts?.condition ? (
                      <div className="listing-page__meta-row">
                        <dt className="listing-page__meta-dt">Состояние</dt>
                        <dd className="listing-page__meta-dd">{displayParts.condition}</dd>
                      </div>
                    ) : null}
                  </dl>
                </>
              ) : null}

              <h2
                id="listing-desc-heading"
                className={`listing-page__about-title${needsGapBeforeDescription ? ' listing-page__about-title--spaced' : ''}`}
              >
                Описание
              </h2>
              <div className="listing-page__about-body">
                {displayParts?.description ?? listing.description}
              </div>
            </section>
          </div>

          <aside className="listing-page__aside" aria-label="Условия и действия">
            <div className="listing-page__card">
              <div className="listing-page__card-head">
                <span className="listing-page__category">{listing.category.name}</span>
                {isDraft ? <span className="listing-page__pill listing-page__pill--draft">Не опубликовано</span> : null}
              </div>

              <h1 className="listing-page__title">{listing.title}</h1>

              <div className="listing-page__price-box">
                <div className="listing-page__price-row">
                  <span className="listing-page__price-value">
                    {Math.round(listing.rentalPrice).toLocaleString('ru-RU')}
                    <span className="listing-page__price-currency"> ₽</span>
                  </span>
                  <span className="listing-page__price-period">/ {periodLabel}</span>
                </div>
                <p className="listing-page__price-caption">Арендная ставка за выбранный период</p>
              </div>

              <dl className="listing-page__specs">
                <div className="listing-page__spec-row">
                  <dt>Тип аренды</dt>
                  <dd>{periodTitle}</dd>
                </div>
                <div className="listing-page__spec-row">
                  <dt>Залог</dt>
                  <dd>
                    {listing.depositAmount > 0
                      ? `${listing.depositAmount.toLocaleString('ru-RU')} ₽`
                      : 'Не требуется'}
                  </dd>
                </div>
                <div className="listing-page__spec-row">
                  <dt>Размещено</dt>
                  <dd>{formatPublished(listing.createdAt)}</dd>
                </div>
              </dl>

              <div className="listing-page__actions">
                <Link
                  to={`/listings/${listing.id}/calendar`}
                  className="btn btn--accent btn--block listing-page__cta-primary"
                >
                  Календарь и даты
                </Link>
                <button type="button" className="btn btn--ghost btn--block" disabled>
                  Написать арендодателю
                </button>
              </div>
              <p className="listing-page__actions-hint">Сообщения между пользователями появятся в следующей версии.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

function ChevronBackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 6l-6 6 6 6"
      />
    </svg>
  )
}
