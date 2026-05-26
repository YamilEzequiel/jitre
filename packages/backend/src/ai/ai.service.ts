import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AiProvider, AiOperation } from '@jitre/shared';
import { SettingsService } from '../settings/settings.service';
import { EventBusService } from '../events/event-bus.service';
import {
  AI_PROVIDERS,
  AiCompletionRequest,
  AiCompletionResponse,
  AiProviderError,
  IAiProvider,
} from './providers/ai-provider.interface';
import { AiUsageService } from './ai-usage.service';
import { calculateCost } from './ai-rate-card.config';
import { AiFeatureDisabledException } from './exceptions/ai-feature-disabled.exception';
import { AiRequestMadeEvent } from './events/ai-request-made.event';
import { AiRequestFailedEvent } from './events/ai-request-failed.event';

export interface GenerateCompletionOpts {
  workspaceId: string;
  userId: string;
  operation: AiOperation;
  request: AiCompletionRequest;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providerMap: Map<AiProvider, IAiProvider>;

  constructor(
    @Inject(AI_PROVIDERS) providers: IAiProvider[],
    private readonly settings: SettingsService,
    private readonly usage: AiUsageService,
    private readonly eventBus: EventBusService,
  ) {
    this.providerMap = new Map(providers.map((p) => [p.name, p]));
  }

  async generateCompletion(
    opts: GenerateCompletionOpts,
  ): Promise<AiCompletionResponse & { costUsd: string }> {
    // 1. Kill switch check
    const enabled = await this.settings.getAiSetting<boolean>(
      opts.workspaceId,
      'ai.enabled',
      true,
    );
    if (!enabled) throw new AiFeatureDisabledException('ai.enabled');

    // 2. Provider resolution
    const providerName = await this.settings.getAiSetting<AiProvider>(
      opts.workspaceId,
      'ai.provider',
      AiProvider.GEMINI,
    );
    const provider = this.providerMap.get(providerName);
    if (!provider) {
      throw new BadRequestException(
        `Unknown AI provider: ${String(providerName)}`,
      );
    }

    const start = Date.now();

    try {
      // 3. Provider call
      const response = await provider.generateCompletion(opts.request);
      const costUsd = calculateCost(
        provider.name,
        response.model,
        response.promptTokens,
        response.completionTokens,
      );
      const latencyMs = Date.now() - start;

      // 4. Record usage (success)
      await this.usage.record({
        workspaceId: opts.workspaceId,
        userId: opts.userId,
        provider: provider.name,
        model: response.model,
        operation: opts.operation,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        costUsd,
        latencyMs,
        success: true,
        errorCode: null,
      });

      // 5. Emit domain event
      this.eventBus.publish(
        new AiRequestMadeEvent({
          aggregateId: opts.workspaceId,
          aggregateType: 'Workspace',
          workspaceId: opts.workspaceId,
          actorUserId: opts.userId,
          payload: {
            provider: provider.name,
            model: response.model,
            operation: opts.operation,
            costUsd,
            totalTokens: response.totalTokens,
          },
        }),
      );

      return { ...response, costUsd };
    } catch (err) {
      if (
        err instanceof AiFeatureDisabledException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }

      const latencyMs = Date.now() - start;
      const errorCode = err instanceof AiProviderError ? err.code : 'UNKNOWN';

      // Record failed usage
      try {
        await this.usage.record({
          workspaceId: opts.workspaceId,
          userId: opts.userId,
          provider: provider.name,
          model: opts.request.model ?? 'unknown',
          operation: opts.operation,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: '0.000000',
          latencyMs,
          success: false,
          errorCode,
        });
      } catch (recordErr) {
        this.logger.error('Failed to record AI usage on error', recordErr);
      }

      // Emit failure event
      this.eventBus.publish(
        new AiRequestFailedEvent({
          aggregateId: opts.workspaceId,
          aggregateType: 'Workspace',
          workspaceId: opts.workspaceId,
          actorUserId: opts.userId,
          payload: {
            provider: provider.name,
            operation: opts.operation,
            errorCode,
            message: (err as Error).message,
          },
        }),
      );

      throw err;
    }
  }
}
