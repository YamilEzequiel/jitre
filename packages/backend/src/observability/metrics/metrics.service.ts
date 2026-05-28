import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly bullmqQueueDepth = new Gauge({
    name: 'bullmq_queue_depth',
    help: 'Number of jobs in a BullMQ queue by state',
    labelNames: ['queue', 'state'] as const,
    registers: [this.registry],
  });

  readonly aiRequestsTotal = new Counter({
    name: 'ai_requests_total',
    help: 'Total number of AI requests made',
    labelNames: ['provider', 'operation', 'model'] as const,
    registers: [this.registry],
  });

  readonly aiCostUsdTotal = new Counter({
    name: 'ai_cost_usd_total',
    help: 'Cumulative AI cost in USD',
    labelNames: ['provider', 'operation', 'model'] as const,
    registers: [this.registry],
  });

  readonly aiTokensTotal = new Counter({
    name: 'ai_tokens_total',
    help: 'Cumulative AI token usage',
    labelNames: ['provider', 'operation', 'model'] as const,
    registers: [this.registry],
  });

  onModuleInit(): void {
    this.registry.setDefaultLabels({ service: 'jitre-backend' });
    collectDefaultMetrics({ register: this.registry });
  }

  recordRequest(args: {
    method: string;
    route: string;
    status: number;
    durationSeconds: number;
  }): void {
    const labels = {
      method: args.method,
      route: args.route,
      status: String(args.status),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, args.durationSeconds);
  }

  async snapshot(): Promise<{ contentType: string; body: string }> {
    return {
      contentType: this.registry.contentType,
      body: await this.registry.metrics(),
    };
  }
}
