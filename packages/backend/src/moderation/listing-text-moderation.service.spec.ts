import { ListingTextModerationService } from './listing-text-moderation.service';
import { ModerationConfig } from './moderation.config';
import { RulesEngine } from './rules.engine';
import { LlamaModerationClient } from './llama-moderation.client';
import { ModerationMetricsService } from './moderation-metrics.service';

describe('ListingTextModerationService', () => {
  const metrics = new ModerationMetricsService();
  const rules = new RulesEngine();

  function makeService(overrides: Partial<ModerationConfig> = {}) {
    const config = Object.assign(new ModerationConfig(), {
      enabled: true,
      hardBlockEnabled: true,
      llmEnabled: true,
      llmTrafficPercent: 100,
      blockThreshold: 0.85,
      warnThreshold: 0.6,
      gibberishBlockConfidence: 0.8,
      ...overrides,
    });
    const llama = {
      classifyListingText: jest.fn(async () =>
        JSON.stringify({
          status: 'allow',
          confidence: 0.95,
          reasons: [],
          flags: {
            profanity: false,
            gibberish: false,
            spamLike: false,
          },
        }),
      ),
    } as unknown as LlamaModerationClient;
    return {
      service: new ListingTextModerationService(
        config,
        rules,
        llama,
        metrics,
      ),
      llama,
    };
  }

  it('short-circuits on rules profanity without calling LLM', async () => {
    const { service, llama } = makeService();
    const out = await service.evaluate({
      title: 'Инструмент',
      description: 'хуйня полная',
      categoryName: 'Tools',
      phase: 'draft',
    });
    expect(out.status).toBe('block');
    expect(llama.classifyListingText).not.toHaveBeenCalled();
  });

  it('skips LLM when llmEnabled is false', async () => {
    const { service, llama } = makeService({ llmEnabled: false });
    const out = await service.evaluate({
      title: 'Drill',
      description: 'Good condition',
      categoryName: 'Tools',
      phase: 'draft',
    });
    expect(out.status).toBe('allow');
    expect(llama.classifyListingText).not.toHaveBeenCalled();
  });

  it('blocks publish on heuristic gibberish when LLM is off', async () => {
    const { service, llama } = makeService({ llmEnabled: false });
    const out = await service.evaluate({
      title: 'Rent item',
      description:
        'qxkpmnvtrzwbdhjlsfgqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm',
      categoryName: 'Tools',
      phase: 'publish',
    });
    expect(out.status).toBe('block');
    expect(llama.classifyListingText).not.toHaveBeenCalled();
  });

  it('blocks publish on rules gibberish when LLM wrongly allows', async () => {
    const { service, llama } = makeService();
    jest.mocked(llama.classifyListingText).mockResolvedValue(
      JSON.stringify({
        status: 'allow',
        confidence: 0.95,
        reasons: [],
        flags: { profanity: false, gibberish: false, spamLike: false },
      }),
    );
    const out = await service.evaluate({
      title: 'Rent item',
      description:
        'qxkpmnvtrzwbdhjlsfgqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm',
      categoryName: 'Tools',
      phase: 'publish',
    });
    expect(out.status).toBe('block');
    expect(llama.classifyListingText).toHaveBeenCalled();
  });
});
