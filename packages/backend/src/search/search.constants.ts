export const ELASTICSEARCH_CLIENT = 'ELASTICSEARCH_CLIENT';

export const DEFAULT_LISTINGS_INDEX = 'rento-listings';

export function getListingsIndexName(): string {
  return (
    process.env.ELASTICSEARCH_LISTINGS_INDEX?.trim() || DEFAULT_LISTINGS_INDEX
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
