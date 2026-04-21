const DEFAULT_TELEGRAM_BOT_URL = 'https://t.me/rento_bot'

/**
 * Клиентский сервис аутентификации:
 * - хранит общие клиентские константы auth-флоу;
 * - выдаёт deep link для Telegram-входа/регистрации.
 */
export const authService = {
  getTelegramBotUrl(): string {
    return import.meta.env.VITE_TELEGRAM_BOT_DEEPLINK ?? DEFAULT_TELEGRAM_BOT_URL
  },
}
