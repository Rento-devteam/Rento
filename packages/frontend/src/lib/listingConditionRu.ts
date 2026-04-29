const CONDITION_VALUE_RU: Record<string, string> = {
  new: 'Новое',
  excellent: 'Отличное',
  good: 'Хорошее',
  fair: 'Удовлетворительное',
}

/** Значения из формы создания объявления (value select) → подпись как в списке. */
export function listingConditionLabelRu(raw: string | null | undefined): string | null {
  if (raw == null || !raw.trim()) return null
  const key = raw.trim().toLowerCase()
  return CONDITION_VALUE_RU[key] ?? raw.trim()
}
