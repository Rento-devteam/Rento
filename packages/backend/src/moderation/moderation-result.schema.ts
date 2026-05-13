import type { LlmModerationVerdict, ModerationFlags } from './moderation.types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') {
    return v;
  }
  return null;
}

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asStrArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) {
    return null;
  }
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') {
      return null;
    }
    out.push(x);
  }
  return out;
}

function parseFlags(v: unknown): ModerationFlags | null {
  if (!isRecord(v)) {
    return null;
  }
  const profanity = asBool(v.profanity);
  const gibberish = asBool(v.gibberish);
  const spamLike = asBool(v.spamLike);
  if (profanity === null || gibberish === null || spamLike === null) {
    return null;
  }
  return { profanity, gibberish, spamLike };
}

/**
 * Validates LLM JSON payload. Returns null if invalid.
 */
export function parseLlmModerationJson(
  raw: string,
): LlmModerationVerdict | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const status = parsed.status;
  if (status !== 'allow' && status !== 'warn' && status !== 'block') {
    return null;
  }
  const confidence = asNum(parsed.confidence);
  if (confidence === null || confidence < 0 || confidence > 1) {
    return null;
  }
  const reasons = asStrArray(parsed.reasons);
  if (!reasons) {
    return null;
  }
  const flags = parseFlags(parsed.flags);
  if (!flags) {
    return null;
  }
  return {
    status: status,
    confidence,
    reasons,
    flags,
  };
}
