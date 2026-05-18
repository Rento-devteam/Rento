import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModerationConfig } from './moderation.config';
import type { ModerationPhase } from './moderation.types';
import { parseLlmModerationJson } from './moderation-result.schema';
import { normalizeListingText } from './text-normalize';
import type { ModerationLlmHealthReport } from './moderation-llm-health.types';

type OllamaChatResponse = {
  message?: { content?: string };
};

type OllamaTagsResponse = {
  models?: Array<{ name?: string }>;
};

@Injectable()
export class LlamaModerationClient implements OnModuleInit {
  private readonly logger = new Logger(LlamaModerationClient.name);

  constructor(private readonly config: ModerationConfig) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.llmEnabled) {
      this.logger.log('LLM moderation disabled (MODERATION_LLM_ENABLED=false)');
      return;
    }
    const report = await this.probeHealth({ runInference: false });
    if (report.ok) {
      this.logger.log(
        `LLM moderation ready: ${report.baseUrl} model=${report.model} (${report.installedModels.length} model(s) in Ollama)`,
      );
      return;
    }
    this.logger.error(
      `LLM moderation NOT ready: ${report.error ?? 'unknown'} — ${report.hint ?? 'see GET /health/moderation-llm'}`,
    );
  }

  /** Definitive readiness probe (same network path as real moderation). */
  async probeHealth(options?: {
    runInference?: boolean;
  }): Promise<ModerationLlmHealthReport> {
    const baseUrl = this.config.llmBaseUrl;
    const model = this.config.llmModel;
    const runInference = options?.runInference === true;

    if (!this.config.llmEnabled) {
      return {
        ok: true,
        llmEnabled: false,
        baseUrl,
        model,
        ollamaReachable: false,
        modelInstalled: false,
        installedModels: [],
        inferenceOk: false,
        inferenceSkipped: true,
        hint: 'LLM выключен (MODERATION_LLM_ENABLED=false). В логах модерации будет usedLlm:false.',
      };
    }

    let ollamaReachable = false;
    let installedModels: string[] = [];
    let modelInstalled = false;
    let error: string | undefined;

    try {
      const tags = await this.fetchOllamaTags(10_000);
      ollamaReachable = true;
      installedModels = tags;
      modelInstalled = this.isModelInstalled(tags, model);
      if (!modelInstalled) {
        error = `model "${model}" not found in Ollama`;
      }
    } catch (e) {
      error = this.formatOllamaFetchError(e, 10_000, `${baseUrl}/api/tags`);
    }

    let inferenceOk = false;
    let inferenceSkipped = !runInference;

    if (ollamaReachable && modelInstalled && runInference) {
      inferenceSkipped = false;
      try {
        const raw = await this.runInferenceProbe();
        inferenceOk = raw != null;
        if (!inferenceOk) {
          error = error ?? 'inference probe returned empty or invalid JSON';
        }
      } catch (e) {
        error = this.formatOllamaFetchError(
          e,
          Math.min(this.config.draftTimeoutMs, 30_000),
          `${baseUrl}/api/chat`,
        );
      }
    }

    const ok =
      ollamaReachable && modelInstalled && (inferenceSkipped || inferenceOk);

    const hint = this.buildHealthHint({
      ok,
      baseUrl,
      model,
      ollamaReachable,
      modelInstalled,
      installedModels,
      inferenceSkipped,
      inferenceOk,
      runInference,
    });

    return {
      ok,
      llmEnabled: true,
      baseUrl,
      model,
      ollamaReachable,
      modelInstalled,
      installedModels,
      inferenceOk,
      inferenceSkipped,
      error: ok ? undefined : error,
      hint: ok ? undefined : hint,
    };
  }

  async classifyListingText(input: {
    title: string;
    description: string;
    categoryName: string;
    phase: ModerationPhase;
  }): Promise<string | null> {
    const timeoutMs =
      input.phase === 'publish'
        ? this.config.publishTimeoutMs
        : this.config.draftTimeoutMs;
    const prompt = this.buildPrompt(input);
    const url = `${this.config.llmBaseUrl}/api/chat`;
    const body = {
      model: this.config.llmModel,
      format: 'json',
      stream: false,
      options: { temperature: 0.1 },
      messages: [
        {
          role: 'user' as const,
          content: prompt,
        },
      ],
    };

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.config.llmMaxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          let detail = '';
          try {
            const errBody = (await res.clone().json()) as { error?: string };
            if (typeof errBody?.error === 'string') {
              detail = `: ${errBody.error}`;
            }
          } catch {
            try {
              detail = `: ${(await res.clone().text()).slice(0, 200)}`;
            } catch {
              /* ignore */
            }
          }
          const hint =
            res.status === 404
              ? ' (проверьте `ollama list` на том же хосте, что и MODERATION_LLM_BASE_URL; для compose из репозитория Docker-Ollama на **:11435**, модель — как в `docker exec -it rento-ollama ollama list`; нативный Ollama часто на **:11434**)'
              : '';
          lastErr = new Error(
            `Ollama HTTP ${res.status} POST ${url}${detail}${hint}`,
          );
          continue;
        }
        const json = (await res.json()) as OllamaChatResponse;
        const raw = json.message?.content;
        if (typeof raw !== 'string' || !raw.trim()) {
          lastErr = new Error('Ollama empty content');
          continue;
        }
        const parsed = parseLlmModerationJson(raw);
        if (!parsed) {
          lastErr = new Error('Ollama JSON schema mismatch');
          continue;
        }
        return raw;
      } catch (e) {
        lastErr = new Error(this.formatOllamaFetchError(e, timeoutMs, url));
      } finally {
        clearTimeout(timer);
      }
    }
    this.logger.warn(
      `LLM moderation failed after retries (${this.config.llmBaseUrl}): ${String(lastErr)}`,
    );
    return null;
  }

  private async fetchOllamaTags(timeoutMs: number): Promise<string[]> {
    const url = `${this.config.llmBaseUrl}/api/tags`;
    const res = await this.fetchWithTimeout(url, { method: 'GET' }, timeoutMs);
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status} GET ${url}`);
    }
    const json = (await res.json()) as OllamaTagsResponse;
    return (json.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === 'string' && n.length > 0);
  }

  private async runInferenceProbe(): Promise<string | null> {
    const url = `${this.config.llmBaseUrl}/api/chat`;
    const res = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.llmModel,
          format: 'json',
          stream: false,
          options: { temperature: 0 },
          messages: [
            {
              role: 'user',
              content:
                'Respond with JSON only: {"status":"allow","confidence":0.99,"reasons":[],"flags":{"profanity":false,"gibberish":false,"spamLike":false}}',
            },
          ],
        }),
      },
      Math.min(this.config.draftTimeoutMs, 60_000),
    );
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status} POST ${url}`);
    }
    const json = (await res.json()) as OllamaChatResponse;
    const raw = json.message?.content;
    if (typeof raw !== 'string' || !raw.trim()) {
      return null;
    }
    return parseLlmModerationJson(raw) ? raw : null;
  }

  private fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(timer),
    );
  }

  private isModelInstalled(installed: string[], wanted: string): boolean {
    if (installed.includes(wanted)) {
      return true;
    }
    const base = wanted.split(':')[0];
    return installed.some(
      (name) => name === base || name.startsWith(`${base}:`),
    );
  }

  private buildHealthHint(input: {
    ok: boolean;
    baseUrl: string;
    model: string;
    ollamaReachable: boolean;
    modelInstalled: boolean;
    installedModels: string[];
    inferenceSkipped: boolean;
    inferenceOk: boolean;
    runInference: boolean;
  }): string | undefined {
    if (input.ok) {
      if (!input.runInference) {
        return 'Для полной проверки инференса: GET /health/moderation-llm?inference=1';
      }
      return undefined;
    }
    if (!input.ollamaReachable) {
      if (
        input.baseUrl.includes('localhost') ||
        input.baseUrl.includes('127.0.0.1')
      ) {
        return (
          'Backend в Docker не достучится до localhost — укажите MODERATION_LLM_BASE_URL=http://ollama:11434 ' +
          '(или удалите переменную из deploy/.env, чтобы сработал default compose). ' +
          'Убедитесь, что в docker-compose у backend первым DNS стоит 127.0.0.11.'
        );
      }
      return `Проверьте контейнер rento-ollama и сеть: docker exec rento-backend wget -qO- ${input.baseUrl}/api/tags`;
    }
    if (!input.modelInstalled) {
      return (
        `На Ollama нет модели "${input.model}". Установите: docker exec rento-ollama ollama pull ${input.model}` +
        (input.installedModels.length
          ? ` (сейчас: ${input.installedModels.join(', ')})`
          : '')
      );
    }
    if (!input.inferenceSkipped && !input.inferenceOk) {
      return 'Модель есть, но ответ невалиден — проверьте RAM/CPU и таймауты MODERATION_LLM_*_TIMEOUT_MS.';
    }
    return undefined;
  }

  private formatOllamaFetchError(
    err: unknown,
    timeoutMs: number,
    url?: string,
  ): string {
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof DOMException !== 'undefined' &&
        err instanceof DOMException &&
        err.name === 'AbortError');
    if (isAbort) {
      return `Ollama request timed out after ${timeoutMs}ms${url ? ` (${url})` : ''} (first inference often loads the model into RAM — increase MODERATION_LLM_TIMEOUT_MS or run \`docker exec rento-ollama ollama run <model> "hi"\` once)`;
    }
    if (err instanceof Error) {
      const cause = this.formatFetchErrorCause(err.cause);
      const parts = [err.message];
      if (cause) {
        parts.push(`cause: ${cause}`);
      }
      if (url) {
        parts.push(`url: ${url}`);
      }
      return parts.join('; ');
    }
    return String(err);
  }

  private formatFetchErrorCause(cause: unknown): string {
    if (cause == null) {
      return '';
    }
    if (cause instanceof Error) {
      return cause.message;
    }
    if (
      typeof cause === 'string' ||
      typeof cause === 'number' ||
      typeof cause === 'boolean' ||
      typeof cause === 'bigint'
    ) {
      return String(cause);
    }
    try {
      return JSON.stringify(cause);
    } catch {
      return 'unknown cause';
    }
  }

  private buildPrompt(input: {
    title: string;
    description: string;
    categoryName: string;
    phase: ModerationPhase;
  }): string {
    const title = normalizeListingText(input.title);
    const description = normalizeListingText(input.description);
    return [
      'You are a marketplace listing moderator. Respond with JSON only, no markdown, no extra text.',
      'JSON shape (exact keys):',
      '{',
      '  "status": "allow" | "warn" | "block",',
      '  "confidence": number between 0 and 1,',
      '  "reasons": string[],',
      '  "flags": { "profanity": boolean, "gibberish": boolean, "spamLike": boolean }',
      '}',
      'Criteria:',
      '- block: explicit profanity/slurs, hate, sexual solicitation, or obvious unusable spam/gibberish.',
      '- warn: unclear, low-effort, likely gibberish, or borderline rude but not explicit.',
      '- allow: coherent rental listing text.',
      'Bracketed alternatives or fill-in hints for the owner (e.g. [if battery / if corded]) are normal — treat as allow when the listing is otherwise substantive and readable.',
      '',
      'How to set "confidence" (important):',
      '- It measures how sure you are about **status + flags**, NOT how "perfect" or polished the listing is. Adequate, readable rental copy is not "70% quality".',
      '- If status is "allow" and the text is clearly a real rental listing (Russian or English, sensible sentences, item + terms, no abuse), use **confidence 0.88–1.0** even if there are placeholders, bullet lists, or marketing tone.',
      '- Use **0.70–0.87** only when the text is mostly fine but something is genuinely ambiguous (e.g. mixed languages in a confusing way, or borderline spam).',
      '- Use **below 0.70** mainly when you are unsure between warn and allow.',
      '- Do **not** lower confidence just because the description is long, detailed, or uses many lines — that is not uncertainty.',
      `Phase: ${input.phase} (publish is stricter than draft).`,
      `Category: ${input.categoryName}`,
      'Listing:',
      `title: ${title}`,
      `description: ${description}`,
    ].join('\n');
  }
}
