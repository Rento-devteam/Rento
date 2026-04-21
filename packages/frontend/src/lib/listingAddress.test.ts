import { describe, expect, it } from 'vitest'
import { splitListingAddress } from './listingAddress'

describe('splitListingAddress', () => {
  it('отделяет хвост с «г.» после текста с точкой', () => {
    const d = 'Городской электросамокат. г. Москва, ул. Тверская, 7'
    expect(splitListingAddress(d)).toEqual({
      address: 'г. Москва, ул. Тверская, 7',
      body: 'Городской электросамокат',
    })
  })

  it('отделяет первую строку, если она начинается с «г.»', () => {
    const d = 'г. Казань, ул. Баумана, 12\n\nЭкшн-камера 4K.'
    expect(splitListingAddress(d)).toEqual({
      address: 'г. Казань, ул. Баумана, 12',
      body: 'Экшн-камера 4K.',
    })
  })

  it('возвращает только описание, если адреса нет', () => {
    const d = 'Аккумуляторный шуруповерт в отличном состоянии.'
    expect(splitListingAddress(d)).toEqual({
      address: null,
      body: 'Аккумуляторный шуруповерт в отличном состоянии.',
    })
  })
})
