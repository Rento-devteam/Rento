import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import type { ICategory, IListing, RentalPeriod } from '@rento/shared'
import { useAuth } from '../auth/AuthContext'
import { searchCatalog } from '../catalog/catalogApi'
import { ApiError } from '../lib/apiClient'
type SortApi = 'relevance' | 'newest' | 'price_asc' | 'price_desc'
type SortPreset = 'cheap' | 'expensive' | 'popular' | 'near' | 'new'
type RentalFilter = RentalPeriod | 'ALL'

interface SectionTile {
  key: string
  title: string
  categoryId?: string
  iconKey: SectionIconKey
}

type SectionIconKey = 'repair' | 'family' | 'auto' | 'home' | 'pets' | 'tech' | 'hobby' | 'default'

const DEFAULT_SECTIONS: SectionTile[] = [
  { key: 'repair', title: 'Для ремонта', iconKey: 'repair' },
  { key: 'family', title: 'Для семьи', iconKey: 'family' },
  { key: 'auto', title: 'Для авто', iconKey: 'auto' },
  { key: 'home', title: 'Для дома', iconKey: 'home' },
  { key: 'pets', title: 'Для питомцев', iconKey: 'pets' },
  { key: 'tech', title: 'Для техники', iconKey: 'tech' },
]

const SORT_TO_API: Record<SortPreset, SortApi> = {
  cheap: 'price_asc',
  expensive: 'price_desc',
  popular: 'relevance',
  near: 'relevance',
  new: 'newest',
}

const SORT_PRESETS: Array<{ value: SortPreset; label: string }> = [
  { value: 'cheap', label: 'Недорогие' },
  { value: 'expensive', label: 'Дорогие' },
  { value: 'popular', label: 'Популярные' },
  { value: 'near', label: 'Близко' },
  { value: 'new', label: 'Новинки' },
]

const RENTAL_FILTERS: Array<{ value: RentalFilter; label: string }> = [
  { value: 'ALL', label: 'Все' },
  { value: 'HOUR', label: 'Почасовая' },
  { value: 'DAY', label: 'Посуточная' },
  { value: 'WEEK', label: 'Понедельная' },
  { value: 'MONTH', label: 'Помесячная' },
]

const POPULAR_CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Минск', 'Гродно', 'Екатеринбург']

export function HomePage() {
  const { accessToken } = useAuth()
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [cityDraft, setCityDraft] = useState('')
  const [cityOpen, setCityOpen] = useState(false)
  const cityRef = useRef<HTMLDivElement | null>(null)

  const [categoryId, setCategoryId] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [radiusFrom, setRadiusFrom] = useState('1')
  const [radiusTo, setRadiusTo] = useState('30')
  const [sortPreset, setSortPreset] = useState<SortPreset>('popular')
  const [rentalFilter, setRentalFilter] = useState<RentalFilter>('ALL')

  const [items, setItems] = useState<IListing[]>([])
  const [categories, setCategories] = useState<ICategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadCatalog() {
    setLoading(true)
    setError(null)
    try {
      const response = await searchCatalog(
        {
          q,
          city,
          categoryId: categoryId || undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          sort: SORT_TO_API[sortPreset],
          page: 1,
          limit: 24,
        },
        accessToken,
      )
      setItems(response.results)

      const map = new Map<string, ICategory>()
      for (const cat of response.popularCategories) map.set(cat.id, cat)
      for (const listing of response.results) map.set(listing.category.id, listing.category)
      setCategories([...map.values()])
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось загрузить карточки. Попробуйте ещё раз.',
      )
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadCatalog()
    })
    // Mount-only: фильтры и поиск применяются кнопками «Найти» / «Применить».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!cityOpen) return
    function onClick(event: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(event.target as Node)) {
        setCityOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [cityOpen])

  const sections: SectionTile[] = useMemo(() => {
    if (categories.length === 0) return DEFAULT_SECTIONS
    return categories.slice(0, 6).map<SectionTile>((cat) => ({
      key: cat.id,
      categoryId: cat.id,
      title: cat.name,
      iconKey: matchIcon(cat.name),
    }))
  }, [categories])

  const visibleItems = useMemo(() => {
    if (rentalFilter === 'ALL') return items
    return items.filter((item) => item.rentalPeriod === rentalFilter)
  }, [items, rentalFilter])

  const cityOptions = useMemo(() => {
    const set = new Set<string>(POPULAR_CITIES)
    for (const item of items) {
      const cityName = extractCityName(item.description)
      if (cityName) set.add(cityName)
    }
    const list = [...set]
    const needle = cityDraft.trim().toLowerCase()
    const filtered = needle ? list.filter((option) => option.toLowerCase().includes(needle)) : list
    return filtered.sort((a, b) => a.localeCompare(b, 'ru')).slice(0, 8)
  }, [items, cityDraft])

  function onSubmitSearch(event: FormEvent) {
    event.preventDefault()
    void loadCatalog()
  }

  function selectCity(next: string) {
    setCity(next)
    setCityDraft(next)
    setCityOpen(false)
    void loadCatalog()
  }

  function toggleCategory(nextId: string) {
    setCategoryId((current) => (current === nextId ? '' : nextId))
    setTimeout(() => void loadCatalog(), 0)
  }

  return (
    <main>
      <section className="container hero" aria-label="Поиск по каталогу">
        <h1 className="hero__title">Аренда вещей без лишних сложностей</h1>
        <p className="hero__subtitle">
          Найдите то, что нужно, на час, день или месяц. Поиск по городу, фильтрация по цене и
          радиусу — всё в одном окне.
        </p>

        <form className="search-bar" onSubmit={onSubmitSearch}>
          <div className="search-bar__field">
            <SearchIcon />
            <input
              className="search-bar__input"
              type="text"
              placeholder="Что ищем? Дрель, мольберт, велосипед…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>

          <div className="city-popover" ref={cityRef}>
            <button
              type="button"
              className={`search-bar__chip${city ? ' search-bar__chip--active' : ''}`}
              onClick={() => {
                setCityOpen((open) => !open)
                setCityDraft(city)
              }}
              aria-haspopup="dialog"
              aria-expanded={cityOpen}
            >
              <PinIcon />
              {city || 'Город'}
            </button>
            {cityOpen ? (
              <div className="city-popover__panel" role="dialog" aria-label="Выбор города">
                <input
                  className="city-popover__input"
                  type="text"
                  autoFocus
                  placeholder="Введите город"
                  value={cityDraft}
                  onChange={(event) => setCityDraft(event.target.value)}
                />
                <div className="city-popover__list">
                  {cityOptions.length === 0 ? (
                    <p className="city-popover__empty">Ничего не найдено</p>
                  ) : (
                    cityOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="city-popover__option"
                        onClick={() => selectCity(option)}
                      >
                        {option}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={`search-bar__chip${filterOpen ? ' search-bar__chip--active' : ''}`}
            onClick={() => setFilterOpen((open) => !open)}
            aria-expanded={filterOpen}
          >
            <FilterIcon />
            Фильтры
          </button>

          <button type="submit" className="search-bar__submit">
            Найти
          </button>
        </form>
      </section>

      <section className="container" aria-label="Разделы">
        <div className="sections">
          {sections.map((tile) => (
            <button
              key={tile.key}
              type="button"
              className={`section-tile${
                tile.categoryId && tile.categoryId === categoryId ? ' section-tile--active' : ''
              }`}
              onClick={() => tile.categoryId && toggleCategory(tile.categoryId)}
            >
              <span className="section-tile__title">{tile.title}</span>
              <span className="section-tile__icon" aria-hidden>
                <SectionIcon kind={tile.iconKey} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {filterOpen ? (
        <section className="container" aria-label="Фильтры">
          <div className="filters">
            <div className="filters__row">
              <span className="filters__label">Цена</span>
              <div className="filters__range">
                <span>от</span>
                <input
                  type="number"
                  min={0}
                  placeholder="300"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                />
                <span>до</span>
                <input
                  type="number"
                  min={0}
                  placeholder="12000"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                />
                <span>₽</span>
              </div>
            </div>

            <div className="filters__row">
              <span className="filters__label">Радиус поиска</span>
              <div className="filters__range">
                <span>от</span>
                <input
                  type="number"
                  min={0}
                  value={radiusFrom}
                  onChange={(event) => setRadiusFrom(event.target.value)}
                />
                <span>до</span>
                <input
                  type="number"
                  min={0}
                  value={radiusTo}
                  onChange={(event) => setRadiusTo(event.target.value)}
                />
                <span>км</span>
              </div>
            </div>

            <div className="filters__row filters__row--stack">
              <span className="filters__label">Показать сначала</span>
              <div className="chip-group">
                {SORT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`chip${sortPreset === preset.value ? ' chip--active' : ''}`}
                    onClick={() => setSortPreset(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filters__divider" />

            <div className="filters__row filters__row--stack">
              <span className="filters__label">Тип аренды</span>
              <div className="radio-group">
                {RENTAL_FILTERS.map((rental) => (
                  <label key={rental.value}>
                    <input
                      type="radio"
                      name="rentalType"
                      checked={rentalFilter === rental.value}
                      onChange={() => setRentalFilter(rental.value)}
                    />
                    {rental.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn--brand filters__apply"
              onClick={() => void loadCatalog()}
            >
              Применить
            </button>
          </div>
        </section>
      ) : null}

      <section className="container catalog" aria-live="polite">
        <div className="catalog__header">
          <h2 className="catalog__title">Каталог</h2>
          <span className="catalog__meta">
            {loading ? 'Загрузка…' : `Найдено: ${visibleItems.length}`}
          </span>
        </div>

        {error ? <div className="status status--error">{error}</div> : null}

        <div className="catalog__grid">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton" />)
            : visibleItems.map((item) => <Card key={item.id} item={item} />)}

          {!loading && !error && visibleItems.length === 0 ? (
            <div className="status">
              По запросу ничего не найдено. Попробуйте изменить параметры фильтрации.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

function Card({ item }: { item: IListing }) {
  const cover = item.photos[0]?.url
  const cityName = extractCity(item.description)
  const period = periodLabel(item.rentalPeriod)
  return (
    <article className="card">
      <Link to={`/listings/${item.id}`} className="card__link-overlay" aria-label={item.title} />
      <div className="card__image-wrap">
        {cover ? <img src={cover} alt={item.title} className="card__image" /> : null}
        <span className="card__badge">{period}</span>
        <button type="button" className="card__favorite" aria-label="В избранное" style={{ zIndex: 2 }}>
          <HeartIcon />
        </button>
      </div>
      <div className="card__body">
        <h3 className="card__title">
          {item.title}
        </h3>
        <p className="card__desc">{item.description}</p>
        <div className="card__prices">
          <span className="card__price-main">{formatPrice(item)}</span>
          <span className="card__price-secondary">{secondaryPrice(item)}</span>
        </div>
      </div>
      <div className="card__footer" style={{ zIndex: 2, position: 'relative' }}>
        <span>
          <PinIcon />
          {cityName}
        </span>
        <Link 
          to={`/listings/${item.id}/calendar`} 
          className="btn btn--ghost" 
          style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: 'auto' }}
        >
          Календарь
        </Link>
      </div>
    </article>
  )
}

/* ---------- helpers ---------- */

function formatPrice(item: IListing): string {
  const currency = '₽'
  const unit =
    item.rentalPeriod === 'HOUR'
      ? '/час'
      : item.rentalPeriod === 'DAY'
        ? '/сутки'
        : item.rentalPeriod === 'WEEK'
          ? '/неделя'
          : '/месяц'
  return `${Math.round(item.rentalPrice).toLocaleString('ru-RU')}${currency}${unit}`
}

function secondaryPrice(item: IListing): string {
  if (item.rentalPeriod === 'HOUR') {
    return `${Math.round(item.rentalPrice * 24).toLocaleString('ru-RU')}₽/сутки`
  }
  if (item.rentalPeriod === 'DAY') {
    return `${Math.max(1, Math.round(item.rentalPrice / 24)).toLocaleString('ru-RU')}₽/час`
  }
  return ''
}

function periodLabel(period: RentalPeriod): string {
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

function extractCity(description: string): string {
  const match = description.match(/г\.\s*[^,]+,?[^,]*/i)
  return match?.[0]?.trim() ?? 'г. Москва'
}

function extractCityName(description: string): string | null {
  const match = description.match(/г\.\s*([^,]+)/i)
  return match?.[1]?.trim() ?? null
}

function matchIcon(name: string): SectionIconKey {
  const needle = name.toLowerCase()
  if (needle.includes('ремонт')) return 'repair'
  if (needle.includes('семь') || needle.includes('дет')) return 'family'
  if (needle.includes('авто') || needle.includes('транспорт')) return 'auto'
  if (needle.includes('дом') || needle.includes('интерьер')) return 'home'
  if (needle.includes('пит')) return 'pets'
  if (needle.includes('техн') || needle.includes('электрон')) return 'tech'
  if (needle.includes('хобб') || needle.includes('спорт')) return 'hobby'
  return 'default'
}

/* ---------- icons ---------- */

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  )
}

function SectionIcon({ kind }: { kind: SectionIconKey }) {
  switch (kind) {
    case 'repair':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M14.7 6.3a3.5 3.5 0 0 1 4.9 4.9L14 17.8l-4.9-4.9 5.6-6.6z" />
          <path d="M4 20l5-5" />
        </svg>
      )
    case 'family':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
          <path d="M14 20c.3-2 2-3 4-3s3.5 1 4 3" />
        </svg>
      )
    case 'auto':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M5 15v-3l2-5h10l2 5v3" />
          <path d="M3 15h18" />
          <circle cx="7.5" cy="17" r="1.5" />
          <circle cx="16.5" cy="17" r="1.5" />
        </svg>
      )
    case 'home':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M4 11l8-7 8 7" />
          <path d="M6 10v9h12v-9" />
          <path d="M10 19v-4h4v4" />
        </svg>
      )
    case 'pets':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="6" cy="10" r="1.8" />
          <circle cx="18" cy="10" r="1.8" />
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <path d="M8 16c0-2 2-3 4-3s4 1 4 3-2 4-4 4-4-2-4-4z" />
        </svg>
      )
    case 'tech':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="5" width="18" height="12" rx="1.5" />
          <path d="M2 20h20" />
        </svg>
      )
    case 'hobby':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="5" y="5" width="14" height="14" rx="3" />
        </svg>
      )
  }
}
