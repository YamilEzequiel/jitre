import { registerAs } from '@nestjs/config';

export type RedisConfig = ReturnType<typeof redisConfigFactory>;

const redisConfigFactory = () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
});

export const redisConfig = registerAs('redis', redisConfigFactory);
