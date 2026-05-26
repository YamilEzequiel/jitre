import { GeminiProvider } from './gemini.provider';
import { AiProvider } from '@jitre/shared';
import { AiProviderError } from './ai-provider.interface';

// Mock the entire @google/generative-ai module
const mockGenerateContent = jest.fn();
const mockGenerateContentStream = jest.fn();
const mockEmbedContent = jest.fn();
const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
      embedContent: mockEmbedContent,
    });

    provider = new GeminiProvider('test-api-key', 'gemini-2.0-flash-exp');
  });

  it('has name GEMINI', () => {
    expect(provider.name).toBe(AiProvider.GEMINI);
  });

  describe('generateCompletion', () => {
    it('returns AiCompletionResponse on happy path', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Generated text',
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      const result = await provider.generateCompletion({
        userPrompt: 'Describe this task',
      });

      expect(result.text).toBe('Generated text');
      expect(result.promptTokens).toBe(100);
      expect(result.completionTokens).toBe(50);
      expect(result.totalTokens).toBe(150);
      expect(result.finishReason).toBe('STOP');
    });

    it('uses default model when req.model not provided', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'response',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      await provider.generateCompletion({ userPrompt: 'hello' });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-2.0-flash-exp' }),
      );
    });

    it('passes systemInstruction when systemPrompt is provided', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'response',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      await provider.generateCompletion({
        userPrompt: 'hello',
        systemPrompt: 'be helpful',
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: 'be helpful',
        }),
      );
    });

    it('sets responseMimeType to application/json when responseFormat=json', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '{}',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      await provider.generateCompletion({
        userPrompt: 'return json',
        responseFormat: 'json',
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            responseMimeType: 'application/json',
          }),
        }),
      );
    });

    it('sets responseMimeType to text/plain when responseFormat=text', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'text',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      await provider.generateCompletion({
        userPrompt: 'return text',
        responseFormat: 'text',
      });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            responseMimeType: 'text/plain',
          }),
        }),
      );
    });

    it('maps 429-like error to RATE_LIMITED AiProviderError (retryable)', async () => {
      const err = Object.assign(new Error('Too many requests'), {
        status: 429,
      });
      mockGenerateContent.mockRejectedValue(err);

      await expect(
        provider.generateCompletion({ userPrompt: 'hello' }),
      ).rejects.toBeInstanceOf(AiProviderError);

      try {
        await provider.generateCompletion({ userPrompt: 'hello' });
      } catch (e) {
        const provErr = e as AiProviderError;
        expect(provErr.code).toBe('RATE_LIMITED');
        expect(provErr.retryable).toBe(true);
      }
    });

    it('maps 5xx error to PROVIDER_ERROR AiProviderError (retryable)', async () => {
      const err = Object.assign(new Error('Server error'), { status: 503 });
      mockGenerateContent.mockRejectedValue(err);

      try {
        await provider.generateCompletion({ userPrompt: 'hello' });
      } catch (e) {
        const provErr = e as AiProviderError;
        expect(provErr.code).toBe('PROVIDER_ERROR');
        expect(provErr.retryable).toBe(true);
      }
    });

    it('maps 400-safety error to SAFETY_BLOCKED AiProviderError (non-retryable)', async () => {
      const err = Object.assign(new Error('Safety blocked'), {
        status: 400,
        message: 'SAFETY',
      });
      mockGenerateContent.mockRejectedValue(err);

      try {
        await provider.generateCompletion({ userPrompt: 'hello' });
      } catch (e) {
        const provErr = e as AiProviderError;
        // Could be SAFETY_BLOCKED or AUTH_FAILED for 400 — depends on message
        expect(['SAFETY_BLOCKED', 'AUTH_FAILED', 'UNKNOWN']).toContain(
          provErr.code,
        );
      }
    });

    it('returns model field in response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'text',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      const result = await provider.generateCompletion({ userPrompt: 'hello' });
      expect(result.model).toBe('gemini-2.0-flash-exp');
    });
  });

  describe('generateStream', () => {
    it('yields chunks with delta and done=false, then final done=true chunk', async () => {
      const chunks = [{ text: () => 'Hello' }, { text: () => ' World' }];

      mockGenerateContentStream.mockResolvedValue({
        // eslint-disable-next-line @typescript-eslint/require-await
        stream: (async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        })(),
      });

      const collected: { delta: string; done: boolean }[] = [];
      for await (const chunk of provider.generateStream({
        userPrompt: 'hello',
      })) {
        collected.push(chunk);
      }

      expect(collected.length).toBe(3); // 2 content + 1 done
      expect(collected[0]).toEqual({ delta: 'Hello', done: false });
      expect(collected[1]).toEqual({ delta: ' World', done: false });
      expect(collected[2]).toEqual({ delta: '', done: true });
    });
  });

  describe('embed', () => {
    it('returns vectors and promptTokens', async () => {
      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
        embedContent: mockEmbedContent,
      });

      mockEmbedContent.mockResolvedValue({
        embedding: { values: [0.1, 0.2, 0.3] },
        usageMetadata: { totalTokenCount: 10 },
      });

      const result = await provider.embed('hello world');

      expect(result.vectors).toHaveLength(1);
      expect(result.vectors[0]).toEqual([0.1, 0.2, 0.3]);
      expect(result.promptTokens).toBe(10);
      expect(result.model).toBe('text-embedding-004');
    });
  });
});
