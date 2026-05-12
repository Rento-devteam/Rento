export type ModerationPhase = 'draft' | 'publish';

/** Final decision after rules + optional LLM fusion. */
export type ModerationDecisionStatus = 'allow' | 'warn' | 'block';

export type ModerationFlags = {
  profanity: boolean;
  gibberish: boolean;
  spamLike: boolean;
};

export type RuleEngineResult = {
  severity: 'none' | 'warn' | 'hard_block';
  reasons: string[];
  flags: ModerationFlags;
};

/** Parsed and validated LLM output (Ollama JSON mode). */
export type LlmModerationVerdict = {
  status: ModerationDecisionStatus;
  confidence: number;
  reasons: string[];
  flags: ModerationFlags;
};

export type FinalModerationDecision = {
  status: ModerationDecisionStatus;
  reasons: string[];
  confidence: number;
  flags: ModerationFlags;
  usedLlm: boolean;
  usedRules: boolean;
};
