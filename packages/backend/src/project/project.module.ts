import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from './project.entity';
import { ProjectMembershipEntity } from './project-membership/project-membership.entity';
import { TaskEntity } from '../task/task.entity';
import { ProjectService } from './project.service';
import { ProjectMembershipService } from './project-membership/project-membership.service';
import { ProjectController } from './project.controller';
import { StatusModule } from './status/status.module';
import { LabelModule } from './label/label.module';
import { CustomFieldModule } from './custom-field/custom-field.module';
import { EventsModule } from '../events/events.module';
import { PlanningModule } from './planning/planning.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity,
      ProjectMembershipEntity,
      TaskEntity,
    ]),
    StatusModule,
    LabelModule,
    CustomFieldModule,
    EventsModule,
    PlanningModule,
    forwardRef(() => ChatModule),
  ],
  providers: [ProjectMembershipService, ProjectService],
  controllers: [ProjectController],
  exports: [
    ProjectService,
    ProjectMembershipService,
    StatusModule,
    LabelModule,
    CustomFieldModule,
    PlanningModule,
  ],
})
export class ProjectModule {}
