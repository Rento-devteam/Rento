import { describe, expect, it } from 'vitest'
import { getListingDisplayParts, parseListingMetaFields } from './listingDescriptionParts'

describe('parseListingMetaFields', () => {
  it('выделяет бренд, год, состояние и оставляет описание', () => {
    const t = 'Бренд: Рестория. Год: 2026. Состояние: excellent. Хуевой тесто'
    expect(parseListingMetaFields(t)).toEqual({
      brand: 'Рестория',
      year: '2026',
      condition: 'excellent',
      remainder: 'Хуевой тесто',
    })
  })

  it('без служебных полей возвращает весь текст', () => {
    const t = 'Просто описание без меток.'
    expect(parseListingMetaFields(t)).toEqual({
      brand: null,
      year: null,
      condition: null,
      remainder: 'Просто описание без меток.',
    })
  })
})

describe('getListingDisplayParts', () => {
  it('совмещает адрес и мета-поля', () => {
    const raw = 'г. Москва, ул. Тверская, 1\n\nБренд: X. Год: 2025. Состояние: new. Текст описания'
    expect(getListingDisplayParts(raw)).toMatchObject({
      address: 'г. Москва, ул. Тверская, 1',
      brand: 'X',
      year: '2025',
      condition: 'new',
      description: 'Текст описания',
    })
  })
})
