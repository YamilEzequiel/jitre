import { AnthropicProvider } from './anthropic.provider';
import { AiProvider } from '@jitre/shared';
import { NotImplementedException } from '@nestjs/common';
import { AiProviderError } from './ai-provider.interface';

describe('AnthropicProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('has name ANTHROPIC', () => {
    expect(new AnthropicProvider('x').name).toBe(AiProvider.ANTHROPIC);
  });

  it('fails fast with AUTH_FAILED when no API key is configured', async () => {
    const provider = new AnthropicProvider('');
    await expect(
      provider.generateCompletion({ userPrompt: 'hello' }),
    ).rejects.toMatchObject({
      provider: AiProvider.ANTHROPIC,
      code: 'AUTH_FAILED',
    });
  });

  it('translates a successful response into the IAiProvider shape', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'hello back' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 12, output_tokens: 8 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const provider = new AnthropicProvider('test-key');
    const res = await provider.generateCompletion({
      userPrompt: 'hi',
      systemPrompt: 'be brief',
      maxTokens: 64,
    });

    expect(res.text).toBe('hello back');
    expect(res.promptTokens).toBe(12);
    expect(res.completionTokens).toBe(8);
    expect(res.totalTokens).toBe(20);
    expect(res.model).toBe('claude-3-5-sonnet-20241022');
    expect(res.finishReason).toBe('end_turn');
  });

  it('appends a JSON-only instruction when responseFormat=json', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: '{"ok":true}' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new AnthropicProvider('test-key');
    await provider.generateCompletion({
      userPrompt: 'list',
      responseFormat: 'json',
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.system).toContain('JSON only');
  });

  it('maps a 429 into a retryable RATE_LIMITED error', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          type: 'error',
          error: { type: 'rate_limit_error', message: 'slow down' },
        }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const provider = new AnthropicProvider('test-key');
    await expect(
      provider.generateCompletion({ userPrompt: 'hi' }),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
    });
  });

  it('maps a 401 into a non-retryable AUTH_FAILED error', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          type: 'error',
          error: { type: 'authentication_error', message: 'invalid key' },
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const provider = new AnthropicProvider('bad-key');
    await expect(
      provider.generateCompletion({ userPrompt: 'hi' }),
    ).rejects.toMatchObject({
      code: 'AUTH_FAILED',
      retryable: false,
    });
  });

  it('wraps a network error as NETWORK_ERROR (retryable)', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('econnrefused');
    }) as unknown as typeof fetch;

    const provider = new AnthropicProvider('test-key');
    await expect(
      provider.generateCompletion({ userPrompt: 'hi' }),
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: true,
    });
  });

  it('generateStream is not implemented yet (SSE pending)', async () => {
    const provider = new AnthropicProvider('test-key');
    const iterable = provider.generateStream({ userPrompt: 'hi' });
    const iterator = iterable[Symbol.asyncIterator]();
    await iterator.next(); // first yield is the placeholder chunk
    await expect(iterator.next()).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('embed rejects (Anthropic has no first-party embeddings)', async () => {
    const provider = new AnthropicProvider('test-key');
    await expect(provider.embed('hi')).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('AiProviderError has the right metadata when fetch fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;

    const provider = new AnthropicProvider('test-key');
    try {
      await provider.generateCompletion({ userPrompt: 'hi' });
      fail('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError);
      expect((err as AiProviderError).provider).toBe(AiProvider.ANTHROPIC);
    }
  });
});
