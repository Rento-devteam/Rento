import type { LlmModerationVerdict, ModerationFlags } from './moderation.types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') {
    return v;
  }
  if (v === 'true' || v === 'false') {
    return v === 'true';
  }
  if (v === 1 || v === 0) {
    return v === 1;
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
  if (v.profanity !== undefined && profanity === null) {
    return null;
  }
  if (v.gibberish !== undefined && gibberish === null) {
    return null;
  }
  if (v.spamLike !== undefined && spamLike === null) {
    return null;
  }
  return {
    profanity: profanity ?? false,
    gibberish: gibberish ?? false,
    spamLike: spamLike ?? false,
  };
}

/** Strip markdown fences and pick the outermost `{…}` block (small models often add prose). */
export function extractModerationJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

/**
 * Validates LLM JSON payload. Returns null if invalid.
 */
export function parseLlmModerationJson(
  raw: string,
): LlmModerationVerdict | null {
  const payload = extractModerationJsonPayload(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const statusRaw = parsed.status;
  const status =
    typeof statusRaw === 'string' ? statusRaw.trim().toLowerCase() : null;
  if (status !== 'allow' && status !== 'warn' && status !== 'block') {
    return null;
  }
  const confidence = asNum(parsed.confidence);
  if (confidence === null || confidence < 0 || confidence > 1) {
    return null;
  }
  const reasons = asStrArray(parsed.reasons) ?? [];
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
