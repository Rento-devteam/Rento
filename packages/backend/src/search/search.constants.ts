export const ELASTICSEARCH_CLIENT = 'ELASTICSEARCH_CLIENT';

export const DEFAULT_LISTINGS_INDEX = 'rento-listings';

export function getListingsIndexName(): string {
  return (
    process.env.ELASTICSEARCH_LISTINGS_INDEX?.trim() || DEFAULT_LISTINGS_INDEX
  );
}

/** Demo listings (Ninebot / Makita / GoPro) when the catalog has no ACTIVE items. Off by default. */
export function isDefaultCatalogSeedEnabled(): boolean {
  return (
    (process.env.CATALOG_DEFAULT_SEED_ENABLED ?? '').trim().toLowerCase() ===
    'true'
  );
}

/** Minimal RU stop words for query normalization (optional, UC-09). */
export const RU_STOP_WORDS = new Set([
  'и',
  'в',
  'во',
  'на',
  'с',
  'со',
  'к',
  'ко',
  'о',
  'об',
  'от',
  'до',
  'по',
  'для',
  'из',
  'как',
  'а',
  'но',
  'же',
  'ли',
  'бы',
  'это',
  'то',
]);
