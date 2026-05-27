import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskEntity } from './task.entity';
import { TaskAssignmentEntity } from './task-assignment.entity';
import { TaskLabelEntity } from './task-label.entity';
import { TaskLinkEntity } from './task-link.entity';
import { StatusEntity } from '../project/status/status.entity';
import { ProjectMembershipEntity } from '../project/project-membership/project-membership.entity';
import { ProjectEntity } from '../project/project.entity';
import { PlanningItemEntity } from '../project/planning/planning-item.entity';
import { LabelEntity } from '../project/label/label.entity';
import { WorkflowTransitionEntity } from '../project/workflow/workflow-transition.entity';
import { TaskService } from './task.service';
import { TaskAssignmentService } from './task-assignment.service';
import { TaskLabelService } from './task-label.service';
import { TaskLinkService } from './task-link.service';
import { LexorankService } from './lexorank.service';
import { TaskController, WorkspaceTaskController } from './task.controller';
import { TaskLinkController } from './task-link.controller';
import { DueSoonScheduler } from './schedulers/due-soon.scheduler';
import { ProjectModule } from '../project/project.module';
import { WorkflowModule } from '../project/workflow/workflow.module';
import { EventsModule } from '../events/events.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskAssignmentEntity,
      TaskLabelEntity,
      TaskLinkEntity,
      StatusEntity,
      ProjectMembershipEntity,
      ProjectEntity,
      PlanningItemEntity,
      LabelEntity,
      WorkflowTransitionEntity,
    ]),
    ScheduleModule.forRoot(),
    ProjectModule,
    WorkflowModule,
    EventsModule,
    SettingsModule,
  ],
  providers: [
    LexorankService,
    TaskAssignmentService,
    TaskLabelService,
    TaskLinkService,
    TaskService,
    DueSoonScheduler,
  ],
  controllers: [TaskController, WorkspaceTaskController, TaskLinkController],
  exports: [
    TaskService,
    TaskAssignmentService,
    TaskLabelService,
    TaskLinkService,
    LexorankService,
  ],
})
export class TaskModule {}
