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
  const pendingLogin = new Map<
    string,
    { state: string; username?: string; firstName?: string }
  >();

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

    pendingLogin.set(telegramId, {
      state,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
    });

    await ctx.reply(
      'Чтобы заполнить профиль, отправьте номер телефона (можно пропустить).',
      Markup.keyboard([
        [Markup.button.contactRequest('Отправить номер телефона')],
        ['Пропустить'],
      ])
        .oneTime()
        .resize(),
    );
  });

  bot.hears('Пропустить', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '').trim();
    const pending = telegramId ? pendingLogin.get(telegramId) : undefined;
    if (!telegramId || !pending) {
      await ctx.reply(
        'Не вижу активной попытки входа. Вернитесь в приложение и начните вход заново.',
        Markup.removeKeyboard(),
      );
      return;
    }

    pendingLogin.delete(telegramId);

    try {
      const confirmed = await confirmTelegramLogin({
        backendBaseUrl: config.backendBaseUrl,
        botSecret: config.botSecret,
        state: pending.state,
        telegramId,
        username: pending.username,
        firstName: pending.firstName,
      });

      const returnUrl = withCode(confirmed.redirectUrl, confirmed.exchangeCode);
      await ctx.reply(
        'Готово. Нажмите кнопку, чтобы вернуться в приложение.',
        Markup.removeKeyboard(),
      );
      await ctx.reply(
        'Возврат в приложение:',
        Markup.inlineKeyboard([
          Markup.button.url('Вернуться в приложение', returnUrl),
        ]),
      );
    } catch (e) {
      const message =
        e instanceof BackendError
          ? e.message
          : 'Не удалось подтвердить вход. Попробуйте ещё раз.';
      await ctx.reply(message, Markup.removeKeyboard());
    }
  });

  bot.on('contact', async (ctx) => {
    const telegramId = String(ctx.from?.id ?? '').trim();
    const pending = telegramId ? pendingLogin.get(telegramId) : undefined;
    const contact = 'contact' in ctx.message ? ctx.message.contact : undefined;

    if (!telegramId || !pending) {
      await ctx.reply(
        'Не вижу активной попытки входа. Вернитесь в приложение и начните вход заново.',
        Markup.removeKeyboard(),
      );
      return;
    }

    if (!contact?.phone_number) {
      await ctx.reply('Не удалось прочитать номер телефона. Попробуйте ещё раз.');
      return;
    }

    // Basic sanity: contact should belong to the same Telegram user.
    if (contact.user_id && String(contact.user_id) !== telegramId) {
      await ctx.reply('Пожалуйста, отправьте номер телефона именно своего аккаунта.');
      return;
    }

    pendingLogin.delete(telegramId);

    try {
      const confirmed = await confirmTelegramLogin({
        backendBaseUrl: config.backendBaseUrl,
        botSecret: config.botSecret,
        state: pending.state,
        telegramId,
        phone: contact.phone_number,
        username: pending.username,
        firstName: pending.firstName,
      });

      const returnUrl = withCode(confirmed.redirectUrl, confirmed.exchangeCode);
      await ctx.reply('Спасибо, телефон сохранён.', Markup.removeKeyboard());
      await ctx.reply(
        'Возврат в приложение:',
        Markup.inlineKeyboard([
          Markup.button.url('Вернуться в приложение', returnUrl),
        ]),
      );
    } catch (e) {
      const message =
        e instanceof BackendError
          ? e.message
          : 'Не удалось подтвердить вход. Попробуйте ещё раз.';
      await ctx.reply(message, Markup.removeKeyboard());
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
  app.use(bot.webhookCallback(config.webhookPath));

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
      try {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`[telegram-bot] Webhook set: ${webhookUrl}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[telegram-bot] Failed to set webhook (${webhookUrl}): ${msg}`,
        );
        console.error(
          '[telegram-bot] Continuing without webhook. You can retry by restarting the service, or set USE_POLLING=true as a fallback.',
        );
      }
    } else {
      console.log(
        '[telegram-bot] Webhook not set on startup (SET_WEBHOOK_ON_STARTUP=false)',
      );
    }
  });
}

void main();

