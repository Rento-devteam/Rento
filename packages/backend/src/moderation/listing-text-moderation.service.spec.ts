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
    const classifyListingText = jest.fn(async () =>
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
    );
    const llama = {
      classifyListingText,
    } as unknown as LlamaModerationClient;
    return {
      service: new ListingTextModerationService(config, rules, llama, metrics),
      llama,
      classifyListingText,
    };
  }

  it('short-circuits on rules profanity without calling LLM', async () => {
    const { service, classifyListingText } = makeService();
    const out = await service.evaluate({
      title: 'Инструмент',
      description: 'хуйня полная',
      categoryName: 'Tools',
      phase: 'draft',
    });
    expect(out.status).toBe('block');
    expect(classifyListingText).not.toHaveBeenCalled();
  });

  it('skips LLM when llmEnabled is false', async () => {
    const { service, classifyListingText } = makeService({ llmEnabled: false });
    const out = await service.evaluate({
      title: 'Drill',
      description: 'Good condition',
      categoryName: 'Tools',
      phase: 'draft',
    });
    expect(out.status).toBe('allow');
    expect(classifyListingText).not.toHaveBeenCalled();
  });

  it('blocks publish on heuristic gibberish when LLM is off', async () => {
    const { service, classifyListingText } = makeService({ llmEnabled: false });
    const out = await service.evaluate({
      title: 'Rent item',
      description:
        'qxkpmnvtrzwbdhjlsfgqwertyuiopasdfghjklzxcvbnmqwertyuiopasdfghjklzxcvbnm',
      categoryName: 'Tools',
      phase: 'publish',
    });
    expect(out.status).toBe('block');
    expect(classifyListingText).not.toHaveBeenCalled();
  });

  it('blocks publish on rules gibberish when LLM wrongly allows', async () => {
    const { service, classifyListingText } = makeService();
    classifyListingText.mockResolvedValue(
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
    expect(classifyListingText).toHaveBeenCalled();
  });
});
