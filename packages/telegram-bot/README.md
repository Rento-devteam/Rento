# Telegram Bot (Telegram login/registration)

This service handles the Telegram side of **login/registration**:

- Browser calls backend `POST /telegram/login/start` → gets `deepLink`.
- User opens the deep link in Telegram → bot receives `/start <state>`.
- Bot calls backend `POST /telegram/login/confirm` (protected by `x-bot-secret`).
- Bot sends user a button back to the app with a short-lived `code`.
- Browser exchanges the code via backend `POST /telegram/login/exchange` → receives JWTs.

## Environment

Copy `.env.example` to `.env` and set:

- `BOT_TOKEN`: BotFather token
- `PUBLIC_BOT_BASE_URL`: public base URL for webhooks, e.g. `https://bot.example.com`
- `BACKEND_BASE_URL`: backend base URL reachable from this service (in docker: `http://backend:3000`)
- `BOT_SECRET`: must match backend `BOT_SECRET`

## Run locally (webhook mode)

Webhook requires a publicly reachable URL + HTTPS. For local dev, either:

- use a tunnel (ngrok/cloudflared) and set `PUBLIC_BOT_BASE_URL`, or
- temporarily implement polling (not included here on purpose to keep prod path stable).

## Scripts

- `npm run dev`: run TypeScript directly
- `npm run build`: compile to `dist/`
- `npm start`: run compiled code

