import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPrioritySuggestionEntity } from './ai-priority-suggestion.entity';
import { AiAutoPrioritizeService } from './ai-auto-prioritize.service';
import { AiAutoPrioritizeController } from './ai-auto-prioritize.controller';
import { AiAutoPrioritizeScheduler } from './ai-auto-prioritize.scheduler';
import { TaskEntity } from '../../task/task.entity';
import { WorkspaceEntity } from '../../workspace/workspace.entity';
import { WorkspaceMembershipEntity } from '../../workspace/workspace-membership.entity';
import { CaslAbilityFactory } from '../../auth/casl/ability.factory';
import { AbilityGuard } from '../../auth/guards/ability.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiPrioritySuggestionEntity,
      TaskEntity,
      WorkspaceEntity,
      WorkspaceMembershipEntity,
    ]),
  ],
  providers: [
    AiAutoPrioritizeService,
    AiAutoPrioritizeScheduler,
    CaslAbilityFactory,
    AbilityGuard,
  ],
  controllers: [AiAutoPrioritizeController],
  exports: [AiAutoPrioritizeService],
})
export class AiAutoPrioritizeModule {}
