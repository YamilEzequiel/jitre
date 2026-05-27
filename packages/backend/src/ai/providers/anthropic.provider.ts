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

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string }>;
}

interface AnthropicCompletionRequest {
  model: string;
  max_tokens: number;
  system?: string;
  temperature?: number;
  messages: AnthropicMessage[];
}

interface AnthropicCompletionResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: Array<{ type: 'text'; text: string }>;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicErrorBody {
  type: 'error';
  error: { type: string; message: string };
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

function mapErrorCode(status: number, body: AnthropicErrorBody | null): {
  code: string;
  retryable: boolean;
} {
  if (status === 429) return { code: 'RATE_LIMITED', retryable: true };
  if (status >= 500) return { code: 'PROVIDER_ERROR', retryable: true };
  if (status === 401 || status === 403) return { code: 'AUTH_FAILED', retryable: false };
  if (status === 400) {
    const type = body?.error?.type ?? '';
    if (type === 'invalid_request_error') return { code: 'BAD_REQUEST', retryable: false };
  }
  if (body?.error?.type === 'overloaded_error') return { code: 'PROVIDER_ERROR', retryable: true };
  return { code: 'UNKNOWN', retryable: false };
}

/**
 * Anthropic provider — Messages API.
 *
 * Honors `responseFormat: 'json'` by appending a system instruction (the
 * Messages API does not have a native JSON-mode like OpenAI / Gemini).
 */
@Injectable()
export class AnthropicProvider implements IAiProvider {
  readonly name = AiProvider.ANTHROPIC;

  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(apiKey: string = '', defaultModel: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async generateCompletion(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (!this.apiKey) {
      throw new AiProviderError(
        AiProvider.ANTHROPIC,
        'AUTH_FAILED',
        'ANTHROPIC_API_KEY is not configured',
        false,
      );
    }

    const modelName = req.model ?? this.defaultModel;
    const systemPrompt = req.responseFormat === 'json'
      ? `${req.systemPrompt ? req.systemPrompt + '\n\n' : ''}Respond with valid JSON only — no prose, no markdown fences.`
      : req.systemPrompt;

    const body: AnthropicCompletionRequest = {
      model: modelName,
      max_tokens: req.maxTokens ?? 1024,
      messages: [{ role: 'user', content: req.userPrompt }],
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    };

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new AiProviderError(
        AiProvider.ANTHROPIC,
        'NETWORK_ERROR',
        (err as Error).message,
        true,
      );
    }

    if (!res.ok) {
      const raw = await res.text();
      let parsed: AnthropicErrorBody | null = null;
      try {
        parsed = JSON.parse(raw) as AnthropicErrorBody;
      } catch {
        // body wasn't JSON; fall through with raw text
      }
      const { code, retryable } = mapErrorCode(res.status, parsed);
      throw new AiProviderError(
        AiProvider.ANTHROPIC,
        code,
        parsed?.error?.message ?? raw,
        retryable,
      );
    }

    const json = (await res.json()) as AnthropicCompletionResponse;
    const text = json.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    return {
      text,
      promptTokens: json.usage.input_tokens,
      completionTokens: json.usage.output_tokens,
      totalTokens: json.usage.input_tokens + json.usage.output_tokens,
      model: json.model,
      finishReason: json.stop_reason ?? 'unknown',
    };
  }

  async *generateStream(_req: AiCompletionRequest): AsyncIterable<AiStreamChunk> {
    // Streaming uses Server-Sent Events on /v1/messages with stream=true. Not
    // wired yet — the live use-case in the controllers is request/response.
    yield { delta: '', done: true };
    throw new NotImplementedException(
      'AnthropicProvider.generateStream is not implemented yet (SSE plumbing pending).',
    );
  }

  embed(_input: string | string[]): Promise<AiEmbedResponse> {
    // Anthropic does not offer first-party embeddings (as of late 2025); they
    // recommend Voyage. We delegate to Voyage in a future iteration; for now
    // signal that embedding is provider-incompatible.
    return Promise.reject(
      new NotImplementedException(
        'Anthropic does not provide a native embeddings endpoint. Use Gemini or OpenAI.',
      ),
    );
  }
}
