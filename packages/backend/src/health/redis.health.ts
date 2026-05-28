import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';

/**
 * Lightweight Redis readiness probe.
 *
 * The codebase wires Redis ad-hoc per module (bullmq, throttler,
 * socket-io adapter) instead of exposing a shared client, so the
 * health indicator opens its own small connection that lives for the
 * lifetime of the module. PING under a 2s timeout — anything slower
 * counts as unhealthy.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    super();
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST') ?? 'localhost',
      port: config.get<number>('REDIS_PORT') ?? 6379,
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      // Don't retry forever inside a healthcheck — fail fast and surface it.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  async ping(key = 'redis'): Promise<HealthIndicatorResult> {
    const start = Date.now();
    try {
      if (this.redis.status !== 'ready' && this.redis.status !== 'connecting') {
        await this.redis.connect();
      }
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('redis_ping_timeout')), 2000),
        ),
      ]);
      const latencyMs = Date.now() - start;
      const ok = pong === 'PONG';
      return this.getStatus(key, ok, { latencyMs });
    } catch (err) {
      return this.getStatus(key, false, {
        error: (err as Error).message ?? 'unknown',
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // ignore — process is going down anyway
    }
  }
}
