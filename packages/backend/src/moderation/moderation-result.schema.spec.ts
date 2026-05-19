import {
  extractModerationJsonPayload,
  parseLlmModerationJson,
} from './moderation-result.schema';

describe('parseLlmModerationJson', () => {
  it('parses valid payload', () => {
    const raw = JSON.stringify({
      status: 'allow',
      confidence: 0.92,
      reasons: ['ok'],
      flags: { profanity: false, gibberish: false, spamLike: false },
    });
    const v = parseLlmModerationJson(raw);
    expect(v?.status).toBe('allow');
    expect(v?.confidence).toBe(0.92);
  });

  it('returns null on invalid JSON', () => {
    expect(parseLlmModerationJson('not json')).toBeNull();
  });

  it('returns null when required fields missing', () => {
    expect(
      parseLlmModerationJson(JSON.stringify({ status: 'allow' })),
    ).toBeNull();
  });

  it('parses JSON inside markdown fences', () => {
    const raw = `\`\`\`json
${JSON.stringify({
  status: 'allow',
  confidence: 0.9,
  reasons: [],
  flags: { profanity: false, gibberish: false, spamLike: false },
})}
\`\`\``;
    expect(parseLlmModerationJson(raw)?.status).toBe('allow');
  });

  it('parses JSON with leading prose', () => {
    const inner = JSON.stringify({
      status: 'WARN',
      confidence: '0.55',
      reasons: ['unclear'],
      flags: { profanity: false, gibberish: true, spamLike: false },
    });
    expect(
      parseLlmModerationJson(`Here is the result:\n${inner}`)?.status,
    ).toBe('warn');
  });

  it('extractModerationJsonPayload picks object block', () => {
    expect(extractModerationJsonPayload('x {"a":1} y')).toBe('{"a":1}');
  });

  it('parses flags when spamLike is omitted (small models)', () => {
    const raw = JSON.stringify({
      status: 'block',
      confidence: 0.85,
      reasons: ['profanity', 'gibberish'],
      flags: { profanity: true, gibberish: true },
    });
    const v = parseLlmModerationJson(raw);
    expect(v?.flags).toEqual({
      profanity: true,
      gibberish: true,
      spamLike: false,
    });
  });
});
