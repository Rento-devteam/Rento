import { Controller, Get, Query } from '@nestjs/common';
import { LlamaModerationClient } from './llama-moderation.client';

@Controller('health')
export class ModerationHealthController {
  constructor(private readonly llama: LlamaModerationClient) {}

  /**
   * Проверка готовности LLM-модерации (тот же URL, что и при создании объявления).
   *
   * - `GET /health/moderation-llm` — Ollama + наличие модели
   * - `GET /health/moderation-llm?inference=1` — плюс тестовый запрос в модель (100% что инференс работает)
   *
   * В логах модерации признак успеха: `"usedLlm":true` в `listing_text_moderation`.
   */
  @Get('moderation-llm')
  probe(@Query('inference') inference?: string) {
    const runInference = inference === '1' || inference === 'true';
    return this.llama.probeHealth({ runInference });
  }
}
