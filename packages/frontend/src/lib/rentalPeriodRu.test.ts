import { describe, expect, it } from 'vitest'
import { formatListingRentalPriceRu } from './rentalPeriodRu'

describe('formatListingRentalPriceRu', () => {
  it('formats day period with grouping', () => {
    expect(formatListingRentalPriceRu(1500, 'DAY')).toMatch(/1\s*500\s*₽\s*\/\s*сутки/)
  })
})
