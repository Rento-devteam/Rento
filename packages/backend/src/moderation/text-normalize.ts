/**
 * Normalize listing text for moderation checks (not for display).
 */
export function normalizeListingText(input: string): string {
  let s = input.normalize('NFKC');
  // zero-width and similar
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  // collapse repeated same char (e.g. "ааааа")
  s = s.replace(/(.)\1{4,}/g, '$1$1');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function collapseForTokenScan(input: string): string {
  return normalizeListingText(input).toLowerCase();
}
