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

      // Defaults tuned for an interactive web app. A single screen mount
      // (chat, kanban, doc tree) can fire 10–30 parallel requests; humans
      // moving fast through the UI add bursts on top. Stay generous in
      // dev/prod; lock down with env vars per environment if abuse appears.
      const shortLimit = Number(cfg.get('THROTTLER_SHORT_LIMIT') ?? 60);
      const mediumLimit = Number(cfg.get('THROTTLER_MEDIUM_LIMIT') ?? 500);
      const longLimit = Number(cfg.get('THROTTLER_LONG_LIMIT') ?? 3000);

      return {
        throttlers: [
          { name: 'short', ttl: 1_000, limit: shortLimit },
          { name: 'medium', ttl: 10_000, limit: mediumLimit },
          { name: 'long', ttl: 60_000, limit: longLimit },
        ],
        storage: new ThrottlerStorageRedisService(redisOptions),
      };
    },
  };
}
