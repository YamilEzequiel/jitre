import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskEntity } from './task.entity';
import { TaskAssignmentEntity } from './task-assignment.entity';
import { TaskLabelEntity } from './task-label.entity';
import { StatusEntity } from '../project/status/status.entity';
import { ProjectMembershipEntity } from '../project/project-membership/project-membership.entity';
import { ProjectEntity } from '../project/project.entity';
import { PlanningItemEntity } from '../project/planning/planning-item.entity';
import { LabelEntity } from '../project/label/label.entity';
import { TaskService } from './task.service';
import { TaskAssignmentService } from './task-assignment.service';
import { TaskLabelService } from './task-label.service';
import { LexorankService } from './lexorank.service';
import { TaskController, WorkspaceTaskController } from './task.controller';
import { DueSoonScheduler } from './schedulers/due-soon.scheduler';
import { ProjectModule } from '../project/project.module';
import { EventsModule } from '../events/events.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      TaskAssignmentEntity,
      TaskLabelEntity,
      StatusEntity,
      ProjectMembershipEntity,
      ProjectEntity,
      PlanningItemEntity,
      LabelEntity,
    ]),
    ScheduleModule.forRoot(),
    ProjectModule,
    EventsModule,
    SettingsModule,
  ],
  providers: [
    LexorankService,
    TaskAssignmentService,
    TaskLabelService,
    TaskService,
    DueSoonScheduler,
  ],
  controllers: [TaskController, WorkspaceTaskController],
  exports: [
    TaskService,
    TaskAssignmentService,
    TaskLabelService,
    LexorankService,
  ],
})
export class TaskModule {}
