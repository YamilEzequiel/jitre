import { Injectable, NotImplementedException } from '@nestjs/common';
import { AiProvider } from '@jitre/shared';
import {
  IAiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
  AiStreamChunk,
  AiEmbedResponse,
  AiProviderError,
} from './ai-provider.interface';

interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAiChatRequest {
  model: string;
  messages: OpenAiChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'text' | 'json_object' };
}

interface OpenAiChatResponse {
  id: string;
  object: 'chat.completion';
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null };
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAiEmbedRequest {
  model: string;
  input: string | string[];
}

interface OpenAiEmbedResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

interface OpenAiErrorBody {
  error: { type: string; code: string | null; message: string };
}

const CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const EMBED_ENDPOINT = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';

function mapErrorCode(status: number, body: OpenAiErrorBody | null): {
  code: string;
  retryable: boolean;
} {
  if (status === 429) {
    const c = body?.error?.code;
    if (c === 'insufficient_quota') return { code: 'BUDGET_EXCEEDED', retryable: false };
    return { code: 'RATE_LIMITED', retryable: true };
  }
  if (status >= 500) return { code: 'PROVIDER_ERROR', retryable: true };
  if (status === 401 || status === 403) return { code: 'AUTH_FAILED', retryable: false };
  if (status === 400) {
    const t = body?.error?.type ?? '';
    if (t.includes('safety') || t.includes('content_policy')) {
      return { code: 'SAFETY_BLOCKED', retryable: false };
    }
    return { code: 'BAD_REQUEST', retryable: false };
  }
  return { code: 'UNKNOWN', retryable: false };
}

/**
 * OpenAI provider — Chat Completions + Embeddings API.
 *
 * Honors `responseFormat: 'json'` natively via response_format.
 */
@Injectable()
export class OpenAiProvider implements IAiProvider {
  readonly name = AiProvider.OPENAI;

  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly defaultEmbedModel: string;

  constructor(
    apiKey: string = '',
    defaultModel: string = DEFAULT_MODEL,
    defaultEmbedModel: string = DEFAULT_EMBED_MODEL,
  ) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.defaultEmbedModel = defaultEmbedModel;
  }

  async generateCompletion(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (!this.apiKey) {
      throw new AiProviderError(
        AiProvider.OPENAI,
        'AUTH_FAILED',
        'OPENAI_API_KEY is not configured',
        false,
      );
    }

    const modelName = req.model ?? this.defaultModel;
    const messages: OpenAiChatMessage[] = [];
    if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
    messages.push({ role: 'user', content: req.userPrompt });

    const body: OpenAiChatRequest = {
      model: modelName,
      messages,
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.responseFormat === 'json'
        ? { response_format: { type: 'json_object' } }
        : {}),
    };

    let res: Response;
    try {
      res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new AiProviderError(
        AiProvider.OPENAI,
        'NETWORK_ERROR',
        (err as Error).message,
        true,
      );
    }

    if (!res.ok) {
      const raw = await res.text();
      let parsed: OpenAiErrorBody | null = null;
      try {
        parsed = JSON.parse(raw) as OpenAiErrorBody;
      } catch {
        // body not JSON
      }
      const { code, retryable } = mapErrorCode(res.status, parsed);
      throw new AiProviderError(
        AiProvider.OPENAI,
        code,
        parsed?.error?.message ?? raw,
        retryable,
      );
    }

    const json = (await res.json()) as OpenAiChatResponse;
    const choice = json.choices[0];
    return {
      text: choice?.message?.content ?? '',
      promptTokens: json.usage.prompt_tokens,
      completionTokens: json.usage.completion_tokens,
      totalTokens: json.usage.total_tokens,
      model: json.model,
      finishReason: choice?.finish_reason ?? 'unknown',
    };
  }

  async *generateStream(_req: AiCompletionRequest): AsyncIterable<AiStreamChunk> {
    yield { delta: '', done: true };
    throw new NotImplementedException(
      'OpenAiProvider.generateStream is not implemented yet (SSE plumbing pending).',
    );
  }

  async embed(input: string | string[]): Promise<AiEmbedResponse> {
    if (!this.apiKey) {
      throw new AiProviderError(
        AiProvider.OPENAI,
        'AUTH_FAILED',
        'OPENAI_API_KEY is not configured',
        false,
      );
    }

    const body: OpenAiEmbedRequest = {
      model: this.defaultEmbedModel,
      input,
    };

    const res = await fetch(EMBED_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const raw = await res.text();
      let parsed: OpenAiErrorBody | null = null;
      try {
        parsed = JSON.parse(raw) as OpenAiErrorBody;
      } catch {
        // not JSON
      }
      const { code, retryable } = mapErrorCode(res.status, parsed);
      throw new AiProviderError(
        AiProvider.OPENAI,
        code,
        parsed?.error?.message ?? raw,
        retryable,
      );
    }

    const json = (await res.json()) as OpenAiEmbedResponse;
    return {
      vectors: json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding),
      promptTokens: json.usage.prompt_tokens,
      model: json.model,
    };
  }
}
