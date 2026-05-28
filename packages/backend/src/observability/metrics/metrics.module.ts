import { Global, Logger, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { AiUsageMetricsListener } from './ai-usage-metrics.listener';
import { QueueMetricsCollector } from './queue-metrics.collector';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    Logger,
    AiUsageMetricsListener,
    QueueMetricsCollector,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
