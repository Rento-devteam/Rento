export const MAX_LISTING_PHOTOS = 10;
export const MAX_LISTING_PHOTO_BYTES = 10 * 1024 * 1024;

export const LISTING_TITLE_MIN = 3;
export const LISTING_TITLE_MAX = 180;
export const LISTING_DESCRIPTION_MIN = 10;
export const LISTING_DESCRIPTION_MAX = 8000;
export const LISTING_PRICE_MAX = 10_000_000;

export const LISTING_PHOTO_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
