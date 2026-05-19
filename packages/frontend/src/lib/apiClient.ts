import { clearSession, loadSession, saveSession } from "../auth/authStorage";
import type { AuthSuccessResponse } from "../auth/types";

export class ApiError extends Error {
  readonly status: number;
  /** Present on some errors (e.g. 402 payment hold) when backend returns `bookingId` in JSON body. */
  readonly bookingId?: string;
  /** Field-level validation or business-rule messages from the API (`fields` object in JSON). */
  readonly fields?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    options?: { bookingId?: string; fields?: Record<string, string> },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.bookingId = options?.bookingId;
    this.fields = options?.fields;
  }
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured && configured.length > 0) {
    return configured;
  }
  // In production we prefer same-origin API behind the reverse proxy (/api -> backend:3000).
  return import.meta.env.DEV ? "http://localhost:3000" : "/api";
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

function extractFields(body: unknown): Record<string, string> | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const raw = (body as { fields?: unknown }).fields;
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string" && val.length > 0) {
      out[key] = val;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const msg = (body as { message: unknown }).message;
    if (typeof msg === "string") {
      return msg;
    }
    if (Array.isArray(msg)) {
      return msg.filter(Boolean).join(", ");
    }
  }
  return fallback;
}

function getBookingIdFromBody(body: unknown): string | undefined {
  if (body && typeof body === "object" && "bookingId" in body) {
    const id = (body as { bookingId: unknown }).bookingId;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }
  return undefined;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit & {
    accessToken?: string | null;
    skipAuthRefresh?: boolean;
  },
): Promise<T> {
  const res = await performRequest(path, init);

  if (
    res.status === 401 &&
    init?.accessToken &&
    !init.skipAuthRefresh &&
    path !== "/auth/refresh"
  ) {
    const refreshed = await refreshStoredSession();
    if (refreshed) {
      return apiRequest<T>(path, {
        ...init,
        accessToken: refreshed.accessToken,
        skipAuthRefresh: true,
      });
    }
  }

  if (!res.ok) {
    const body = await parseJson<unknown>(res).catch(() => null);
    const message = getErrorMessage(body, res.statusText);
    const fields = extractFields(body);
    throw new ApiError(res.status, message, {
      bookingId: getBookingIdFromBody(body),
      fields,
    });
  }

  return parseJson<T>(res);
}

async function performRequest(
  path: string,
  init?: RequestInit & { accessToken?: string | null },
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const isFormDataBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!headers.has("Content-Type") && init?.body && !isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }
  if (init?.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });
}

let refreshInFlight: Promise<AuthSuccessResponse | null> | null = null;

async function refreshStoredSession(): Promise<AuthSuccessResponse | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const session = loadSession();
    if (!session?.refreshToken) {
      return null;
    }

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });

      if (!res.ok) {
        clearSession();
        return null;
      }

      const payload = await parseJson<AuthSuccessResponse>(res);
      saveSession(payload);
      return payload;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
