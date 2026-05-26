import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiProvider } from '@jitre/shared';
import {
  IAiProvider,
  AiCompletionRequest,
  AiCompletionResponse,
  AiStreamChunk,
  AiEmbedResponse,
  AiProviderError,
} from './ai-provider.interface';

const EMBED_MODEL = 'text-embedding-004';

function mapErrorCode(err: { status?: number; message?: string }): {
  code: string;
  retryable: boolean;
} {
  const status = err.status;
  if (status === 429) return { code: 'RATE_LIMITED', retryable: true };
  if (status && status >= 500)
    return { code: 'PROVIDER_ERROR', retryable: true };
  if (status === 401 || status === 403)
    return { code: 'AUTH_FAILED', retryable: false };
  if (status === 400) {
    const msg = (err.message ?? '').toUpperCase();
    if (msg.includes('SAFETY'))
      return { code: 'SAFETY_BLOCKED', retryable: false };
    return { code: 'AUTH_FAILED', retryable: false };
  }
  const msg = (err.message ?? '').toLowerCase();
  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused')
  ) {
    return { code: 'NETWORK_ERROR', retryable: true };
  }
  return { code: 'UNKNOWN', retryable: false };
}

@Injectable()
export class GeminiProvider implements IAiProvider {
  readonly name = AiProvider.GEMINI;

  private readonly genAI: GoogleGenerativeAI;
  private readonly defaultModel: string;

  constructor(apiKey: string, defaultModel: string = 'gemini-2.0-flash-exp') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.defaultModel = defaultModel;
  }

  async generateCompletion(
    req: AiCompletionRequest,
  ): Promise<AiCompletionResponse> {
    const modelName = req.model ?? this.defaultModel;
    const responseMimeType =
      req.responseFormat === 'json' ? 'application/json' : 'text/plain';

    const modelConfig: Record<string, unknown> = {
      model: modelName,
      generationConfig: {
        ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
        ...(req.temperature !== undefined
          ? { temperature: req.temperature }
          : {}),
        responseMimeType,
      },
    };

    if (req.systemPrompt) {
      modelConfig['systemInstruction'] = req.systemPrompt;
    }

    const model = this.genAI.getGenerativeModel(
      modelConfig as unknown as Parameters<GoogleGenerativeAI['getGenerativeModel']>[0],
    );

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: req.userPrompt }] }],
      });
      const response = result.response;
      const usage = response.usageMetadata ?? {};

      return {
        text: response.text(),
        promptTokens:
          (usage as { promptTokenCount?: number }).promptTokenCount ?? 0,
        completionTokens:
          (usage as { candidatesTokenCount?: number }).candidatesTokenCount ??
          0,
        totalTokens:
          (usage as { totalTokenCount?: number }).totalTokenCount ?? 0,
        model: modelName,
        finishReason:
          (response.candidates?.[0]?.finishReason as string | undefined) ??
          'unknown',
      };
    } catch (err) {
      const { code, retryable } = mapErrorCode(
        err as { status?: number; message?: string },
      );
      throw new AiProviderError(
        AiProvider.GEMINI,
        code,
        (err as Error).message,
        retryable,
      );
    }
  }

  async *generateStream(
    req: AiCompletionRequest,
  ): AsyncIterable<AiStreamChunk> {
    const modelName = req.model ?? this.defaultModel;
    const model = this.genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: req.userPrompt }] }],
    });

    for await (const chunk of result.stream) {
      yield { delta: chunk.text(), done: false };
    }
    yield { delta: '', done: true };
  }

  async embed(input: string | string[]): Promise<AiEmbedResponse> {
    const model = this.genAI.getGenerativeModel({ model: EMBED_MODEL });
    const text = Array.isArray(input) ? input[0] : input;

    const result = await model.embedContent(text);
    const usage = (result as { usageMetadata?: { totalTokenCount?: number } })
      .usageMetadata;

    return {
      vectors: [result.embedding.values],
      promptTokens: usage?.totalTokenCount ?? 0,
      model: EMBED_MODEL,
    };
  }
}
