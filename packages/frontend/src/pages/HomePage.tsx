import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/apiClient'
import { searchCatalog } from '../catalog/catalogApi'
import type { ICategory, IListing } from '@rento/shared'
import { useAuth } from '../auth/AuthContext'
import { authApi } from '../auth/authApi'
import { isStrongPassword, PASSWORD_HINT } from '../auth/passwordPolicy'
import { AppIconSlot } from '../components/AppIconSlot'
import { IconTelegram } from '../components/oauthIcons'

type SortValue = 'relevance' | 'newest' | 'price_asc' | 'price_desc'
type AuthMode = 'login' | 'register'
type RegisterStep = 'form' | 'telegram'

interface HomePageProps {
  initialAuthMode?: AuthMode
}

export function HomePage({ initialAuthMode }: HomePageProps) {
  const navigate = useNavigate()
  const { login, register } = useAuth()

  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState<SortValue>('relevance')
  const [filterOpen, setFilterOpen] = useState(false)
  const [items, setItems] = useState<IListing[]>([])
  const [categories, setCategories] = useState<ICategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(initialAuthMode != null)
  const [authMode, setAuthMode] = useState<AuthMode>(initialAuthMode ?? 'register')
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null)
  const [registerPending, setRegisterPending] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendFeedback, setResendFeedback] = useState<string | null>(null)
  const [resendPending, setResendPending] = useState(false)

  async function loadCatalog() {
    setLoading(true)
    setError(null)
    try {
      const response = await searchCatalog({
        q,
        city,
        categoryId: categoryId || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sort,
        page: 1,
        limit: 24,
      })
      setItems(response.results)

      const categoryMap = new Map<string, ICategory>()
      for (const cat of response.popularCategories) {
        categoryMap.set(cat.id, cat)
      }
      for (const listing of response.results) {
        categoryMap.set(listing.category.id, listing.category)
      }
      setCategories([...categoryMap.values()])
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Не удалось загрузить карточки. Попробуйте ещё раз.'
      setError(message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (initialAuthMode) {
      setShowAuthModal(true)
      setAuthMode(initialAuthMode)
    }
  }, [initialAuthMode])

  const empty = useMemo(() => !loading && !error && items.length === 0, [loading, error, items])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void loadCatalog()
  }

  const chipCategories = useMemo(() => {
    return categories.slice(0, 6)
  }, [categories])

  async function onLoginSubmit(event: FormEvent) {
    event.preventDefault()
    setLoginError(null)
    setLoginPending(true)
    try {
      await login(loginEmail, loginPassword)
      closeAuthModal()
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Не удалось выполнить вход')
    } finally {
      setLoginPending(false)
    }
  }

  async function onRegisterSubmit(event: FormEvent) {
    event.preventDefault()
    setRegisterError(null)
    setRegisterSuccess(null)

    if (password !== confirmPassword) {
      setRegisterError('Пароли не совпадают')
      return
    }
    if (!isStrongPassword(password)) {
      setRegisterError(PASSWORD_HINT)
      return
    }

    setRegisterPending(true)
    try {
      await register(
        email,
        password,
        confirmPassword,
        fullName.trim() ? fullName.trim() : undefined,
      )
      setRegisterSuccess('Аккаунт создан. Подтвердите email по ссылке из письма.')
      setResendEmail(email)
    } catch (err) {
      setRegisterError(
        err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться',
      )
    } finally {
      setRegisterPending(false)
    }
  }

  async function onResendSubmit(event: FormEvent) {
    event.preventDefault()
    setResendPending(true)
    setResendFeedback(null)
    try {
      const res = await authApi.resendConfirmation(resendEmail)
      setResendFeedback(res.message)
    } catch (err) {
      setResendFeedback(err instanceof ApiError ? err.message : 'Не удалось отправить письмо')
    } finally {
      setResendPending(false)
    }
  }

  function closeAuthModal() {
    setShowAuthModal(false)
    if (initialAuthMode) {
      navigate('/', { replace: true })
    }
  }

  function openLogin() {
    setAuthMode('login')
    setShowAuthModal(true)
    setLoginError(null)
    navigate('/login', { replace: true })
  }

  function openRegister() {
    setAuthMode('register')
    setShowAuthModal(true)
    setRegisterStep('form')
    navigate('/register', { replace: true })
  }

  return (
    <main className="catalog-page">
      <form className="catalog-toolbar" onSubmit={onSubmit}>
        <div className="catalog-toolbar__search-wrap">
          <input
            className="catalog-toolbar__search"
            type="text"
            placeholder="поиск в вашем городе"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <button type="submit" className="catalog-toolbar__submit">
            Найти
          </button>
        </div>
        <div className="catalog-toolbar__actions">
          <button
            type="button"
            className="catalog-toolbar__filter-toggle"
            onClick={() => setFilterOpen((state) => !state)}
          >
            фильтрация
          </button>
          <button type="button" className="catalog-toolbar__geo-btn" disabled>
            📍
          </button>
        </div>
      </form>

      <section className="catalog-categories" aria-label="Категории">
        {chipCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`catalog-category-chip${
              category.id === categoryId ? ' catalog-category-chip--active' : ''
            }`}
            onClick={() => {
              setCategoryId((current) => (current === category.id ? '' : category.id))
              void setTimeout(() => {
                void loadCatalog()
              }, 0)
            }}
          >
            <span>{category.name}</span>
            <span className="catalog-category-chip__icon" aria-hidden />
          </button>
        ))}
      </section>

      {filterOpen ? (
        <section className="catalog-filters" aria-label="Фильтры">
          <label className="catalog-filters__field">
            <span>Город</span>
            <input
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Москва"
            />
          </label>
          <label className="catalog-filters__field">
            <span>Категория</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Все</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="catalog-filters__field">
            <span>Цена от</span>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="0"
            />
          </label>
          <label className="catalog-filters__field">
            <span>Цена до</span>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="10000"
            />
          </label>
          <label className="catalog-filters__field">
            <span>Сортировка</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortValue)}>
              <option value="relevance">По релевантности</option>
              <option value="newest">Сначала новые</option>
              <option value="price_asc">Цена: по возрастанию</option>
              <option value="price_desc">Цена: по убыванию</option>
            </select>
          </label>
          <button type="button" className="catalog-filters__apply" onClick={() => void loadCatalog()}>
            Применить
          </button>
        </section>
      ) : null}

      <h1 className="catalog-page__title">КАТАЛОГ</h1>
      <section className="catalog-grid" aria-live="polite">
        {loading ? <p className="catalog-grid__status">Загрузка карточек…</p> : null}
        {error ? <p className="catalog-grid__status catalog-grid__status--error">{error}</p> : null}
        {empty ? (
          <p className="catalog-grid__status">
            Ничего не найдено. Попробуйте изменить параметры фильтрации.
          </p>
        ) : null}
        {items.map((item) => (
          <article key={item.id} className="catalog-card">
            <div className="catalog-card__image-wrap">
              <img
                src={item.photos[0]?.url ?? '/Logo.svg'}
                alt={item.title}
                className="catalog-card__image"
              />
              <button type="button" className="catalog-card__favorite" disabled>
                ♡
              </button>
            </div>
            <h2 className="catalog-card__title">{item.title}</h2>
            <p className="catalog-card__description">{item.description}</p>
            <div className="catalog-card__divider" />
            <p className="catalog-card__price">{formatHourPrice(item)}₽/час</p>
            <p className="catalog-card__price">{formatDayPrice(item)}₽/сутки</p>
            <p className="catalog-card__city">{extractCity(item.description)}</p>
            <button type="button" className="catalog-card__map-btn" disabled>
              Показать на карте
            </button>
          </article>
        ))}
      </section>

      {showAuthModal ? (
        <section className="register-overlay" aria-label="Авторизация">
          <div className="register-overlay__modal">
            <button type="button" className="register-overlay__close" onClick={closeAuthModal}>
              ×
            </button>
            {authMode === 'login' ? (
              <>
                <h2 className="register-overlay__title">Вход</h2>
                {loginError ? (
                  <p className="auth-figma-alert auth-figma-alert--err">{loginError}</p>
                ) : null}
                <form className="auth-figma-fields" onSubmit={onLoginSubmit}>
                  <label className="auth-figma-field">
                    <span>Email</span>
                    <input
                      className="auth-figma-input"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                    />
                  </label>
                  <label className="auth-figma-field">
                    <span>Пароль</span>
                    <input
                      className="auth-figma-input"
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                    />
                  </label>
                  <div className="auth-figma-stack">
                    <button type="submit" className="auth-figma-btn-primary" disabled={loginPending}>
                      {loginPending ? 'Вход...' : 'Войти'}
                    </button>
                  </div>
                </form>
                <button type="button" className="auth-figma-link-btn" onClick={openRegister}>
                  Нет аккаунта? Зарегистрироваться
                </button>
              </>
            ) : registerStep === 'telegram' ? (
              <>
                <AppIconSlot />
                <h2 className="register-overlay__title">Продолжить с помощью</h2>
                <a
                  className="auth-figma-oauth-row"
                  href={import.meta.env.VITE_TELEGRAM_BOT_DEEPLINK ?? 'https://t.me/rento_bot'}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="auth-figma-oauth-icon">
                    <IconTelegram />
                  </span>
                  Зарегистрироваться через Telegram
                </a>
                <button
                  type="button"
                  className="auth-figma-btn-lime"
                  onClick={() => setRegisterStep('form')}
                >
                  Назад
                </button>
              </>
            ) : (
              <>
                <h2 className="register-overlay__title">Регистрация</h2>
                {registerError ? (
                  <p className="auth-figma-alert auth-figma-alert--err">{registerError}</p>
                ) : null}
                {registerSuccess ? (
                  <p className="auth-figma-alert auth-figma-alert--ok">{registerSuccess}</p>
                ) : null}
                {!registerSuccess ? (
                  <form className="auth-figma-fields" onSubmit={onRegisterSubmit}>
                    <label className="auth-figma-field">
                      <span>Имя пользователя</span>
                      <input
                        className="auth-figma-input"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                      />
                    </label>
                    <label className="auth-figma-field">
                      <span>Email</span>
                      <input
                        className="auth-figma-input"
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </label>
                    <label className="auth-figma-field">
                      <span>Пароль</span>
                      <input
                        className="auth-figma-input"
                        type="password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </label>
                    <label className="auth-figma-field">
                      <span>Подтвердите пароль</span>
                      <input
                        className="auth-figma-input"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                    </label>
                    <div className="auth-figma-stack">
                      <button
                        type="submit"
                        className="auth-figma-btn-primary"
                        disabled={registerPending}
                      >
                        {registerPending ? 'Отправка...' : 'Зарегистрироваться'}
                      </button>
                      <button
                        type="button"
                        className="auth-figma-btn-lime"
                        onClick={() => setRegisterStep('telegram')}
                      >
                        Войти другим способом
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="auth-figma-fields" onSubmit={onResendSubmit}>
                    <label className="auth-figma-field">
                      <span>Email</span>
                      <input
                        className="auth-figma-input"
                        type="email"
                        required
                        value={resendEmail}
                        onChange={(event) => setResendEmail(event.target.value)}
                      />
                    </label>
                    {resendFeedback ? (
                      <p className="auth-figma-alert auth-figma-alert--ok">{resendFeedback}</p>
                    ) : null}
                    <button
                      type="submit"
                      className="auth-figma-btn-primary"
                      disabled={resendPending}
                    >
                      {resendPending ? 'Отправка...' : 'Отправить снова'}
                    </button>
                  </form>
                )}
                <button type="button" className="auth-figma-link-btn" onClick={openLogin}>
                  У меня уже есть аккаунт
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </main>
  )
}

function formatHourPrice(item: IListing): number {
  if (item.rentalPeriod === 'HOUR') return Math.round(item.rentalPrice)
  if (item.rentalPeriod === 'DAY') return Math.max(1, Math.round(item.rentalPrice / 24))
  return Math.max(1, Math.round(item.rentalPrice))
}

function formatDayPrice(item: IListing): number {
  if (item.rentalPeriod === 'DAY') return Math.round(item.rentalPrice)
  if (item.rentalPeriod === 'HOUR') return Math.round(item.rentalPrice * 24)
  return Math.round(item.rentalPrice)
}

function extractCity(description: string): string {
  const cityMatch = description.match(/г\.\s*[^,]+,[^,]+/i)
  if (cityMatch?.[0]) {
    return cityMatch[0]
  }
  return 'г. Москва, адрес уточняйте'
}
