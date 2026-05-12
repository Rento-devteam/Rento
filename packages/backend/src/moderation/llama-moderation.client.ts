import { Injectable, Logger } from '@nestjs/common';
import { ModerationConfig } from './moderation.config';
import type { ModerationPhase } from './moderation.types';
import { parseLlmModerationJson } from './moderation-result.schema';
import { normalizeListingText } from './text-normalize';

type OllamaChatResponse = {
  message?: { content?: string };
};

@Injectable()
export class LlamaModerationClient {
  private readonly logger = new Logger(LlamaModerationClient.name);

  constructor(private readonly config: ModerationConfig) {}

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
        lastErr = new Error(this.formatOllamaFetchError(e, timeoutMs));
      } finally {
        clearTimeout(timer);
      }
    }
    this.logger.warn(`LLM moderation failed after retries: ${String(lastErr)}`);
    return null;
  }

  private formatOllamaFetchError(err: unknown, timeoutMs: number): string {
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof DOMException !== 'undefined' &&
        err instanceof DOMException &&
        err.name === 'AbortError');
    if (isAbort) {
      return `Ollama request timed out after ${timeoutMs}ms (first inference often loads the model into RAM — increase MODERATION_LLM_TIMEOUT_MS / MODERATION_LLM_PUBLISH_TIMEOUT_MS or run \`ollama run <model> "hi"\` once to warm up)`;
    }
    return String(err);
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
