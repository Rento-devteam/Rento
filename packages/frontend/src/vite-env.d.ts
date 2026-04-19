/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string | undefined
  readonly VITE_TELEGRAM_BOT_DEEPLINK: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
