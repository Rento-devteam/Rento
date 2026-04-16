export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';

export type UserStatus =
  | 'PENDING_EMAIL_CONFIRMATION'
  | 'PENDING_TELEGRAM_LINK'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BANNED'
  | 'DELETED';

export interface TrustScoreSnapshot {
  currentScore: number;
  totalDeals: number;
  successfulDeals: number;
  lateReturns: number;
  disputes: number;
  calculatedAt: string;
}

export interface UserProfileResponse {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  trustScore?: TrustScoreSnapshot;
}

export interface UserProfileSource {
  id: string;
  email: string | null;
  status: UserStatus;
  fullName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role?: UserRole | null;
}

export function buildDefaultTrustScore(): TrustScoreSnapshot {
  return {
    currentScore: 0,
    totalDeals: 0,
    successfulDeals: 0,
    lateReturns: 0,
    disputes: 0,
    calculatedAt: new Date().toISOString(),
  };
}

export function buildUserProfileResponse(
  user: UserProfileSource,
  trustScore?: TrustScoreSnapshot,
): UserProfileResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName ?? null,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role ?? 'USER',
    status: user.status,
    isVerified: false,
    ...(trustScore ? { trustScore } : {}),
  };
}
