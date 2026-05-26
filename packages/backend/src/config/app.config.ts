import { registerAs } from '@nestjs/config';

export type AppConfig = ReturnType<typeof appConfigFactory>;

const appConfigFactory = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  apiVersion: process.env.API_VERSION ?? '1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  throttler: {
    ttl: parseInt(process.env.THROTTLER_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLER_LIMIT ?? '120', 10),
  },
  log: {
    level: process.env.LOG_LEVEL ?? 'debug',
    pretty: process.env.LOG_PRETTY === 'true',
  },
});

export const appConfig = registerAs('app', appConfigFactory);
