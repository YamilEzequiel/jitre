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
import { CaslAbilityFactory } from '../../auth/casl/ability.factory';
import { AbilityGuard } from '../../auth/guards/ability.guard';
import { AiModule } from '../ai.module';

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
    forwardRef(() => AiModule),
  ],
  providers: [AiDailyDigestService, AiDailyDigestScheduler, CaslAbilityFactory, AbilityGuard],
  controllers: [AiDailyDigestController],
  exports: [AiDailyDigestService],
})
export class AiDailyDigestModule {}
