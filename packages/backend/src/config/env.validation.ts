import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  // HTTP
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('1'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),

  // PostgreSQL
  POSTGRES_HOST: Joi.string().default('localhost'),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  DATABASE_LOGGING: Joi.boolean().default(false),
  DATABASE_SYNCHRONIZE: Joi.boolean().default(false),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // Auth (Fase 2)
  // Secrets MUST be 32+ chars. In production, reject anything that still
  // looks like the dev defaults committed in env.example — those are public
  // and would let anyone mint valid tokens against the deploy.
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .default('dev_access_secret_change_me_change_me_NOT_FOR_PRODUCTION')
    .custom((value, helpers) => {
      if (
        process.env.NODE_ENV === 'production' &&
        /change_me|NOT_FOR_PRODUCTION|REPLACE_BEFORE_DEPLOY/i.test(value)
      ) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'production-secret-check')
    .messages({
      'any.invalid':
        'JWT_ACCESS_SECRET still matches a dev placeholder. Generate one with `openssl rand -hex 32` before deploying.',
    }),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .default('dev_refresh_secret_change_me_change_me_NOT_FOR_PRODUCTION')
    .custom((value, helpers) => {
      if (
        process.env.NODE_ENV === 'production' &&
        /change_me|NOT_FOR_PRODUCTION|REPLACE_BEFORE_DEPLOY/i.test(value)
      ) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'production-secret-check')
    .messages({
      'any.invalid':
        'JWT_REFRESH_SECRET still matches a dev placeholder. Generate one with `openssl rand -hex 32` before deploying.',
    }),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
  ARGON2_MEMORY_COST: Joi.number().default(65536),
  ARGON2_TIME_COST: Joi.number().default(3),
  ARGON2_PARALLELISM: Joi.number().default(4),

  // Storage (Fase 4)
  STORAGE_DRIVER: Joi.string()
    .valid('local', 's3', 'r2', 'minio')
    .default('local'),
  STORAGE_LOCAL_ROOT: Joi.string().default('./uploads'),
  STORAGE_MAX_FILE_SIZE_MB: Joi.number().default(25),
  STORAGE_PUBLIC_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3000/api/v1/files'),
  STORAGE_LOCAL_SIGNING_SECRET: Joi.string().allow('').default(''),

  // S3 / R2 (Fase 4) — optional; validated per-driver at runtime
  AWS_REGION: Joi.string().allow('').default(''),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  STORAGE_S3_BUCKET: Joi.string().allow('').default(''),
  R2_ENDPOINT: Joi.string().allow('').default(''),

  // AI (Fase 7)
  AI_PROVIDER: Joi.string()
    .valid('GEMINI', 'ANTHROPIC', 'OPENAI', 'gemini', 'anthropic', 'openai')
    .default('GEMINI'),
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  GEMINI_MODEL: Joi.string().default('gemini-2.5-flash'),
  ANTHROPIC_API_KEY: Joi.string().allow('').default(''),
  ANTHROPIC_MODEL: Joi.string().default('claude-3-5-sonnet-20241022'),
  OPENAI_API_KEY: Joi.string().allow('').default(''),
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
  OPENAI_EMBED_MODEL: Joi.string().default('text-embedding-3-small'),
  AI_MONTHLY_BUDGET_USD: Joi.number().default(50),
  AI_MAX_REQUESTS_PER_DAY: Joi.number().integer().min(1).default(1000),
  AI_MAX_REQUESTS_PER_USER_PER_DAY: Joi.number().integer().min(1).default(100),
  AI_ADMIN_BYPASS_USER_CAP: Joi.boolean().default(true),
  // Realtime / WebSocket (Fase 7)
  WS_MAX_EVENTS_PER_SOCKET_SEC: Joi.number().integer().min(1).default(50),
  WS_MAX_ROOMS_PER_SOCKET: Joi.number().integer().min(1).default(100),
  WS_PATH: Joi.string().default('/ws'),
  SOCKETIO_REDIS_CHANNEL_PREFIX: Joi.string().default('socketio'),

  // Observability
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('debug'),
  LOG_PRETTY: Joi.boolean().default(true),

  // Throttler
  THROTTLER_TTL: Joi.number().default(60),
  THROTTLER_LIMIT: Joi.number().default(120),

  // Analytics (Fase 8)
  ANALYTICS_MAX_DATE_RANGE_DAYS: Joi.number().integer().min(1).default(365),

  // Jobs / Search / Settings (Fase 5)
  SEARCH_ENGINE: Joi.string().valid('pg', 'elasticsearch').default('pg'),
  BULLMQ_PREFIX: Joi.string().default('jitre'),
  JOB_LOG_RETENTION_DAYS: Joi.number().integer().min(1).default(90),
  ENABLE_BULL_BOARD: Joi.boolean().default(false),

  // Swagger / OpenAPI exposure
  // Off by default in production to reduce recon surface; on in dev/test.
  ENABLE_SWAGGER: Joi.boolean().default(
    process.env.NODE_ENV !== 'production',
  ),
});
