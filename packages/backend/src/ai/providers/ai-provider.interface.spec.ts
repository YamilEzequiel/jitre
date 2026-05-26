import {
  AI_PROVIDERS,
  AiProviderError,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiStreamChunk,
  type AiEmbedResponse,
  type IAiProvider,
} from './ai-provider.interface';
import { AiProvider } from '@jitre/shared';

describe('IAiProvider types', () => {
  it('AI_PROVIDERS is a Symbol', () => {
    expect(typeof AI_PROVIDERS).toBe('symbol');
  });

  it('AiProviderError is instanceof Error', () => {
    const err = new AiProviderError(
      AiProvider.GEMINI,
      'RATE_LIMITED',
      'Too many requests',
      true,
    );
    expect(err).toBeInstanceOf(Error);
  });

  it('AiProviderError carries provider field', () => {
    const err = new AiProviderError(
      AiProvider.GEMINI,
      'RATE_LIMITED',
      'Too many requests',
      true,
    );
    expect(err.provider).toBe(AiProvider.GEMINI);
  });

  it('AiProviderError carries code field', () => {
    const err = new AiProviderError(
      AiProvider.ANTHROPIC,
      'AUTH_FAILED',
      'Unauthorized',
      false,
    );
    expect(err.code).toBe('AUTH_FAILED');
  });

  it('AiProviderError carries retryable flag', () => {
    const retryable = new AiProviderError(
      AiProvider.GEMINI,
      'RATE_LIMITED',
      'msg',
      true,
    );
    const nonRetryable = new AiProviderError(
      AiProvider.GEMINI,
      'SAFETY_BLOCKED',
      'msg',
      false,
    );
    expect(retryable.retryable).toBe(true);
    expect(nonRetryable.retryable).toBe(false);
  });

  it('AiProviderError name is AiProviderError', () => {
    const err = new AiProviderError(AiProvider.GEMINI, 'UNKNOWN', 'msg');
    expect(err.name).toBe('AiProviderError');
  });

  it('AiProviderError message is passed to Error', () => {
    const err = new AiProviderError(AiProvider.GEMINI, 'UNKNOWN', 'my message');
    expect(err.message).toBe('my message');
  });

  describe('type shape assignability checks', () => {
    it('AiCompletionRequest shape is valid', () => {
      const req: AiCompletionRequest = {
        userPrompt: 'hello',
        model: 'gemini-2.0-flash-exp',
        systemPrompt: 'be helpful',
        maxTokens: 600,
        temperature: 0.7,
        responseFormat: 'json',
      };
      expect(req.userPrompt).toBe('hello');
    });

    it('AiCompletionResponse shape is valid', () => {
      const res: AiCompletionResponse = {
        text: 'response',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        model: 'gemini-2.0-flash-exp',
        finishReason: 'stop',
      };
      expect(res.totalTokens).toBe(150);
    });

    it('AiStreamChunk shape is valid', () => {
      const chunk: AiStreamChunk = { delta: 'hello', done: false };
      const finalChunk: AiStreamChunk = { delta: '', done: true };
      expect(chunk.done).toBe(false);
      expect(finalChunk.done).toBe(true);
    });

    it('AiEmbedResponse shape is valid', () => {
      const res: AiEmbedResponse = {
        vectors: [[0.1, 0.2, 0.3]],
        promptTokens: 10,
        model: 'text-embedding-004',
      };
      expect(res.vectors).toHaveLength(1);
    });

    it('IAiProvider contract: object with name + methods is assignable', () => {
      const mockProvider: IAiProvider = {
        name: AiProvider.GEMINI,
        generateCompletion: jest.fn(),
        generateStream: jest.fn(),
        embed: jest.fn(),
      };
      expect(mockProvider.name).toBe(AiProvider.GEMINI);
    });
  });
});
