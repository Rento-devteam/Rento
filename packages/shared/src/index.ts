export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';

export type UserStatus =
  | 'PENDING_EMAIL_CONFIRMATION'
  | 'PENDING_TELEGRAM_LINK'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BANNED'
  | 'DELETED';

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

export const API_URL = 'http://localhost:3000';