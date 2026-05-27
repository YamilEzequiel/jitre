import { OpenAiProvider } from './openai.provider';
import { AiProvider } from '@jitre/shared';
import { NotImplementedException } from '@nestjs/common';
import { AiProviderError } from './ai-provider.interface';

describe('OpenAiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('has name OPENAI', () => {
    expect(new OpenAiProvider('x').name).toBe(AiProvider.OPENAI);
  });

  it('fails fast with AUTH_FAILED when no API key is configured', async () => {
    const provider = new OpenAiProvider('');
    await expect(
      provider.generateCompletion({ userPrompt: 'hello' }),
    ).rejects.toMatchObject({
      provider: AiProvider.OPENAI,
      code: 'AUTH_FAILED',
    });
  });

  it('translates a successful chat completion response', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'chatcmpl_1',
          object: 'chat.completion',
          model: 'gpt-4o-mini',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'hello back' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const provider = new OpenAiProvider('test-key');
    const res = await provider.generateCompletion({
      userPrompt: 'hi',
      systemPrompt: 'be brief',
    });

    expect(res.text).toBe('hello back');
    expect(res.promptTokens).toBe(9);
    expect(res.completionTokens).toBe(4);
    expect(res.totalTokens).toBe(13);
    expect(res.model).toBe('gpt-4o-mini');
    expect(res.finishReason).toBe('stop');
  });

  it('passes response_format=json_object when responseFormat=json', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'x',
          object: 'chat.completion',
          model: 'gpt-4o-mini',
          choices: [
            { index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAiProvider('test-key');
    await provider.generateCompletion({ userPrompt: 'hi', responseFormat: 'json' });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('maps insufficient_quota into BUDGET_EXCEEDED (non-retryable)', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          error: { type: 'insufficient_quota', code: 'insufficient_quota', message: 'no money' },
        }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const provider = new OpenAiProvider('test-key');
    await expect(
      provider.generateCompletion({ userPrompt: 'hi' }),
    ).rejects.toMatchObject({
      code: 'BUDGET_EXCEEDED',
      retryable: false,
    });
  });

  it('maps content_policy_violation into SAFETY_BLOCKED', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          error: { type: 'content_policy_violation', code: null, message: 'blocked' },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const provider = new OpenAiProvider('test-key');
    await expect(
      provider.generateCompletion({ userPrompt: 'hi' }),
    ).rejects.toMatchObject({
      code: 'SAFETY_BLOCKED',
      retryable: false,
    });
  });

  it('returns embedding vectors ordered by index', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            { embedding: [0.3, 0.4], index: 1 },
            { embedding: [0.1, 0.2], index: 0 },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 6, total_tokens: 6 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const provider = new OpenAiProvider('test-key');
    const res = await provider.embed(['hello', 'world']);

    expect(res.vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(res.promptTokens).toBe(6);
    expect(res.model).toBe('text-embedding-3-small');
  });

  it('generateStream is not implemented yet', async () => {
    const provider = new OpenAiProvider('test-key');
    const iterable = provider.generateStream({ userPrompt: 'hi' });
    const iterator = iterable[Symbol.asyncIterator]();
    await iterator.next();
    await expect(iterator.next()).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('AiProviderError carries the provider tag', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const provider = new OpenAiProvider('test-key');
    try {
      await provider.generateCompletion({ userPrompt: 'hi' });
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError);
      expect((err as AiProviderError).provider).toBe(AiProvider.OPENAI);
    }
  });
});
