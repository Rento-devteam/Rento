import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import type { ICategory, IListing, RentalPeriod } from '@rento/shared'
import { useAuth } from '../auth/AuthContext'
import { autocompleteCatalog, searchCatalog } from '../catalog/catalogApi'
import { ApiError } from '../lib/apiClient'
import { formatListingRentalPriceRu } from '../lib/rentalPeriodRu'
import { getListingDisplayParts } from '../lib/listingDescriptionParts'
import { listingConditionLabelRu } from '../lib/listingConditionRu'
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

/** Подписи разделов на русском, если в каталоге пришёл slug/имя на английском. */
const CATEGORY_SECTION_TITLE_RU: Record<string, string> = {
  'default-catalog': 'Разное',
  tools: 'Инструменты',
  vehicles: 'Транспорт',
  'demo-power-tools': 'Электроинструмент',
}

function sectionTitleRu(cat: ICategory): string {
  const bySlug = CATEGORY_SECTION_TITLE_RU[cat.slug]
  if (bySlug) return bySlug
  const byName = cat.name?.trim()
  if (byName && /^[A-Za-z][A-Za-z\s&'-]+$/.test(byName)) {
    const lower = byName.toLowerCase()
    if (lower === 'tools') return 'Инструменты'
    if (lower === 'vehicles') return 'Транспорт'
    if (lower === 'miscellaneous' || lower === 'misc') return 'Разное'
  }
  return cat.name
}

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

export function HomePage() {
  const { accessToken } = useAuth()
  const [q, setQ] = useState('')
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([])
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [autocompleteOpen, setAutocompleteOpen] = useState(false)

  const [categoryId, setCategoryId] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortPreset, setSortPreset] = useState<SortPreset>('popular')
  const [rentalFilter, setRentalFilter] = useState<RentalFilter>('ALL')

  const [items, setItems] = useState<IListing[]>([])
  const [categories, setCategories] = useState<ICategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCatalog = useCallback(async (overrides?: { categoryId?: string }) => {
    const effectiveCategoryId = overrides?.categoryId ?? categoryId
    setLoading(true)
    setError(null)
    try {
      const response = await searchCatalog(
        {
          q,
          categoryId: effectiveCategoryId || undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          sort: SORT_TO_API[sortPreset],
          page: 1,
          limit: 24,
        },
        accessToken,
      )
      setItems(response.results)

      setCategories((prev) => {
        const map = new Map<string, ICategory>()
        for (const cat of prev) map.set(cat.id, cat)
        for (const cat of response.popularCategories) map.set(cat.id, cat)
        for (const listing of response.results) map.set(listing.category.id, listing.category)
        return [...map.values()]
      })
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось загрузить карточки. Попробуйте ещё раз.',
      )
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [accessToken, categoryId, maxPrice, minPrice, q, sortPreset])

  useEffect(() => {
    queueMicrotask(() => {
      void loadCatalog()
    })
    // Mount-only: фильтры и поиск применяются кнопками «Найти» / «Применить».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const query = q.trim()
    if (query.length < 1) {
      return
    }

    const timer = setTimeout(async () => {
      setAutocompleteLoading(true)
      try {
        const items = await autocompleteCatalog(query, 8)
        setAutocompleteItems(items)
        setAutocompleteOpen(true)
      } catch {
        setAutocompleteItems([])
        setAutocompleteOpen(false)
      } finally {
        setAutocompleteLoading(false)
      }
    }, 220)

    return () => clearTimeout(timer)
  }, [q])

  function handleSearchInputChange(value: string) {
    setQ(value)
    if (value.trim().length < 1) {
      setAutocompleteItems([])
      setAutocompleteOpen(false)
    }
  }

  const sections: SectionTile[] = useMemo(() => {
    if (categories.length === 0) return DEFAULT_SECTIONS
    return categories.slice(0, 6).map<SectionTile>((cat) => ({
      key: cat.id,
      categoryId: cat.id,
      title: sectionTitleRu(cat),
      iconKey: matchIcon(sectionTitleRu(cat)),
    }))
  }, [categories])

  const visibleItems = useMemo(() => {
    if (rentalFilter === 'ALL') return items
    return items.filter((item) => item.rentalPeriod === rentalFilter)
  }, [items, rentalFilter])

  function onSubmitSearch(event: FormEvent) {
    event.preventDefault()
    setAutocompleteOpen(false)
    void loadCatalog()
  }

  function applyAutocomplete(query: string) {
    setQ(query)
    setAutocompleteOpen(false)
    void loadCatalog()
  }

  function toggleCategory(nextId: string) {
    const nextCategoryId = categoryId === nextId ? '' : nextId
    setCategoryId(nextCategoryId)
    void loadCatalog({ categoryId: nextCategoryId })
  }

  return (
    <main>
      <section className="container hero" aria-label="Поиск по каталогу">
        <h1 className="hero__title">Аренда вещей без лишних сложностей</h1>
        <p className="hero__subtitle">
          Найдите то, что нужно, на час, день или месяц. Поиск по названию и фильтрация по цене — в одном окне.
        </p>

        <form className="search-bar" onSubmit={onSubmitSearch}>
          <div className="search-bar__field search-bar__field--autocomplete">
            <SearchIcon />
            <input
              className="search-bar__input"
              type="text"
              placeholder="Что ищем? Дрель, мольберт, велосипед…"
              value={q}
              onChange={(event) => handleSearchInputChange(event.target.value)}
              onFocus={() => {
                if (autocompleteItems.length > 0) setAutocompleteOpen(true)
              }}
              onBlur={() => {
                setTimeout(() => setAutocompleteOpen(false), 120)
              }}
            />
            {autocompleteOpen ? (
              <div className="search-autocomplete" role="listbox" aria-label="Подсказки поиска">
                {autocompleteLoading ? (
                  <div className="search-autocomplete__empty">Подсказки…</div>
                ) : autocompleteItems.length > 0 ? (
                  autocompleteItems.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="search-autocomplete__item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyAutocomplete(item)}
                    >
                      {item}
                    </button>
                  ))
                ) : (
                  <div className="search-autocomplete__empty">Ничего не найдено</div>
                )}
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
        <div className="catalog__shell">
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
              <div className="status catalog__grid-span">
                По запросу ничего не найдено. Попробуйте изменить параметры фильтрации.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}

function Card({ item }: { item: IListing }) {
  const cover = item.photos[0]?.url
  const cityName = extractCity(item.description)
  const period = periodLabel(item.rentalPeriod)
  const displayParts = getListingDisplayParts(item.description ?? '')
  const conditionRu = listingConditionLabelRu(displayParts.condition)
  const cardDescription = [conditionRu ? `Состояние: ${conditionRu}` : null, displayParts.description]
    .filter((part): part is string => Boolean(part && part.trim() && part.trim() !== '—'))
    .join('. ')
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
        <p className="card__desc">{cardDescription || item.description}</p>
        <div className="card__prices">
          <span className="card__price-main">{formatListingRentalPriceRu(item.rentalPrice, item.rentalPeriod)}</span>
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
