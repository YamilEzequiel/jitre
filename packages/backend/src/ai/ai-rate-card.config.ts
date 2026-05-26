import { AiProvider } from '@jitre/shared';

export interface RateCardEntry {
  provider: AiProvider;
  model: string;
  pricePerMillionPromptTokens: number;
  pricePerMillionCompletionTokens: number;
  pricePerMillionEmbedTokens?: number;
}

export const AI_RATE_CARD: readonly RateCardEntry[] = [
  // Gemini (2025-Q4 rates)
  {
    provider: AiProvider.GEMINI,
    model: 'gemini-2.0-flash-exp',
    pricePerMillionPromptTokens: 0.075,
    pricePerMillionCompletionTokens: 0.3,
  },
  {
    provider: AiProvider.GEMINI,
    model: 'gemini-1.5-pro',
    pricePerMillionPromptTokens: 1.25,
    pricePerMillionCompletionTokens: 5.0,
  },
  {
    provider: AiProvider.GEMINI,
    model: 'text-embedding-004',
    pricePerMillionPromptTokens: 0.0,
    pricePerMillionCompletionTokens: 0.0,
    pricePerMillionEmbedTokens: 0.025,
  },
  // Anthropic stubs (rates for billing estimation; provider throws NotImplementedException)
  {
    provider: AiProvider.ANTHROPIC,
    model: 'claude-3-5-sonnet',
    pricePerMillionPromptTokens: 3.0,
    pricePerMillionCompletionTokens: 15.0,
  },
  // OpenAI stubs
  {
    provider: AiProvider.OPENAI,
    model: 'gpt-4o-mini',
    pricePerMillionPromptTokens: 0.15,
    pricePerMillionCompletionTokens: 0.6,
  },
];

/**
 * Calculate cost of an AI call and return as a string with 6 decimal places.
 * Returns as string to prevent float drift when storing in decimal(12,6).
 * Throws if (provider, model) is not in the rate card.
 */
export function calculateCost(
  provider: AiProvider,
  model: string,
  promptTokens: number,
  completionTokens: number,
  embedTokens: number = 0,
): string {
  const entry = AI_RATE_CARD.find(
    (r) => r.provider === provider && r.model === model,
  );
  if (!entry) {
    throw new Error(`No rate card entry for ${provider}/${model}`);
  }

  const cost =
    (promptTokens / 1_000_000) * entry.pricePerMillionPromptTokens +
    (completionTokens / 1_000_000) * entry.pricePerMillionCompletionTokens +
    (embedTokens / 1_000_000) * (entry.pricePerMillionEmbedTokens ?? 0);

  return cost.toFixed(6);
}
