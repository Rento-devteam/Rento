function mustGet(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  botToken: mustGet('BOT_TOKEN'),
  port: Number(process.env.PORT ?? 3010),
  webhookPath: process.env.WEBHOOK_PATH ?? '/telegram/webhook',
  publicBotBaseUrl: process.env.PUBLIC_BOT_BASE_URL?.replace(/\/+$/, '') ?? null,
  backendBaseUrl: mustGet('BACKEND_BASE_URL').replace(/\/+$/, ''),
  botSecret: mustGet('BOT_SECRET'),
  setWebhookOnStartup: String(process.env.SET_WEBHOOK_ON_STARTUP ?? 'false') === 'true',
  usePolling: String(process.env.USE_POLLING ?? 'false') === 'true',
};

