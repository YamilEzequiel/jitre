import { calculateCost, AI_RATE_CARD } from './ai-rate-card.config';
import { AiProvider } from '@jitre/shared';

describe('ai-rate-card.config', () => {
  describe('AI_RATE_CARD', () => {
    it('contains an entry for gemini-2.0-flash-exp', () => {
      const entry = AI_RATE_CARD.find(
        (e) =>
          e.provider === AiProvider.GEMINI &&
          e.model === 'gemini-2.0-flash-exp',
      );
      expect(entry).toBeDefined();
    });

    it('contains an entry for gemini-1.5-pro', () => {
      const entry = AI_RATE_CARD.find(
        (e) => e.provider === AiProvider.GEMINI && e.model === 'gemini-1.5-pro',
      );
      expect(entry).toBeDefined();
    });

    it('contains an entry for text-embedding-004', () => {
      const entry = AI_RATE_CARD.find(
        (e) =>
          e.provider === AiProvider.GEMINI && e.model === 'text-embedding-004',
      );
      expect(entry).toBeDefined();
    });

    it('contains stub entries for anthropic and openai', () => {
      const anthropic = AI_RATE_CARD.find(
        (e) => e.provider === AiProvider.ANTHROPIC,
      );
      const openai = AI_RATE_CARD.find((e) => e.provider === AiProvider.OPENAI);
      expect(anthropic).toBeDefined();
      expect(openai).toBeDefined();
    });
  });

  describe('calculateCost', () => {
    it('returns a string', () => {
      const result = calculateCost(
        AiProvider.GEMINI,
        'gemini-2.0-flash-exp',
        1000,
        500,
      );
      expect(typeof result).toBe('string');
    });

    it('returns exactly 6 decimal places', () => {
      const result = calculateCost(
        AiProvider.GEMINI,
        'gemini-2.0-flash-exp',
        1000,
        500,
      );
      const decimalPart = result.split('.')[1];
      expect(decimalPart).toHaveLength(6);
    });

    it('calculates correct cost for gemini-2.0-flash-exp', () => {
      // pricePerMillionPromptTokens: 0.075, pricePerMillionCompletionTokens: 0.30
      // 1M prompt tokens = $0.075, 1M completion tokens = $0.30
      // 1000 prompt: (1000/1e6)*0.075 = 0.000075
      // 500 completion: (500/1e6)*0.30 = 0.000150
      // total: 0.000225
      const result = calculateCost(
        AiProvider.GEMINI,
        'gemini-2.0-flash-exp',
        1000,
        500,
      );
      expect(result).toBe('0.000225');
    });

    it('calculates correct cost for gemini-1.5-pro', () => {
      // pricePerMillionPromptTokens: 1.25, pricePerMillionCompletionTokens: 5.00
      // 1000 prompt: (1000/1e6)*1.25 = 0.00125
      // 200 completion: (200/1e6)*5.00 = 0.001
      // total: 0.00225
      const result = calculateCost(
        AiProvider.GEMINI,
        'gemini-1.5-pro',
        1000,
        200,
      );
      expect(result).toBe('0.002250');
    });

    it('handles embed-token branch for text-embedding-004', () => {
      // pricePerMillionEmbedTokens: 0.025
      // 2000 embed tokens: (2000/1e6)*0.025 = 0.00005
      const result = calculateCost(
        AiProvider.GEMINI,
        'text-embedding-004',
        0,
        0,
        2000,
      );
      expect(result).toBe('0.000050');
    });

    it('returns 0.000000 when all tokens are zero', () => {
      const result = calculateCost(
        AiProvider.GEMINI,
        'gemini-2.0-flash-exp',
        0,
        0,
      );
      expect(result).toBe('0.000000');
    });

    it('throws when provider/model combo not in rate card', () => {
      expect(() =>
        calculateCost(AiProvider.GEMINI, 'gpt-5-super', 100, 50),
      ).toThrow();
    });

    it('throws with message mentioning provider/model', () => {
      expect(() =>
        calculateCost(AiProvider.ANTHROPIC, 'unknown-model-xyz', 100, 50),
      ).toThrow(/ANTHROPIC\/unknown-model-xyz/);
    });

    it('string result drops cleanly into decimal(12,6) — no drift at 6 decimals', () => {
      // Using large token counts that could cause float drift
      const result = calculateCost(
        AiProvider.GEMINI,
        'gemini-2.0-flash-exp',
        999999,
        999999,
      );
      const parts = result.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[1]).toHaveLength(6);
    });

    it('calculates cost for anthropic claude-3-5-sonnet stub', () => {
      // pricePerMillionPromptTokens: 3.00, pricePerMillionCompletionTokens: 15.00
      // 1000 prompt: 0.003, 500 completion: 0.0075 → total: 0.010500
      const result = calculateCost(
        AiProvider.ANTHROPIC,
        'claude-3-5-sonnet',
        1000,
        500,
      );
      expect(result).toBe('0.010500');
    });
  });
});
