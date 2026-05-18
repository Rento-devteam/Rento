export type ModerationLlmHealthReport = {
  /** `true` only when Ollama is reachable, the configured model is installed, and (if requested) inference succeeds. */
  ok: boolean;
  llmEnabled: boolean;
  baseUrl: string;
  model: string;
  ollamaReachable: boolean;
  modelInstalled: boolean;
  installedModels: string[];
  inferenceOk: boolean;
  inferenceSkipped: boolean;
  error?: string;
  hint?: string;
};
