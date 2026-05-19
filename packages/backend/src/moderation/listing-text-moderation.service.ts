import { Injectable, Logger } from '@nestjs/common';
import { ModerationConfig } from './moderation.config';
import { fuseModeration } from './decision.fusion';
import { LlamaModerationClient } from './llama-moderation.client';
import type {
  FinalModerationDecision,
  ModerationPhase,
} from './moderation.types';
import { parseLlmModerationJson } from './moderation-result.schema';
import { RulesEngine } from './rules.engine';

import { ModerationMetricsService } from './moderation-metrics.service';

@Injectable()
export class ListingTextModerationService {
  private readonly logger = new Logger(ListingTextModerationService.name);

  constructor(
    private readonly config: ModerationConfig,
    private readonly rules: RulesEngine,
    private readonly llama: LlamaModerationClient,
    private readonly metrics: ModerationMetricsService,
  ) {}

  async evaluate(input: {
    title: string;
    description: string;
    categoryName: string;
    phase: ModerationPhase;
  }): Promise<FinalModerationDecision> {
    if (!this.config.enabled) {
      return {
        status: 'allow',
        reasons: [],
        confidence: 0,
        flags: {
          profanity: false,
          gibberish: false,
          spamLike: false,
        },
        usedLlm: false,
        usedRules: false,
      };
    }

    const rules = this.rules.evaluate(input.title, input.description);

    let llmRaw: string | null = null;
    const useLlm =
      rules.severity !== 'hard_block' &&
      this.config.llmEnabled &&
      this.config.llmTrafficPercent > 0 &&
      Math.random() * 100 < this.config.llmTrafficPercent;

    if (useLlm) {
      llmRaw = await this.llama.classifyListingText(input);
    }

    const llmParsed = llmRaw ? parseLlmModerationJson(llmRaw) : null;

    const decision = fuseModeration({
      phase: input.phase,
      rules,
      llm: llmParsed,
      hardBlockEnabled: this.config.hardBlockEnabled,
      thresholds: {
        blockThreshold: this.config.blockThreshold,
        warnThreshold: this.config.warnThreshold,
        gibberishBlockConfidence: this.config.gibberishBlockConfidence,
      },
    });

    this.metrics.record(decision.status);

    this.logger.log(
      JSON.stringify({
        event: 'listing_text_moderation',
        phase: input.phase,
        status: decision.status,
        usedLlm: decision.usedLlm,
        usedRules: decision.usedRules,
        confidence: decision.confidence,
        reasons: decision.reasons,
        flags: decision.flags,
      }),
    );

    return decision;
  }
}
