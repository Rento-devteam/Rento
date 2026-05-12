import { parseLlmModerationJson } from './moderation-result.schema';

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

  it('returns null when keys missing', () => {
    expect(
      parseLlmModerationJson(JSON.stringify({ status: 'allow' })),
    ).toBeNull();
  });
});
