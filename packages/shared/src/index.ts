export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';

export type UserStatus =
  | 'PENDING_EMAIL_CONFIRMATION'
  | 'PENDING_TELEGRAM_LINK'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BANNED'
  | 'DELETED';

/** MVP: publish sets ACTIVE; `PENDING_MODERATION` is reserved for a future moderation queue. */
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_MODERATION'
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'BLOCKED';

export type RentalPeriod = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH';

export interface ITrustScore {
  currentScore: number;
  totalDeals: number;
  successfulDeals: number;
  lateReturns: number;
  disputes: number;
  calculatedAt: string;
}

export interface IUserSummary {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
}

export interface IUser extends IUserSummary {
  email: string | null;
  phone: string | null;
  trustScore?: ITrustScore;
}

export interface ICategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
  isActive: boolean;
}

export interface IListingPhoto {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  order: number;
  isPrimary: boolean;
  uploadedAt: string;
}

export interface IListing {
  id: string;
  ownerId: string;
  categoryId: string;
  category: ICategory;
  title: string;
  description: string;
  rentalPrice: number;
  rentalPeriod: RentalPeriod;
  depositAmount: number;
  status: ListingStatus;
  addressText: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: IListingPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface IListingCreateMetadata {
  categories: ICategory[];
  priceRules: {
    currency: string;
    supportedPeriods: RentalPeriod[];
    minPrice: number;
    minDeposit: number;
  };
  limits: {
    maxPhotos: number;
  };
}

export interface IListingCreateResponse extends IListing {
  nextStep: 'upload_photos';
  message: string;
}

export const API_URL = 'http://localhost:3000';