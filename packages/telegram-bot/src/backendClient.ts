export class BackendError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

async function safeParseJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getBackendMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.filter(Boolean).join(', ');
  }
  if (typeof body === 'string' && body.trim()) return body;
  return fallback;
}

export interface TelegramLoginConfirmResponse {
  redirectUrl: string;
  exchangeCode: string;
  expiresAt: string;
}

export async function confirmTelegramLogin(params: {
  backendBaseUrl: string;
  botSecret: string;
  state: string;
  telegramId: string;
  phone?: string;
  username?: string;
  firstName?: string;
}): Promise<TelegramLoginConfirmResponse> {
  const res = await fetch(`${params.backendBaseUrl}/telegram/login/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': params.botSecret,
    },
    body: JSON.stringify({
      state: params.state,
      telegramId: params.telegramId,
      phone: params.phone,
      username: params.username,
      firstName: params.firstName,
    }),
  });

  if (!res.ok) {
    const body = await safeParseJson(res);
    throw new BackendError(res.status, getBackendMessage(body, res.statusText));
  }

  return (await res.json()) as TelegramLoginConfirmResponse;
}

