import {
  ListingStatus,
  ListingTextModerationStatus,
  RentalPeriod,
} from '@prisma/client';

type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
  isActive: boolean;
};

type ListingPhotoRecord = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  order: number;
  isPrimary: boolean;
  uploadedAt: Date;
};

type ListingRecord = {
  id: string;
  ownerId: string;
  categoryId: string;
  title: string;
  description: string;
  rentalPrice: number;
  rentalPeriod: RentalPeriod;
  depositAmount: number;
  status: ListingStatus;
  latitude: number | null;
  longitude: number | null;
  moderationStatus: ListingTextModerationStatus;
  moderationReasons: unknown;
  moderationVersion: number;
  moderationConfidence: number | null;
  createdAt: Date;
  updatedAt: Date;
  category: CategoryRecord;
  photos: ListingPhotoRecord[];
};

export function mapCategory(category: CategoryRecord) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    order: category.order,
    isActive: category.isActive,
  };
}

function mapModerationReasons(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((x): x is string => typeof x === 'string');
}

export function mapListingDetail(listing: ListingRecord) {
  return {
    id: listing.id,
    ownerId: listing.ownerId,
    categoryId: listing.categoryId,
    category: mapCategory(listing.category),
    title: listing.title,
    description: listing.description,
    rentalPrice: listing.rentalPrice,
    rentalPeriod: listing.rentalPeriod,
    depositAmount: listing.depositAmount,
    status: listing.status,
    latitude: listing.latitude,
    longitude: listing.longitude,
    moderationStatus: listing.moderationStatus,
    moderationReasons: mapModerationReasons(listing.moderationReasons),
    moderationVersion: listing.moderationVersion,
    moderationConfidence: listing.moderationConfidence,
    photos: listing.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl,
      order: photo.order,
      isPrimary: photo.isPrimary,
      uploadedAt: photo.uploadedAt.toISOString(),
    })),
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export function mapListingPhoto(photo: ListingPhotoRecord) {
  return {
    id: photo.id,
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    order: photo.order,
    isPrimary: photo.isPrimary,
    uploadedAt: photo.uploadedAt.toISOString(),
  };
}

export function mapListingPhotosResponse(photos: ListingPhotoRecord[]) {
  return {
    items: photos.map(mapListingPhoto),
  };
}

export function mapListingCreatedResponse(listing: ListingRecord) {
  return {
    ...mapListingDetail(listing),
    nextStep: 'upload_photos' as const,
    message: 'Draft created. Upload at least one photo to continue.',
  };
}

export function mapListingPhotoUploadResponse(
  photo: ListingPhotoRecord,
  totalPhotos: number,
) {
  return {
    photo: mapListingPhoto(photo),
    totalPhotos,
    nextStep: 'publish_listing' as const,
    message: 'Photo uploaded. Publish the listing when ready.',
  };
}

export function mapListingPublishResponse(
  listing: Pick<
    ListingRecord,
    | 'id'
    | 'status'
    | 'moderationStatus'
    | 'moderationReasons'
    | 'moderationVersion'
    | 'moderationConfidence'
  >,
) {
  return {
    id: listing.id,
    status: listing.status,
    moderationStatus: listing.moderationStatus,
    moderationReasons: mapModerationReasons(listing.moderationReasons),
    moderationVersion: listing.moderationVersion,
    moderationConfidence: listing.moderationConfidence,
    nextStep: null,
    message: 'Listing published successfully.',
  };
}
