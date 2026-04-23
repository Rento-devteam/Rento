/**
 * Выделяет адрес из поля description, если он оформлен как в каталоге:
 * — отдельная первая строка «г. …»;
 * — хвост строки после «. г.» или после пробела перед «г.».
 */
export function splitListingAddress(description: string): {
  address: string | null
  body: string
} {
  const t = description.trim()
  if (!t) return { address: null, body: '' }

  const lines = t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length >= 2 && /^г\./i.test(lines[0])) {
    return { address: lines[0], body: lines.slice(1).join('\n\n').trim() }
  }

  if (lines.length === 1 && /^г\./i.test(lines[0])) {
    return { address: lines[0], body: '' }
  }

  const trailing = t.match(/^(.*?)[.\s]\s*(г\.\s[\s\S]+)$/i)
  if (trailing && trailing[1].trim().length > 0) {
    return { address: trailing[2].trim(), body: trailing[1].trim() }
  }

  const gMatch = t.match(/\s(г\.\s[\s\S]+)$/i)
  if (gMatch != null && gMatch.index != null && gMatch.index > 0) {
    const body = t
      .slice(0, gMatch.index)
      .trim()
      .replace(/[.,;:\s]+$/g, '')
    const addr = gMatch[1].trim()
    if (body.length > 0) {
      return { address: addr, body }
    }
  }

  return { address: null, body: t }
}
