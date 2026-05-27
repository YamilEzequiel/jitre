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
import { AiGeneratorService } from './generator/ai-generator.service';
import { AiGeneratorController } from './generator/ai-generator.controller';
import { TaskModule } from '../task/task.module';
import { CommentModule } from '../comment/comment.module';
import { ProjectModule } from '../project/project.module';
import { DocumentModule } from '../document/document.module';
import { SettingsModule } from '../settings/settings.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TaskService } from '../task/task.service';
import { CommentService } from '../comment/comment.service';
import { CaslAbilityFactory } from '../auth/casl/ability.factory';
import { AbilityGuard } from '../auth/guards/ability.guard';
import { WorkspaceMembershipEntity } from '../workspace/workspace-membership.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AiUsageRecord, WorkspaceMembershipEntity]),
    TaskModule,
    CommentModule,
    ProjectModule,
    DocumentModule,
    SettingsModule,
    WorkspaceModule,
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
    AiGeneratorService,
    AiQuotaGuard,
    AiUsageListener,
    CaslAbilityFactory,
    AbilityGuard,
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
  controllers: [AiController, AiGeneratorController],
  exports: [AiService, AiUsageService, AiQuotaGuard],
})
export class AiModule {}
