export const authConfig = {
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  telegramBotDeepLinkBase:
    process.env.TELEGRAM_BOT_DEEPLINK_BASE ?? 'https://t.me/rento_bot?start=',
};
