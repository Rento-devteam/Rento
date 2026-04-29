import type { RentalPeriod } from '@rento/shared'

/** Короткая подпись к цене: « / час», « / сутки» … */
export function periodSlashUnitRu(period: RentalPeriod): string {
  switch (period) {
    case 'HOUR':
      return ' / час'
    case 'DAY':
      return ' / сутки'
    case 'WEEK':
      return ' / неделя'
    case 'MONTH':
      return ' / месяц'
  }
}

/** Одна строка цены в каталоге и карточках: «1 500 ₽ / сутки» */
export function formatListingRentalPriceRu(price: number, period: RentalPeriod): string {
  const p = Math.round(price).toLocaleString('ru-RU')
  return `${p} ₽${periodSlashUnitRu(period)}`
}

/** Подпись под ценой на странице объявления и в формах */
export const LISTING_RENTAL_PRICE_CAPTION =
  'Цена за один расчётный период (тип периода — в поле «Способ сдачи» / «Тип аренды»)'

/** Подпись к полю ввода цены при создании объявления */
export const LISTING_FORM_PRICE_LABEL = 'Цена за период'

export function listingFormPriceHintRu(period: RentalPeriod): string {
  switch (period) {
    case 'HOUR':
      return 'Введите стоимость за один час — при бронировании сумма умножается на число часов в выбранном интервале.'
    case 'DAY':
      return 'Введите стоимость за одни сутки — при бронировании сумма умножается на число суток в интервале.'
    case 'WEEK':
      return 'Введите стоимость за одну неделю — при бронировании сумма умножается на число недель в интервале.'
    case 'MONTH':
      return 'Введите стоимость за один месяц (30 суток в расчёте) — при бронировании сумма умножается на число таких периодов в интервале.'
  }
}
