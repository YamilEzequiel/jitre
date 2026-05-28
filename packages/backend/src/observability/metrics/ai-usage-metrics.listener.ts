import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AiRequestMadeEvent } from '../../ai/events/ai-request-made.event';
import { MetricsService } from './metrics.service';

@Injectable()
export class AiUsageMetricsListener {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
  ) {}

  @OnEvent('ai.request_made')
  onAiRequestMade(event: AiRequestMadeEvent): void {
    try {
      const { provider, model, operation, costUsd, totalTokens } = event.payload;
      const labels = { provider, operation, model };
      this.metrics.aiRequestsTotal.inc(labels);
      const cost = parseFloat(costUsd);
      if (Number.isFinite(cost) && cost > 0) {
        this.metrics.aiCostUsdTotal.inc(labels, cost);
      }
      if (Number.isFinite(totalTokens) && totalTokens > 0) {
        this.metrics.aiTokensTotal.inc(labels, totalTokens);
      }
    } catch (err: unknown) {
      this.logger.error({ event: 'ai.usage.metrics.error', err });
    }
  }
}
