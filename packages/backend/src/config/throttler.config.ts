import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Async factory for ThrottlerModule.forRootAsync().
 *
 * Wires Redis-backed storage via @nest-lab/throttler-storage-redis.
 * Uses ioredis-mock in test environments (injected via jest moduleNameMapper).
 *
 * Three named throttlers match the original single throttler semantics while
 * adding short-burst and medium-rate tiers for fine-grained control.
 */
export function throttlerFactoryAsync() {
  return {
    inject: [ConfigService],
    useFactory: (cfg: ConfigService): ThrottlerModuleOptions => {
      const host = cfg.get<string>('redis.host') ?? 'localhost';
      const port = cfg.get<number>('redis.port') ?? 6379;
      const password = cfg.get<string | undefined>('redis.password');

      const redisOptions = {
        host,
        port,
        ...(password ? { password } : {}),
        keyPrefix: 'throttler:',
      };

      return {
        throttlers: [
          { name: 'short', ttl: 1_000, limit: 3 },
          { name: 'medium', ttl: 10_000, limit: 20 },
          { name: 'long', ttl: 60_000, limit: 100 },
        ],
        storage: new ThrottlerStorageRedisService(redisOptions),
      };
    },
  };
}
