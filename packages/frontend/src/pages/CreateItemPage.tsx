import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function CreateItemPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    brand: '',
    year: '',
    description: '',
    condition: '',
    rentalMethod: 'day', // hour, day, week
    priceHour: '',
    priceDay: '',
    deposit: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Publish item:', formData)
    navigate('/')
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const handleRadioChange = (val: string) => {
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
        <div className="create-item-grid">
          {/* Левая колонка */}
          <div className="create-item-col">
            {/* Добавить фото */}
            <div className="photo-upload">
              <div className="photo-upload__inner">
                <svg viewBox="0 0 24 24" className="photo-upload__icon">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm4.5 6H7.5c-.83 0-1.5-.67-1.5-1.5 0-2.5 5.5-3.5 6-3.5s6 1 6 3.5c0 .83-.67 1.5-1.5 1.5z" />
                </svg>
                <span>добавить фото</span>
              </div>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="item-category">Категория товара</label>
              <select
                id="item-category"
                className="field__input"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  Выберите категорию
                </option>
                <option value="electronics">Электроника</option>
                <option value="tools">Инструменты</option>
                <option value="sport">Спорт и отдых</option>
                <option value="transport">Транспорт</option>
                <option value="other">Другое</option>
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
              />
            </div>
          </div>

          {/* Правая колонка */}
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
              />
            </div>

            {/* Дополнительное поле: Залог, как требовалось в задаче */}
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
              />
            </div>
          </div>

          {/* Кнопка Опубликовать внизу, выровнена по правому краю как в дизайне */}
          <div className="create-item-footer">
            <button type="submit" className="btn btn--brand create-item-submit">
              Опубликовать
            </button>
          </div>
        </div>
      </form>
    </main>
  )
}
