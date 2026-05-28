import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger as NestLogger, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { AppConfig } from './config/app.config';
import { RedisIoAdapter } from './realtime/adapters/redis-io.adapter';
import type { RedisConfig } from './config/redis.config';
import { bootstrapSentry } from './observability/sentry.bootstrap';

async function bootstrap(): Promise<void> {
  // Sentry first so it can wrap the rest of the boot pipeline. No-op
  // when SENTRY_DSN is unset or the SDK isn't installed.
  await bootstrapSentry();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');

  app.use(cookieParser());

  // Helmet — Content-Security-Policy is intentionally only enabled in
  // production. Dev CSP fights live-reload / Angular HMR; readers in
  // prod get the tightened policy without a flag flip in dev.
  const isProd = appConfig.env === 'production';
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              // Angular emits inline event handlers it generates at runtime;
              // 'unsafe-inline' is required to keep the SPA functional. If
              // you put nginx in front and ship a CSP nonce there, remove
              // 'unsafe-inline' here.
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", 'https:', 'wss:'],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      // referrer-policy / X-Frame-Options / X-Content-Type-Options /
      // Strict-Transport-Security come on by default via helmet defaults
      // — explicit here just to document the surface.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );

  app.enableCors({
    origin: appConfig.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'x-workspace-id',
      'x-csrf-token',
    ],
    exposedHeaders: ['x-request-id'],
  });

  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: appConfig.apiVersion,
  });

  const docConfig = new DocumentBuilder()
    .setTitle('Jitre API')
    .setDescription(
      'AI-first project management platform. URI-versioned under /api/v{n}.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-workspace-id', in: 'header' },
      'workspace',
    )
    .addCookieAuth(
      'refresh',
      { type: 'apiKey', in: 'cookie', name: 'refresh_token' },
      'refresh',
    )
    .build();
  const document = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup(
    `${appConfig.apiPrefix}/v${appConfig.apiVersion}/docs`,
    app,
    document,
    {
      swaggerOptions: { persistAuthorization: true },
    },
  );

  // Fase 7 — Phase L4: wire Redis-backed Socket.IO adapter
  try {
    const redisConfig = config.get<RedisConfig>('redis');
    if (redisConfig) {
      const redisAdapter = new RedisIoAdapter(app);
      await redisAdapter.connectToRedis(redisConfig);
      app.useWebSocketAdapter(redisAdapter);
    }
  } catch (err) {
    NestLogger.warn(
      `RedisIoAdapter setup failed — falling back to in-memory WS adapter: ${String(err)}`,
      'Bootstrap',
    );
  }

  app.enableShutdownHooks();

  await app.listen(appConfig.port);

  const url = await app.getUrl();
  NestLogger.log(
    `🚀 Jitre API ready at ${url}/${appConfig.apiPrefix}/v${appConfig.apiVersion}`,
    'Bootstrap',
  );
  NestLogger.log(
    `📘 OpenAPI at ${url}/${appConfig.apiPrefix}/v${appConfig.apiVersion}/docs`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap Jitre API', err);
  process.exit(1);
});
