import { OpenAiProvider } from './openai.provider';
import { AiProvider } from '@jitre/shared';
import { NotImplementedException } from '@nestjs/common';

describe('OpenAiProvider (stub)', () => {
  let provider: OpenAiProvider;

  beforeEach(() => {
    provider = new OpenAiProvider();
  });

  it('has name OPENAI', () => {
    expect(provider.name).toBe(AiProvider.OPENAI);
  });

  it('generateCompletion throws NotImplementedException', async () => {
    await expect(
      provider.generateCompletion({ userPrompt: 'hello' }),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('generateCompletion error message contains OpenAiProvider', async () => {
    await expect(
      provider.generateCompletion({ userPrompt: 'hello' }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('OpenAiProvider'),
    });
  });

  it('generateStream throws NotImplementedException', async () => {
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

  it('embed error message contains OpenAiProvider', async () => {
    await expect(provider.embed('hello')).rejects.toMatchObject({
      message: expect.stringContaining('OpenAiProvider'),
    });
  });
});
