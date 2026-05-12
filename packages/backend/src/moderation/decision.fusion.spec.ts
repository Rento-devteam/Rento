import { fuseModeration } from './decision.fusion';
import type { LlmModerationVerdict, RuleEngineResult } from './moderation.types';

describe('fuseModeration', () => {
  const thresholds = {
    blockThreshold: 0.85,
    warnThreshold: 0.6,
    gibberishBlockConfidence: 0.8,
  };

  const emptyRules: RuleEngineResult = {
    severity: 'none',
    reasons: [],
    flags: { profanity: false, gibberish: false, spamLike: false },
  };

  it('blocks immediately on rules hard_block', () => {
    const rules: RuleEngineResult = {
      severity: 'hard_block',
      reasons: ['rule:profanity_pattern'],
      flags: { profanity: true, gibberish: false, spamLike: false },
    };
    const out = fuseModeration({
      phase: 'draft',
      rules,
      llm: null,
      hardBlockEnabled: true,
      thresholds,
    });
    expect(out.status).toBe('block');
    expect(out.usedLlm).toBe(false);
  });

  it('maps LLM low-confidence block to warn', () => {
    const llm: LlmModerationVerdict = {
      status: 'block',
      confidence: 0.4,
      reasons: ['llm'],
      flags: { profanity: false, gibberish: false, spamLike: false },
    };
    const out = fuseModeration({
      phase: 'draft',
      rules: emptyRules,
      llm,
      hardBlockEnabled: true,
      thresholds,
    });
    expect(out.status).toBe('warn');
  });

  it('blocks gibberish on publish when confidence is high', () => {
    const llm: LlmModerationVerdict = {
      status: 'warn',
      confidence: 0.9,
      reasons: ['gib'],
      flags: { profanity: false, gibberish: true, spamLike: false },
    };
    const out = fuseModeration({
      phase: 'publish',
      rules: emptyRules,
      llm,
      hardBlockEnabled: true,
      thresholds,
    });
    expect(out.status).toBe('block');
  });

  it('blocks publish on rules gibberish when LLM is unavailable', () => {
    const rules: RuleEngineResult = {
      severity: 'warn',
      reasons: ['rule:gibberish_heuristic(0.72)'],
      flags: { profanity: false, gibberish: true, spamLike: false },
    };
    const out = fuseModeration({
      phase: 'publish',
      rules,
      llm: null,
      hardBlockEnabled: true,
      thresholds,
    });
    expect(out.status).toBe('block');
    expect(out.usedLlm).toBe(false);
  });

  it('keeps draft warn (not block) for rules gibberish without LLM', () => {
    const rules: RuleEngineResult = {
      severity: 'warn',
      reasons: ['rule:gibberish_heuristic(0.72)'],
      flags: { profanity: false, gibberish: true, spamLike: false },
    };
    const out = fuseModeration({
      phase: 'draft',
      rules,
      llm: null,
      hardBlockEnabled: true,
      thresholds,
    });
    expect(out.status).toBe('warn');
  });

  it('blocks publish on rules gibberish even when LLM returns allow', () => {
    const rules: RuleEngineResult = {
      severity: 'warn',
      reasons: ['rule:gibberish_heuristic(0.55)'],
      flags: { profanity: false, gibberish: true, spamLike: false },
    };
    const llm: LlmModerationVerdict = {
      status: 'allow',
      confidence: 0.95,
      reasons: [],
      flags: { profanity: false, gibberish: false, spamLike: false },
    };
    const out = fuseModeration({
      phase: 'publish',
      rules,
      llm,
      hardBlockEnabled: true,
      thresholds,
    });
    expect(out.status).toBe('block');
    expect(out.usedLlm).toBe(true);
  });

  it('treats LLM allow in 0.6–0.85 confidence band as allow when rules are clean', () => {
    const llm: LlmModerationVerdict = {
      status: 'allow',
      confidence: 0.7,
      reasons: [],
      flags: { profanity: false, gibberish: false, spamLike: false },
    };
    const out = fuseModeration({
      phase: 'draft',
      rules: emptyRules,
      llm,
      hardBlockEnabled: true,
      thresholds,
    });
    expect(out.status).toBe('allow');
  });
});
