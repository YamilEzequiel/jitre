export { appConfig, type AppConfig } from './app.config';
export { databaseConfig, type DatabaseConfig } from './database.config';
export { redisConfig, type RedisConfig } from './redis.config';
export { jwtConfig, type JwtConfig } from './jwt.config';
export { storageConfig, type StorageConfig } from './storage.config';
export { aiConfig, type AIConfig } from './ai.config';
export { envValidationSchema } from './env.validation';
export { throttlerFactoryAsync } from './throttler.config';

import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { redisConfig } from './redis.config';
import { jwtConfig } from './jwt.config';
import { storageConfig } from './storage.config';
import { aiConfig } from './ai.config';

export const allConfigs = [
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  storageConfig,
  aiConfig,
];
