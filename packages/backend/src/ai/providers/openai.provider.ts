import { Injectable, NotImplementedException } from '@nestjs/common';
import { AiProvider } from '@jitre/shared';
import {
  IAiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
  AiStreamChunk,
  AiEmbedResponse,
} from './ai-provider.interface';

/**
 * OpenAI provider stub — interface-compliant but not yet implemented.
 * All methods throw NotImplementedException so misconfiguration surfaces
 * immediately (set ai.provider=GEMINI to use the live provider).
 */
@Injectable()
export class OpenAiProvider implements IAiProvider {
  readonly name = AiProvider.OPENAI;

  generateCompletion(_req: AiCompletionRequest): Promise<AiCompletionResponse> {
    return Promise.reject(
      new NotImplementedException(
        `OpenAiProvider.generateCompletion is not implemented in Fase 7. Set ai.provider=GEMINI.`,
      ),
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await, require-yield
  async *generateStream(
    _req: AiCompletionRequest,
  ): AsyncIterable<AiStreamChunk> {
    throw new NotImplementedException(
      `OpenAiProvider.generateStream is not implemented in Fase 7. Set ai.provider=GEMINI.`,
    );
  }

  embed(_input: string | string[]): Promise<AiEmbedResponse> {
    return Promise.reject(
      new NotImplementedException(
        `OpenAiProvider.embed is not implemented in Fase 7. Set ai.provider=GEMINI.`,
      ),
    );
  }
}
