import { splitListingAddress } from './listingAddress'

export interface ListingDisplayParts {
  address: string | null
  brand: string | null
  year: string | null
  condition: string | null
  /** Текст описания без адреса и без служебных полей «Бренд / Год / Состояние». */
  description: string
}

function matchMetaValue(text: string, label: string): string | null {
  // Без `\b`: для кириллицы в JS граница слова ненадёжна без флага `u`.
  const re = new RegExp(`${label}\\s*:\\s*([^.]+?)\\.(?:\\s|$)`, 'i')
  return text.match(re)?.[1]?.trim() ?? null
}

function stripMetaField(text: string, label: string): string {
  const re = new RegExp(`${label}\\s*:\\s*[^.]+\\.(?:\\s|$)`, 'gi')
  return text.replace(re, ' ')
}

/**
 * Поля «Бренд: ….», «Год: ….», «Состояние: ….» (значение до точки), остаток — описание.
 */
export function parseListingMetaFields(text: string): {
  brand: string | null
  year: string | null
  condition: string | null
  remainder: string
} {
  const t = text.trim()
  if (!t) {
    return { brand: null, year: null, condition: null, remainder: '' }
  }

  const brand = matchMetaValue(t, 'Бренд')
  const year = matchMetaValue(t, 'Год')
  const condition = matchMetaValue(t, 'Состояние')

  let remainder = stripMetaField(t, 'Бренд')
  remainder = stripMetaField(remainder, 'Год')
  remainder = stripMetaField(remainder, 'Состояние')
  remainder = remainder.replace(/\s+/g, ' ').trim()

  return { brand, year, condition, remainder }
}

export function getListingDisplayParts(rawDescription: string): ListingDisplayParts {
  const { address, body } = splitListingAddress(rawDescription)
  const { brand, year, condition, remainder } = parseListingMetaFields(body)

  const hasStructured =
    Boolean(address) || Boolean(brand) || Boolean(year) || Boolean(condition)
  const descTrim = remainder.trim()
  const description =
    descTrim.length > 0 ? descTrim : hasStructured ? '—' : body.trim()

  return {
    address,
    brand,
    year,
    condition,
    description,
  }
}
