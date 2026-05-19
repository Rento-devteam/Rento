import type {
  FinalModerationDecision,
  LlmModerationVerdict,
  ModerationPhase,
  RuleEngineResult,
} from './moderation.types';

export type FusionThresholds = {
  blockThreshold: number;
  warnThreshold: number;
  gibberishBlockConfidence: number;
};

export function fuseModeration(input: {
  phase: ModerationPhase;
  rules: RuleEngineResult;
  llm: LlmModerationVerdict | null;
  hardBlockEnabled: boolean;
  thresholds: FusionThresholds;
}): FinalModerationDecision {
  const { phase, rules, llm, hardBlockEnabled, thresholds } = input;
  const usedRules = true;
  const usedLlm = llm !== null;

  const rulesInsufficient = rules.reasons.some((r) =>
    r.startsWith('rule:insufficient'),
  );
  const rulesContentPublishBlock =
    phase === 'publish' &&
    hardBlockEnabled &&
    !rules.flags.profanity &&
    (rules.flags.gibberish || rulesInsufficient);

  if (rules.severity === 'hard_block') {
    return {
      status: hardBlockEnabled ? 'block' : 'warn',
      reasons: rules.reasons.length ? rules.reasons : ['rule:profanity'],
      confidence: 1,
      flags: rules.flags,
      usedLlm,
      usedRules,
    };
  }

  if (!llm) {
    if (rules.severity === 'warn') {
      /**
       * Without LLM, rules-only `warn` used to still allow publish — listings looked “moderated”
       * but garbage text went live. Block **publish** when heuristics flagged gibberish.
       */
      if (rulesContentPublishBlock) {
        return {
          status: 'block',
          reasons: rules.reasons,
          confidence: 0.78,
          flags: rules.flags,
          usedLlm: false,
          usedRules,
        };
      }
      return {
        status: 'warn',
        reasons: rules.reasons,
        confidence: 0.65,
        flags: rules.flags,
        usedLlm: false,
        usedRules,
      };
    }
    return {
      status: 'allow',
      reasons: [],
      confidence: 0,
      flags: rules.flags,
      usedLlm: false,
      usedRules,
    };
  }

  const c = llm.confidence;
  const f = llm.flags;
  const rulesBackedProfanity = rules.flags.profanity;
  const rulesBackedGibberish = rules.flags.gibberish;

  /**
   * Small models over-block normal copy; allow only when rules did not flag content issues.
   */
  if (
    rules.severity === 'none' &&
    llm.status === 'block' &&
    !rulesBackedProfanity &&
    !rulesBackedGibberish &&
    !rules.flags.spamLike &&
    !rulesInsufficient &&
    c >= thresholds.warnThreshold
  ) {
    return {
      status: 'allow',
      reasons: [],
      confidence: c,
      flags: mergeFlags(rules.flags, {
        profanity: false,
        gibberish: false,
        spamLike: false,
      }),
      usedLlm,
      usedRules,
    };
  }

  if (
    llm.status === 'block' &&
    f.profanity &&
    c >= thresholds.blockThreshold &&
    rulesBackedProfanity
  ) {
    return {
      status: hardBlockEnabled ? 'block' : 'warn',
      reasons: mergeReasons(rules.reasons, llm.reasons),
      confidence: c,
      flags: mergeFlags(rules.flags, llm.flags),
      usedLlm,
      usedRules,
    };
  }

  if (
    llm.status === 'block' &&
    f.gibberish &&
    c >= thresholds.gibberishBlockConfidence &&
    (rulesBackedGibberish || rules.severity === 'warn')
  ) {
    if (phase === 'publish') {
      return {
        status: hardBlockEnabled ? 'block' : 'warn',
        reasons: mergeReasons(rules.reasons, llm.reasons),
        confidence: c,
        flags: mergeFlags(rules.flags, llm.flags),
        usedLlm,
        usedRules,
      };
    }
    return {
      status: 'warn',
      reasons: mergeReasons(rules.reasons, llm.reasons),
      confidence: c,
      flags: mergeFlags(rules.flags, llm.flags),
      usedLlm,
      usedRules,
    };
  }

  if (llm.status === 'block' && c >= thresholds.blockThreshold) {
    return {
      status: hardBlockEnabled ? 'block' : 'warn',
      reasons: mergeReasons(rules.reasons, llm.reasons),
      confidence: c,
      flags: mergeFlags(rules.flags, llm.flags),
      usedLlm,
      usedRules,
    };
  }

  /** Model said `block` but confidence is low — surface as warn, not silent allow. */
  if (llm.status === 'block') {
    return {
      status: 'warn',
      reasons: mergeReasons(rules.reasons, llm.reasons),
      confidence: c,
      flags: mergeFlags(rules.flags, llm.flags),
      usedLlm,
      usedRules,
    };
  }

  if (llm.status === 'warn' || rules.severity === 'warn') {
    if (rulesContentPublishBlock) {
      return {
        status: 'block',
        reasons: mergeReasons(rules.reasons, llm.reasons),
        confidence: Math.max(c, 0.78),
        flags: mergeFlags(rules.flags, llm.flags),
        usedLlm,
        usedRules,
      };
    }
    return {
      status: 'warn',
      reasons: mergeReasons(rules.reasons, llm.reasons),
      confidence: c,
      flags: mergeFlags(rules.flags, llm.flags),
      usedLlm,
      usedRules,
    };
  }

  return {
    status: 'allow',
    reasons: [],
    confidence: c,
    flags: mergeFlags(rules.flags, llm.flags),
    usedLlm,
    usedRules,
  };
}

function mergeReasons(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b].filter(Boolean)));
}

function mergeFlags(
  a: RuleEngineResult['flags'],
  b: LlmModerationVerdict['flags'],
): LlmModerationVerdict['flags'] {
  return {
    profanity: a.profanity || b.profanity,
    gibberish: a.gibberish || b.gibberish,
    spamLike: a.spamLike || b.spamLike,
  };
}
