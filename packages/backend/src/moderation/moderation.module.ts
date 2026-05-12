import { Module } from '@nestjs/common';
import { ModerationConfig } from './moderation.config';
import { RulesEngine } from './rules.engine';
import { LlamaModerationClient } from './llama-moderation.client';
import { ListingTextModerationService } from './listing-text-moderation.service';
import { ModerationMetricsService } from './moderation-metrics.service';

@Module({
  providers: [
    ModerationConfig,
    RulesEngine,
    LlamaModerationClient,
    ListingTextModerationService,
    ModerationMetricsService,
  ],
  exports: [
    ListingTextModerationService,
    ModerationConfig,
    ModerationMetricsService,
  ],
})
export class ModerationModule {}
