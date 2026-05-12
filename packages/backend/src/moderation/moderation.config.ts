import { Injectable } from '@nestjs/common';

@Injectable()
export class ModerationConfig {
  readonly enabled = this.boolEnv('MODERATION_ENABLED', true);
  readonly hardBlockEnabled = this.boolEnv(
    'MODERATION_HARD_BLOCK_ENABLED',
    true,
  );
  readonly llmEnabled = this.boolEnv('MODERATION_LLM_ENABLED', true);
  readonly llmBaseUrl = (
    process.env.MODERATION_LLM_BASE_URL ?? 'http://localhost:11435'
  ).replace(/\/+$/, '');
  /**
   * Must match the **first column** of `ollama list` on the **same** Ollama that receives `MODERATION_LLM_BASE_URL`.
   * Default matches Docker `rento-ollama` after `ollama pull llama3.1:8b`.
   */
  readonly llmModel = process.env.MODERATION_LLM_MODEL ?? 'llama3.1:8b';
  readonly blockThreshold = this.floatEnv('MODERATION_BLOCK_THRESHOLD', 0.85);
  readonly warnThreshold = this.floatEnv('MODERATION_WARN_THRESHOLD', 0.6);
  readonly gibberishBlockConfidence = this.floatEnv(
    'MODERATION_GIBBERISH_BLOCK_CONFIDENCE',
    0.8,
  );
  readonly draftTimeoutMs = this.intEnv('MODERATION_LLM_TIMEOUT_MS', 45000);
  readonly publishTimeoutMs = this.intEnv(
    'MODERATION_LLM_PUBLISH_TIMEOUT_MS',
    90000,
  );
  readonly llmMaxRetries = this.intEnv('MODERATION_LLM_MAX_RETRIES', 2);
  /** 0–100: share of requests that call the LLM when enabled (staged rollout). */
  readonly llmTrafficPercent = Math.min(
    100,
    Math.max(0, this.intEnv('MODERATION_LLM_TRAFFIC_PERCENT', 100)),
  );
  /** Bump when prompt/thresholds change (stored on listing for analytics). */
  readonly moderationVersion = this.intEnv('MODERATION_VERSION', 2);

  private boolEnv(key: string, defaultValue: boolean): boolean {
    const v = process.env[key];
    if (v === undefined || v === '') {
      return defaultValue;
    }
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  }

  private intEnv(key: string, defaultValue: number): number {
    const v = process.env[key];
    if (v === undefined || v === '') {
      return defaultValue;
    }
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : defaultValue;
  }

  private floatEnv(key: string, defaultValue: number): number {
    const v = process.env[key];
    if (v === undefined || v === '') {
      return defaultValue;
    }
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : defaultValue;
  }
}
