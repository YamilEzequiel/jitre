import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { throttlerFactoryAsync } from './config/throttler.config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { allConfigs, envValidationSchema } from './config';
import { RequestContextModule } from './request-context/request-context.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './observability/metrics/metrics.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpLoggerInterceptor } from './common/interceptors/http-logger.interceptor';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { EventsModule } from './events/events.module';
import { AuditModule } from './audit/audit.module';
import { NotificationModule } from './notification/notification.module';
import { ActivityModule } from './activity/activity.module';
import { MentionModule } from './mention/mention.module';
import { StorageModule } from './storage/storage.module';
import { AttachmentModule } from './attachment/attachment.module';
import { CommentModule } from './comment/comment.module';
import { JobsModule } from './jobs/jobs.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { ProjectModule } from './project/project.module';
import { TaskModule } from './task/task.module';
// Fase 7 — Phase L wiring
import { RealtimeModule } from './realtime/realtime.module';
import { AiModule } from './ai/ai.module';
import { AiPromptTemplateModule } from './ai/prompt-template/ai-prompt-template.module';
import { AiDailyDigestModule } from './ai/daily-digest/ai-daily-digest.module';
import { AiAutoPrioritizeModule } from './ai/auto-prioritize/ai-auto-prioritize.module';
import { AutomationModule } from './automation/automation.module';
import { EmailModule } from './email/email.module';
// Fase 8 — Analytics
import { AnalyticsModule } from './analytics/analytics.module';
// Fase 10 — Docs / Chat / Time Tracking
import { DocumentModule } from './document/document.module';
import { ChatModule } from './chat/chat.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { OrgGraphModule } from './org-graph/org-graph.module';
import { AreaModule } from './area/area.module';
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: allConfigs,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule.forRootAsync({
      useFactory: () => {
        const pretty = process.env.LOG_PRETTY !== 'false';
        const level = process.env.LOG_LEVEL ?? 'debug';
        return {
          pinoHttp: {
            level,
            // Per-request HTTP log is handled by HttpLoggerInterceptor (colored,
            // single-line, with icon + status + duration). Pino still emits
            // application logs (this.logger.log/.error from services/handlers)
            // but no longer logs every incoming request itself.
            autoLogging: false,
            quietReqLogger: true,
            genReqId: (req, res) => {
              const existing =
                (req.headers['x-request-id'] as string | undefined) ??
                randomUUID();
              res.setHeader('x-request-id', existing);
              return existing;
            },
            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            customProps: (req) => ({
              requestId: req.id,
            }),
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            ...(pretty
              ? {
                  transport: {
                    target: 'pino-pretty',
                    options: {
                      singleLine: true,
                      translateTime: 'SYS:HH:MM:ss.l',
                      ignore: 'pid,hostname',
                    },
                  },
                }
              : {}),
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync(throttlerFactoryAsync()),
    RequestContextModule,
    DatabaseModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    UserModule,
    WorkspaceModule,
    EventsModule,
    AuditModule,
    NotificationModule,
    ActivityModule,
    MentionModule,
    StorageModule.forRoot(),
    AttachmentModule,
    CommentModule,
    JobsModule,
    SearchModule,
    SettingsModule,
    ProjectModule,
    TaskModule,
    ScheduleModule.forRoot(),
    AiModule,
    AiPromptTemplateModule,
    AiDailyDigestModule,
    AiAutoPrioritizeModule,
    EmailModule,
    AutomationModule,
    RealtimeModule,
    AnalyticsModule,
    DocumentModule,
    ChatModule,
    TimeTrackingModule,
    OrgGraphModule,
    AreaModule,
    CustomerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggerInterceptor,
    },
  ],
})
export class AppModule {}
