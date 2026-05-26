import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiUsageService } from './ai-usage.service';
import { AiUsageRecord } from './ai-usage.entity';
import { AiUsageListener } from './ai-usage.listener';
import { AiQuotaGuard } from './ai-quota.guard';
import { GeminiProvider } from './providers/gemini.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { AI_PROVIDERS } from './providers/ai-provider.interface';
import { TaskModule } from '../task/task.module';
import { CommentModule } from '../comment/comment.module';
import { SettingsModule } from '../settings/settings.module';
import { TaskService } from '../task/task.service';
import { CommentService } from '../comment/comment.service';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AiUsageRecord, WorkspaceMembershipEntity]),
    TaskModule,
    CommentModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: GeminiProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new GeminiProvider(
          config.get<string>('GEMINI_API_KEY') ?? process.env.GEMINI_API_KEY ?? '',
          config.get<string>('GEMINI_MODEL') ??
            process.env.GEMINI_MODEL ??
            'gemini-2.0-flash',
        ),
    },
    AnthropicProvider,
    OpenAiProvider,
    {
      provide: AI_PROVIDERS,
      useFactory: (
        gemini: GeminiProvider,
        anthropic: AnthropicProvider,
        openai: OpenAiProvider,
      ) => [gemini, anthropic, openai],
      inject: [GeminiProvider, AnthropicProvider, OpenAiProvider],
    },
    AiUsageService,
    AiService,
    AiQuotaGuard,
    AiUsageListener,
    Logger,
    // String injection tokens for AiController (backward-compat with controller spec)
    {
      provide: 'TaskService',
      useExisting: TaskService,
    },
    {
      provide: 'CommentService',
      useExisting: CommentService,
    },
  ],
  controllers: [AiController],
  exports: [AiService, AiUsageService, AiQuotaGuard],
})
export class AiModule {}
