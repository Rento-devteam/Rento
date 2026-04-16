export const AuthUserStatus = {
  PENDING_EMAIL_CONFIRMATION: 'PENDING_EMAIL_CONFIRMATION',
  PENDING_TELEGRAM_LINK: 'PENDING_TELEGRAM_LINK',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
  DELETED: 'DELETED',
} as const;

export type AuthUserStatusValue =
  (typeof AuthUserStatus)[keyof typeof AuthUserStatus];
