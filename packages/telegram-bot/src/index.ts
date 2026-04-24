import 'dotenv/config';
import express from 'express';
import { Markup, Telegraf } from 'telegraf';
import { config } from './config';
import { BackendError, confirmTelegramLogin } from './backendClient';

function withCode(redirectUrl: string, code: string): string {
  const u = new URL(redirectUrl);
  u.searchParams.set('code', code);
  return u.toString();
}

async function main() {
  const bot = new Telegraf(config.botToken);

  bot.start(async (ctx) => {
    const state = (ctx.startPayload ?? '').trim();
    if (!state) {
      await ctx.reply(
        'Чтобы войти, откройте эту ссылку из браузера (кнопка “Войти через Telegram”).',
      );
      return;
    }

    const telegramId = String(ctx.from?.id ?? '').trim();
    if (!telegramId) {
      await ctx.reply('Не удалось получить Telegram ID. Попробуйте ещё раз.');
      return;
    }

    try {
      const confirmed = await confirmTelegramLogin({
        backendBaseUrl: config.backendBaseUrl,
        botSecret: config.botSecret,
        state,
        telegramId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
      });

      const returnUrl = withCode(confirmed.redirectUrl, confirmed.exchangeCode);
      await ctx.reply(
        'Готово. Нажмите кнопку, чтобы вернуться в приложение.',
        Markup.inlineKeyboard([
          Markup.button.url('Вернуться в приложение', returnUrl),
        ]),
      );
    } catch (e) {
      const message =
        e instanceof BackendError
          ? e.message
          : 'Не удалось подтвердить вход. Попробуйте ещё раз.';
      await ctx.reply(message);
    }
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Для входа откройте бота по ссылке из приложения. Если ссылка истекла — начните вход заново в браузере.',
    );
  });

  if (config.usePolling) {
    await bot.launch({ dropPendingUpdates: true });
    console.log('[telegram-bot] Started in polling mode');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    return;
  }

  const app = express();
  app.get('/healthz', (_req, res) => res.status(200).send('ok'));
  app.use(config.webhookPath, bot.webhookCallback(config.webhookPath));

  app.listen(config.port, async () => {
    console.log(
      `[telegram-bot] Listening on :${config.port}${config.webhookPath}`,
    );

    if (config.setWebhookOnStartup) {
      if (!config.publicBotBaseUrl) {
        throw new Error(
          'SET_WEBHOOK_ON_STARTUP=true requires PUBLIC_BOT_BASE_URL',
        );
      }
      const webhookUrl = `${config.publicBotBaseUrl}${config.webhookPath}`;
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`[telegram-bot] Webhook set: ${webhookUrl}`);
    } else {
      console.log(
        '[telegram-bot] Webhook not set on startup (SET_WEBHOOK_ON_STARTUP=false)',
      );
    }
  });
}

void main();

