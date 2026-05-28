import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPrioritySuggestionEntity } from './ai-priority-suggestion.entity';
import { AiAutoPrioritizeService } from './ai-auto-prioritize.service';
import { AiAutoPrioritizeController } from './ai-auto-prioritize.controller';
import { AiAutoPrioritizeScheduler } from './ai-auto-prioritize.scheduler';
import { TaskEntity } from '../../task/task.entity';
import { WorkspaceEntity } from '../../workspace/workspace.entity';
import { WorkspaceMembershipEntity } from '../../workspace/workspace-membership.entity';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { ProjectModule } from '../../project/project.module';
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
    // AbilityGuard's constructor pulls WorkspaceService +
    // ProjectMembershipService; pull in the modules that export them.
    WorkspaceModule,
    ProjectModule,
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
