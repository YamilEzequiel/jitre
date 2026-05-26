import { AnthropicProvider } from './anthropic.provider';
import { AiProvider } from '@jitre/shared';
import { NotImplementedException } from '@nestjs/common';

describe('AnthropicProvider (stub)', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  it('has name ANTHROPIC', () => {
    expect(provider.name).toBe(AiProvider.ANTHROPIC);
  });

  it('generateCompletion throws NotImplementedException', async () => {
    await expect(
      provider.generateCompletion({ userPrompt: 'hello' }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('generateCompletion error message contains AnthropicProvider', async () => {
    await expect(
      provider.generateCompletion({ userPrompt: 'hello' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('AnthropicProvider'),
    });
  });

  it('generateStream throws NotImplementedException', async () => {
    // generateStream returns AsyncIterable — iterate to trigger throw
    const iterable = provider.generateStream({ userPrompt: 'hello' });
    const iterator = iterable[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it('embed throws NotImplementedException', async () => {
    await expect(provider.embed('hello')).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });

  it('embed error message contains AnthropicProvider', async () => {
    await expect(provider.embed('hello')).rejects.toMatchObject({
      message: expect.stringContaining('AnthropicProvider'),
    });
  });
});
