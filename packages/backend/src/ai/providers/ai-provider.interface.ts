import { AiProvider } from '@jitre/shared';

export const AI_PROVIDERS = Symbol('AI_PROVIDERS');

export interface AiCompletionRequest {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Optional response format hint — providers that support JSON-mode honor it; others ignore. */
  responseFormat?: 'text' | 'json';
}

export interface AiCompletionResponse {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  /** Provider-reported finish reason: 'stop' | 'length' | 'safety' | 'error' | 'unknown' */
  finishReason: string;
}

export interface AiStreamChunk {
  delta: string;
  done: boolean;
}

export interface AiEmbedResponse {
  vectors: number[][];
  promptTokens: number;
  model: string;
}

export interface IAiProvider {
  readonly name: AiProvider;
  generateCompletion(req: AiCompletionRequest): Promise<AiCompletionResponse>;
  generateStream(req: AiCompletionRequest): AsyncIterable<AiStreamChunk>;
  embed(input: string | string[]): Promise<AiEmbedResponse>;
}

export class AiProviderError extends Error {
  constructor(
    public readonly provider: AiProvider,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
