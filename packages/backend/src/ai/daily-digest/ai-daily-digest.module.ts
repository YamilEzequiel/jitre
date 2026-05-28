import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiDailyDigestEntity } from './ai-daily-digest.entity';
import { AiDailyDigestService } from './ai-daily-digest.service';
import { AiDailyDigestController } from './ai-daily-digest.controller';
import { AiDailyDigestScheduler } from './ai-daily-digest.scheduler';
import { TaskEntity } from '../../task/task.entity';
import { Comment } from '../../comment/comment.entity';
import { TimeEntryEntity } from '../../time-tracking/time-entry.entity';
import { WorkspaceEntity } from '../../workspace/workspace.entity';
import { WorkspaceMembershipEntity } from '../../workspace/workspace-membership.entity';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { ProjectModule } from '../../project/project.module';
import { CaslAbilityFactory } from '../../auth/casl/ability.factory';
import { AbilityGuard } from '../../auth/guards/ability.guard';
import { AiModule } from '../ai.module';
import { SettingsModule } from '../../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiDailyDigestEntity,
      TaskEntity,
      Comment,
      TimeEntryEntity,
      WorkspaceEntity,
      WorkspaceMembershipEntity,
    ]),
    // AbilityGuard's constructor pulls WorkspaceService +
    // ProjectMembershipService; pull in the modules that export them.
    WorkspaceModule,
    ProjectModule,
    SettingsModule,
    forwardRef(() => AiModule),
  ],
  providers: [AiDailyDigestService, AiDailyDigestScheduler, CaslAbilityFactory, AbilityGuard],
  controllers: [AiDailyDigestController],
  exports: [AiDailyDigestService],
})
export class AiDailyDigestModule {}
